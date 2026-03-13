import { PublicKey } from '@solana/web3.js';

export interface PoolInfo {
  address: PublicKey;
  tokenMint: PublicKey;
  quoteTokenMint: PublicKey;
  tokenReserve: number;
  quoteReserve: number;
  price: number;
}

export interface BundleStatus {
  bundleId: string;
  confirmationStatus: 'pending' | 'confirmed' | 'finalized' | 'failed';
  transactions?: string[];
  error?: string;
}

export interface TradingConfig {
  takeProfitPercentage: number;
  stopLossPercentage: number;
  slippageTolerance: number;
}

export interface BundleConfig {
  size: number;
  jitoTipAmount: number;
}
