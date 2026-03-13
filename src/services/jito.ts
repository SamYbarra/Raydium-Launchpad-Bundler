import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

export class JitoService {
  private blockEngineUrl: string;
  private connection: Connection;

  constructor(connection: Connection) {
    this.blockEngineUrl = config.solana.jitoBlockEngineUrl;
    this.connection = connection;
  }

  /**
   * Send bundle to Jito for execution
   */
  async sendBundle(transactions: (Transaction | VersionedTransaction)[]): Promise<string> {
    try {
      const serializedTransactions = transactions.map((tx) => {
        if (tx instanceof VersionedTransaction) {
          return Array.from(tx.serialize());
        } else {
          return Array.from(tx.serialize({ requireAllSignatures: false }));
        }
      });

      // Jito block engine API format
      const response = await axios.post(
        `${this.blockEngineUrl}/api/v1/bundles`,
        serializedTransactions,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      if (response.data && response.data.length > 0) {
        const bundleId = response.data[0];
        logger.info(`Bundle sent to Jito: ${bundleId}`);
        return bundleId;
      }

      throw new Error('Failed to send bundle to Jito');
    } catch (error: any) {
      logger.error('Error sending bundle to Jito:', error.message);
      throw error;
    }
  }

  /**
   * Get bundle status
   */
  async getBundleStatus(bundleId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.blockEngineUrl}/api/v1/bundles/${bundleId}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Error getting bundle status:', error.message);
      throw error;
    }
  }

  /**
   * Wait for bundle confirmation
   */
  async waitForConfirmation(bundleId: string, timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 1000; // Check every second

    while (Date.now() - startTime < timeout) {
      try {
        const status = await this.getBundleStatus(bundleId);
        
        if (status?.confirmationStatus === 'confirmed' || status?.confirmationStatus === 'finalized') {
          logger.info(`Bundle confirmed: ${bundleId}`);
          return true;
        }

        if (status?.confirmationStatus === 'failed') {
          logger.error(`Bundle failed: ${bundleId}`);
          return false;
        }

        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      } catch (error) {
        logger.warn('Error checking bundle status, retrying...');
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }
    }

    logger.warn(`Bundle confirmation timeout: ${bundleId}`);
    return false;
  }
}
