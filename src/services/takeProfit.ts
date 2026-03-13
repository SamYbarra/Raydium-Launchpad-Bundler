import { Connection, PublicKey } from '@solana/web3.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { RaydiumService } from './raydium';

export interface Position {
  poolAddress: PublicKey;
  tokenMint: PublicKey;
  quoteTokenMint: PublicKey;
  entryPrice: number;
  amount: number;
  wallet: PublicKey;
}

export class TakeProfitService {
  private connection: Connection;
  private raydiumService: RaydiumService;
  private positions: Map<string, Position>;
  private takeProfitPercentage: number;
  private stopLossPercentage: number;

  constructor(connection: Connection, raydiumService: RaydiumService) {
    this.connection = connection;
    this.raydiumService = raydiumService;
    this.positions = new Map();
    this.takeProfitPercentage = config.trading.takeProfitPercentage;
    this.stopLossPercentage = config.trading.stopLossPercentage;
  }

  /**
   * Add position to monitor
   */
  addPosition(position: Position): void {
    const key = `${position.poolAddress.toBase58()}-${position.wallet.toBase58()}`;
    this.positions.set(key, position);
    logger.info(`Added position to monitor: ${key}`);
  }

  /**
   * Remove position
   */
  removePosition(poolAddress: PublicKey, wallet: PublicKey): void {
    const key = `${poolAddress.toBase58()}-${wallet.toBase58()}`;
    this.positions.delete(key);
    logger.info(`Removed position: ${key}`);
  }

  /**
   * Check if take profit or stop loss conditions are met
   */
  async checkConditions(): Promise<Array<{ position: Position; reason: string }>> {
    const triggered: Array<{ position: Position; reason: string }> = [];

    for (const [key, position] of this.positions.entries()) {
      try {
        const currentPrice = await this.raydiumService.getPoolPrice(position.poolAddress);
        
        if (currentPrice === 0) {
          logger.warn(`Could not get price for pool: ${position.poolAddress.toBase58()}`);
          continue;
        }

        const priceChange = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;

        // Check take profit
        if (priceChange >= this.takeProfitPercentage) {
          triggered.push({
            position,
            reason: `Take profit triggered: ${priceChange.toFixed(2)}% gain`,
          });
          logger.info(`Take profit condition met for ${key}: ${priceChange.toFixed(2)}%`);
        }

        // Check stop loss
        if (priceChange <= -this.stopLossPercentage) {
          triggered.push({
            position,
            reason: `Stop loss triggered: ${priceChange.toFixed(2)}% loss`,
          });
          logger.warn(`Stop loss condition met for ${key}: ${priceChange.toFixed(2)}%`);
        }
      } catch (error) {
        logger.error(`Error checking conditions for position ${key}:`, error);
      }
    }

    return triggered;
  }

  /**
   * Start monitoring positions
   */
  startMonitoring(intervalMs: number = 5000): void {
    logger.info('Starting position monitoring...');
    
    const interval = setInterval(async () => {
      const triggered = await this.checkConditions();
      
      if (triggered.length > 0) {
        // Emit event or call callback for each triggered position
        for (const { position, reason } of triggered) {
          logger.info(`Sell signal: ${reason}`, {
            pool: position.poolAddress.toBase58(),
            wallet: position.wallet.toBase58(),
          });
        }
      }
    }, intervalMs);

    // Store interval reference for cleanup
    (this as any).monitoringInterval = interval;
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if ((this as any).monitoringInterval) {
      clearInterval((this as any).monitoringInterval);
      logger.info('Stopped position monitoring');
    }
  }

  /**
   * Get all positions
   */
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }
}
