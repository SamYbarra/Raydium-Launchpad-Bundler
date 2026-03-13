# Raydium Launchpad Bundler Bot

A sophisticated Solana Web3 trading bot for Raydium Launchlab (launchpad) DEX with bundle buy capabilities, take profit logic, and Jito integration.

## Features

- 🏊 **Create Liquidity Pools**: Create new liquidity pools on Raydium Launchlab
- 📦 **Bundle Buy**: Execute simultaneous buys across multiple wallets using Jito bundles
- 💰 **Take Profit Logic**: Automatically sell positions when profit targets are met
- 🚀 **Jito Integration**: Fast transaction confirmation using Jito block engine
- 🔍 **Helius RPC**: Optimized blockhash fetching via Helius RPC
- 📊 **Address Lookup Tables**: Efficient transaction compression using lookup tables
- ⚡ **Multi-Wallet Support**: Execute trades across multiple wallets in a single bundle

## Prerequisites

- Node.js 18+ and npm/yarn
- Solana wallet with private key
- Helius API key (optional but recommended)
- Jito block engine access

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Raydium-Launchpad-Bundler
```

2. Install dependencies:
```bash
npm install
```

3. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration:
- Add your wallet private key(s)
- Configure Helius RPC URL (optional)
- Set trading parameters (take profit, stop loss, etc.)

5. Build the project:
```bash
npm run build
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Main wallet private key (base58) | Yes |
| `WALLET_ADDRESSES` | Comma-separated list of additional wallet private keys | No |
| `HELIUS_RPC_URL` | Helius RPC endpoint with API key | Recommended |
| `JITO_BLOCK_ENGINE_URL` | Jito block engine URL | Yes |
| `TAKE_PROFIT_PERCENTAGE` | Profit percentage to trigger sell (default: 50) | No |
| `STOP_LOSS_PERCENTAGE` | Loss percentage to trigger sell (default: 20) | No |
| `BUNDLE_SIZE` | Number of wallets in bundle (default: 5) | No |
| `LOOKUP_TABLE_ADDRESS` | Address lookup table address | Recommended |

## Usage

### Basic Example

```typescript
import { RaydiumLaunchpadBundler } from './index';

const bot = new RaydiumLaunchpadBundler();

// Create a new liquidity pool
const poolAddress = await bot.createPool(
  'YOUR_TOKEN_MINT_ADDRESS',
  'So11111111111111111111111111111111111112', // SOL
  1000000, // Initial token amount
  1 // Initial SOL amount
);

// Execute bundle buy across multiple wallets
const bundleId = await bot.executeBundleBuy(
  poolAddress.toBase58(),
  'TOKEN_MINT_ADDRESS',
  'So11111111111111111111111111111111111112',
  0.1, // Amount per wallet in SOL
  0.09 // Minimum amount out
);

// Start take profit monitoring
bot.startTakeProfitMonitoring(5000); // Check every 5 seconds
```

### Advanced Usage

#### Custom Bundle Buy

```typescript
import { BundlerService } from './services/bundler';

const bundlerService = new BundlerService(
  connection,
  heliusService,
  jitoService,
  raydiumService,
  lookupTableService
);

const bundleParams = {
  poolAddress: new PublicKey('POOL_ADDRESS'),
  tokenMint: new PublicKey('TOKEN_MINT'),
  quoteTokenMint: new PublicKey('SOL_MINT'),
  amountPerWallet: 0.1,
  minAmountOut: 0.09,
  walletPrivateKeys: ['key1', 'key2', 'key3'],
};

const transactions = await bundlerService.createBundleBuy(bundleParams);
const bundleId = await bundlerService.executeBundleBuy(bundleParams);
```

#### Manual Sell Execution

```typescript
const signature = await bot.executeSell(
  'POOL_ADDRESS',
  'TOKEN_MINT',
  'So11111111111111111111111111111111111112',
  1000, // Amount in
  0.9, // Min amount out
  'WALLET_PRIVATE_KEY'
);
```

## Architecture

### Core Services

- **HeliusService**: Fetches recent blockhash from Helius RPC
- **JitoService**: Sends bundles to Jito block engine and monitors confirmation
- **RaydiumService**: Handles Raydium Launchlab interactions (create pool, buy, sell)
- **LookupTableService**: Manages address lookup tables for transaction compression
- **BundlerService**: Creates and executes bundle transactions
- **TakeProfitService**: Monitors positions and triggers sell conditions

### Transaction Flow

1. **Bundle Creation**: Create buy transactions for multiple wallets
2. **Lookup Table**: Compress transactions using address lookup tables
3. **Blockhash**: Fetch recent blockhash from Helius RPC
4. **Jito Bundle**: Send bundle to Jito block engine
5. **Confirmation**: Monitor bundle status until confirmed
6. **Position Tracking**: Add positions to take profit monitor
7. **Auto Sell**: Monitor prices and execute sells when conditions are met

## Development

### Project Structure

```
src/
├── config/          # Configuration management
├── services/        # Core service modules
│   ├── helius.ts    # Helius RPC integration
│   ├── jito.ts      # Jito block engine integration
│   ├── raydium.ts   # Raydium Launchlab integration
│   ├── lookupTable.ts # Address lookup table management
│   ├── bundler.ts   # Bundle transaction creation
│   └── takeProfit.ts # Take profit logic
├── utils/           # Utility functions
│   └── logger.ts    # Logging utility
└── index.ts         # Main entry point
```

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Watch Mode

```bash
npm run watch
```

## Important Notes

⚠️ **Security**: Never commit your `.env` file or private keys to version control.

⚠️ **Testing**: Test thoroughly on devnet before using on mainnet.

⚠️ **Raydium SDK**: This implementation uses a simplified version of Raydium interactions. You may need to integrate with the official Raydium SDK for production use.

⚠️ **Jito Tips**: Ensure your wallets have sufficient SOL for Jito tips and transaction fees.

## Troubleshooting

### Common Issues

1. **Transaction Failures**: Check wallet balances and ensure sufficient SOL for fees
2. **Bundle Rejection**: Verify Jito block engine URL and network connectivity
3. **Lookup Table Errors**: Ensure lookup table address is correct and table exists
4. **Price Fetching**: Verify pool address and RPC endpoint accessibility

### Debug Mode

Set `LOG_LEVEL=debug` in `.env` for detailed logging.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Disclaimer

This software is provided "as is" without warranty. Trading cryptocurrencies involves risk. Use at your own discretion.
