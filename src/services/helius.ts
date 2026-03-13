import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

export class HeliusService {
  private connection: Connection;
  private heliusRpcUrl: string;

  constructor() {
    this.heliusRpcUrl = config.solana.heliusRpcUrl;
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');
  }

  /**
   * Get recent blockhash from Helius RPC
   */
  async getRecentBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    try {
      if (this.heliusRpcUrl) {
        const response = await axios.post(
          this.heliusRpcUrl,
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'getLatestBlockhash',
            params: [
              {
                commitment: 'confirmed',
              },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data.result) {
          logger.info('Got blockhash from Helius RPC');
          return {
            blockhash: response.data.result.value.blockhash,
            lastValidBlockHeight: response.data.result.value.lastValidBlockHeight,
          };
        }
      }

      // Fallback to standard RPC
      const blockhash = await this.connection.getLatestBlockhash('confirmed');
      logger.info('Got blockhash from standard RPC (fallback)');
      return {
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight,
      };
    } catch (error) {
      logger.error('Error getting blockhash:', error);
      // Fallback to standard RPC
      const blockhash = await this.connection.getLatestBlockhash('confirmed');
      return {
        blockhash: blockhash.blockhash,
        lastValidBlockHeight: blockhash.lastValidBlockHeight,
      };
    }
  }

  /**
   * Get connection instance
   */
  getConnection(): Connection {
    return this.connection;
  }
}
