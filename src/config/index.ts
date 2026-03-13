import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    heliusRpcUrl: process.env.HELIUS_RPC_URL || '',
    jitoBlockEngineUrl: process.env.JITO_BLOCK_ENGINE_URL || 'https://mainnet.block-engine.jito.wtf',
  },
  wallet: {
    privateKey: process.env.PRIVATE_KEY || '',
    walletAddresses: process.env.WALLET_ADDRESSES?.split(',') || [],
  },
  raydium: {
    programId: process.env.RAYDIUM_PROGRAM_ID || '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    launchlabProgramId: process.env.LAUNCHLAB_PROGRAM_ID || '',
  },
  trading: {
    takeProfitPercentage: parseFloat(process.env.TAKE_PROFIT_PERCENTAGE || '50'),
    stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE || '20'),
    slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE || '1'),
  },
  bundle: {
    size: parseInt(process.env.BUNDLE_SIZE || '5', 10),
    jitoTipAmount: parseFloat(process.env.JITO_TIP_AMOUNT || '0.0001'),
  },
  lookupTable: {
    address: process.env.LOOKUP_TABLE_ADDRESS || '',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
