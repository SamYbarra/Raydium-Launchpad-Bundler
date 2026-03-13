import {
  Connection,
  AddressLookupTableAccount,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { logger } from '../utils/logger';
import { config } from '../config';

export class LookupTableService {
  private connection: Connection;
  private lookupTableAddress?: PublicKey;

  constructor(connection: Connection) {
    this.connection = connection;
    if (config.lookupTable.address) {
      this.lookupTableAddress = new PublicKey(config.lookupTable.address);
    }
  }

  /**
   * Get address lookup table account
   */
  async getLookupTableAccount(address?: PublicKey): Promise<AddressLookupTableAccount | null> {
    try {
      const lookupAddress = address || this.lookupTableAddress;
      if (!lookupAddress) {
        logger.warn('No lookup table address configured');
        return null;
      }

      const lookupTableAccount = await this.connection.getAddressLookupTable(lookupAddress);
      
      if (!lookupTableAccount.value) {
        logger.warn(`Lookup table not found: ${lookupAddress.toBase58()}`);
        return null;
      }

      logger.info(`Loaded lookup table: ${lookupAddress.toBase58()}`);
      return lookupTableAccount.value;
    } catch (error) {
      logger.error('Error getting lookup table:', error);
      return null;
    }
  }

  /**
   * Create versioned transaction with lookup table
   */
  async createVersionedTransaction(
    instructions: any[],
    payer: PublicKey,
    recentBlockhash: string,
    lookupTableAddress?: PublicKey
  ): Promise<VersionedTransaction> {
    try {
      const lookupTable = await this.getLookupTableAccount(lookupTableAddress);
      const lookupTables = lookupTable ? [lookupTable] : [];

      const messageV0 = new TransactionMessage({
        payerKey: payer,
        recentBlockhash,
        instructions,
      }).compileToV0Message(lookupTables);

      return new VersionedTransaction(messageV0);
    } catch (error) {
      logger.error('Error creating versioned transaction:', error);
      throw error;
    }
  }

  /**
   * Set lookup table address
   */
  setLookupTableAddress(address: PublicKey): void {
    this.lookupTableAddress = address;
    logger.info(`Lookup table address set: ${address.toBase58()}`);
  }
}
