import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { config } from './config';
import { logger } from './utils/logger';
import { HeliusService } from './services/helius';
import { JitoService } from './services/jito';
import { RaydiumService, CreatePoolParams } from './services/raydium';
import { LookupTableService } from './services/lookupTable';
import { BundlerService, BundleBuyParams } from './services/bundler';
import { TakeProfitService, Position } from './services/takeProfit';

class RaydiumLaunchpadBundler {
  private connection: Connection;
  private heliusService: HeliusService;
  private jitoService: JitoService;
  private raydiumService: RaydiumService;
  private lookupTableService: LookupTableService;
  private bundlerService: BundlerService;
  private takeProfitService: TakeProfitService;
  private mainWallet: Keypair;

  constructor() {
    // Initialize connection
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');

    // Initialize services
    this.heliusService = new HeliusService();
    this.jitoService = new JitoService(this.connection);
    this.raydiumService = new RaydiumService(this.connection);
    this.lookupTableService = new LookupTableService(this.connection);
    this.bundlerService = new BundlerService(
      this.connection,
      this.heliusService,
      this.jitoService,
      this.raydiumService,
      this.lookupTableService
    );
    this.takeProfitService = new TakeProfitService(this.connection, this.raydiumService);

    // Initialize main wallet
    if (!config.wallet.privateKey) {
      throw new Error('PRIVATE_KEY not set in environment variables');
    }
    this.mainWallet = RaydiumService.createKeypairFromPrivateKey(config.wallet.privateKey);

    logger.info('Raydium Launchpad Bundler initialized');
    logger.info(`Main wallet: ${this.mainWallet.publicKey.toBase58()}`);
  }

  /**
   * Create new liquidity pool
   */
  async createPool(
    tokenMint: string,
    quoteTokenMint: string = 'So11111111111111111111111111111111111112', // SOL
    initialTokenAmount: number = 1000000,
    initialQuoteAmount: number = 1
  ): Promise<PublicKey> {
    try {
      logger.info('Creating new liquidity pool...');

      const params: CreatePoolParams = {
        tokenMint: new PublicKey(tokenMint),
        quoteTokenMint: new PublicKey(quoteTokenMint),
        initialTokenAmount,
        initialQuoteAmount,
        feeRate: 0.25, // 0.25% fee
      };

      const { poolAddress, transaction } = await this.raydiumService.createPool(params);

      // Sign and send transaction
      transaction.recentBlockhash = (await this.heliusService.getRecentBlockhash()).blockhash;
      transaction.feePayer = this.mainWallet.publicKey;
      transaction.sign(this.mainWallet);

      const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      await this.connection.confirmTransaction(signature, 'confirmed');
      logger.info(`Pool created: ${poolAddress.toBase58()}`);
      logger.info(`Transaction: ${signature}`);

      return poolAddress;
    } catch (error) {
      logger.error('Error creating pool:', error);
      throw error;
    }
  }

  /**
   * Execute bundle buy
   */
  async executeBundleBuy(
    poolAddress: string,
    tokenMint: string,
    quoteTokenMint: string,
    amountPerWallet: number,
    minAmountOut: number
  ): Promise<string> {
    try {
      logger.info('Executing bundle buy...');

      const walletPrivateKeys = config.wallet.walletAddresses.length > 0
        ? config.wallet.walletAddresses
        : [config.wallet.privateKey]; // Fallback to main wallet if no additional wallets

      const params: BundleBuyParams = {
        poolAddress: new PublicKey(poolAddress),
        tokenMint: new PublicKey(tokenMint),
        quoteTokenMint: new PublicKey(quoteTokenMint),
        amountPerWallet,
        minAmountOut,
        walletPrivateKeys,
      };

      const bundleId = await this.bundlerService.executeBundleBuy(params);

      // Add positions to take profit monitor
      for (const privateKey of walletPrivateKeys) {
        const wallet = RaydiumService.createKeypairFromPrivateKey(privateKey);
        const entryPrice = await this.raydiumService.getPoolPrice(new PublicKey(poolAddress));
        
        const position: Position = {
          poolAddress: new PublicKey(poolAddress),
          tokenMint: new PublicKey(tokenMint),
          quoteTokenMint: new PublicKey(quoteTokenMint),
          entryPrice,
          amount: amountPerWallet,
          wallet: wallet.publicKey,
        };

        this.takeProfitService.addPosition(position);
      }

      return bundleId;
    } catch (error) {
      logger.error('Error executing bundle buy:', error);
      throw error;
    }
  }

  /**
   * Start take profit monitoring
   */
  startTakeProfitMonitoring(intervalMs: number = 5000): void {
    this.takeProfitService.startMonitoring(intervalMs);
    logger.info('Take profit monitoring started');
  }

  /**
   * Stop take profit monitoring
   */
  stopTakeProfitMonitoring(): void {
    this.takeProfitService.stopMonitoring();
    logger.info('Take profit monitoring stopped');
  }

  /**
   * Execute sell for a position
   */
  async executeSell(
    poolAddress: string,
    tokenMint: string,
    quoteTokenMint: string,
    amountIn: number,
    minAmountOut: number,
    walletPrivateKey: string
  ): Promise<string> {
    try {
      logger.info('Executing sell...');

      const wallet = RaydiumService.createKeypairFromPrivateKey(walletPrivateKey);
      const sellParams = {
        poolAddress: new PublicKey(poolAddress),
        tokenMint: new PublicKey(tokenMint),
        quoteTokenMint: new PublicKey(quoteTokenMint),
        amountIn,
        minAmountOut,
        wallet,
      };

      const transaction = await this.raydiumService.createSellTransaction(sellParams);
      const { blockhash } = await this.heliusService.getRecentBlockhash();

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      transaction.sign(wallet);

      const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      await this.connection.confirmTransaction(signature, 'confirmed');
      logger.info(`Sell executed: ${signature}`);

      // Remove position from monitoring
      this.takeProfitService.removePosition(new PublicKey(poolAddress), wallet.publicKey);

      return signature;
    } catch (error) {
      logger.error('Error executing sell:', error);
      throw error;
    }
  }
}

// Example usage
async function main() {
  try {
    const bot = new RaydiumLaunchpadBundler();

    // Example: Create a new pool
    // const poolAddress = await bot.createPool(
    //   'YOUR_TOKEN_MINT_ADDRESS',
    //   'So11111111111111111111111111111111111112', // SOL
    //   1000000, // Initial token amount
    //   1 // Initial SOL amount
    // );

    // Example: Execute bundle buy
    // const bundleId = await bot.executeBundleBuy(
    //   'POOL_ADDRESS',
    //   'TOKEN_MINT_ADDRESS',
    //   'So11111111111111111111111111111111111112',
    //   0.1, // Amount per wallet in SOL
    //   0.09 // Min amount out
    // );

    // Start take profit monitoring
    // bot.startTakeProfitMonitoring(5000); // Check every 5 seconds

    logger.info('Bot ready. Uncomment example code to start trading.');
  } catch (error) {
    logger.error('Error in main:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

export { RaydiumLaunchpadBundler };
