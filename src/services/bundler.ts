import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
  SystemProgram,
} from '@solana/web3.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { HeliusService } from './helius';
import { JitoService } from './jito';
import { RaydiumService, BuyParams } from './raydium';
import { LookupTableService } from './lookupTable';
import bs58 from 'bs58';

export interface BundleBuyParams {
  poolAddress: PublicKey;
  tokenMint: PublicKey;
  quoteTokenMint: PublicKey;
  amountPerWallet: number;
  minAmountOut: number;
  walletPrivateKeys: string[];
}

export class BundlerService {
  private connection: Connection;
  private heliusService: HeliusService;
  private jitoService: JitoService;
  private raydiumService: RaydiumService;
  private lookupTableService: LookupTableService;

  constructor(
    connection: Connection,
    heliusService: HeliusService,
    jitoService: JitoService,
    raydiumService: RaydiumService,
    lookupTableService: LookupTableService
  ) {
    this.connection = connection;
    this.heliusService = heliusService;
    this.jitoService = jitoService;
    this.raydiumService = raydiumService;
    this.lookupTableService = lookupTableService;
  }

  /**
   * Create bundle buy transactions for multiple wallets
   */
  async createBundleBuy(params: BundleBuyParams): Promise<VersionedTransaction[]> {
    try {
      logger.info(`Creating bundle buy for ${params.walletPrivateKeys.length} wallets`);

      // Get recent blockhash from Helius
      const { blockhash } = await this.heliusService.getRecentBlockhash();

      // Create keypairs from private keys
      const wallets = params.walletPrivateKeys.map((pk) =>
        RaydiumService.createKeypairFromPrivateKey(pk)
      );

      // Create buy transactions for each wallet
      const transactions: VersionedTransaction[] = [];

      for (const wallet of wallets) {
        try {
          const buyParams: BuyParams = {
            poolAddress: params.poolAddress,
            tokenMint: params.tokenMint,
            quoteTokenMint: params.quoteTokenMint,
            amountIn: params.amountPerWallet,
            minAmountOut: params.minAmountOut,
            wallet,
          };

          const transaction = await this.raydiumService.createBuyTransaction(buyParams);

          // Convert to versioned transaction with lookup table
          const versionedTx = await this.lookupTableService.createVersionedTransaction(
            transaction.instructions,
            wallet.publicKey,
            blockhash
          );

          // Sign transaction
          versionedTx.sign([wallet]);

          transactions.push(versionedTx);
          logger.debug(`Created buy transaction for wallet: ${wallet.publicKey.toBase58()}`);
        } catch (error) {
          logger.error(`Error creating transaction for wallet ${wallet.publicKey.toBase58()}:`, error);
        }
      }

      logger.info(`Created ${transactions.length} bundle transactions`);
      return transactions;
    } catch (error) {
      logger.error('Error creating bundle buy:', error);
      throw error;
    }
  }

  /**
   * Execute bundle buy
   */
  async executeBundleBuy(params: BundleBuyParams): Promise<string> {
    try {
      logger.info('Executing bundle buy...');

      // Create bundle transactions
      const transactions = await this.createBundleBuy(params);

      if (transactions.length === 0) {
        throw new Error('No transactions created for bundle');
      }

      // Send bundle to Jito
      const bundleId = await this.jitoService.sendBundle(transactions);

      // Wait for confirmation
      const confirmed = await this.jitoService.waitForConfirmation(bundleId);

      if (confirmed) {
        logger.info(`Bundle buy executed successfully: ${bundleId}`);
        return bundleId;
      } else {
        throw new Error('Bundle buy confirmation failed');
      }
    } catch (error) {
      logger.error('Error executing bundle buy:', error);
      throw error;
    }
  }

  /**
   * Create bundle with tip transaction
   */
  async createBundleWithTip(
    transactions: VersionedTransaction[],
    tipAccount: PublicKey
  ): Promise<VersionedTransaction[]> {
    try {
      // Add tip transaction at the beginning of the bundle
      const { blockhash } = await this.heliusService.getRecentBlockhash();
      
      // Create tip transaction
      const tipAmount = config.bundle.jitoTipAmount * 1e9; // Convert SOL to lamports
      
      // Note: Tip transaction structure depends on Jito's requirements
      // This is a simplified version
      const tipTransaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: tipAccount,
          toPubkey: tipAccount, // Jito tip account
          lamports: tipAmount,
        })
      );

      tipTransaction.recentBlockhash = blockhash;
      tipTransaction.feePayer = tipAccount;

      // Convert tip transaction to versioned if needed
      // For now, we'll add it as the first transaction in the bundle
      // Actual implementation may require specific Jito tip format

      return transactions;
    } catch (error) {
      logger.error('Error creating bundle with tip:', error);
      throw error;
    }
  }
}
