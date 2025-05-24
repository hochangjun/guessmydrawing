# Smart Contract Deployment Guide

## Overview

The game now uses a smart contract for secure, trustless wagering and prize distribution. Instead of manual transfers, all funds are held in escrow by the smart contract and automatically distributed to winners.

## Benefits of Smart Contract Approach

✅ **Trustless**: No need to trust lobby owner to distribute prizes  
✅ **Automatic**: Prizes distributed automatically via smart contract  
✅ **Secure**: Funds held in escrow, can't be stolen  
✅ **Transparent**: All transactions visible on blockchain  
✅ **Gas Efficient**: Owner only pays gas for distribution, not the prize amount  

## Deployment Steps

### 1. Install Hardhat

```bash
npm install --save-dev hardhat
npx hardhat
# Choose "Create a JavaScript project"
```

### 2. Configure Hardhat for Monad Testnet

Create `hardhat.config.js`:

```javascript
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

module.exports = {
  solidity: "0.8.19",
  networks: {
    "monad-testnet": {
      url: "https://testnet-rpc.monad.xyz",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 10143
    }
  }
};
```

### 3. Set Environment Variables

Create `.env`:

```bash
PRIVATE_KEY=your_wallet_private_key_here
```

⚠️ **IMPORTANT**: Never commit your private key to git!

### 4. Get Testnet Tokens

Visit https://faucet.monad.xyz and get MON tokens for deployment gas fees.

### 5. Deploy Contract

Copy `contracts/GameEscrow.sol` to your Hardhat project, then:

```bash
npx hardhat run scripts/deploy.js --network monad-testnet
```

### 6. Update Frontend

After deployment, update `src/contracts/GameEscrow.ts`:

```typescript
export const GAME_ESCROW_ADDRESS = "0xYOUR_DEPLOYED_CONTRACT_ADDRESS";
```

## Contract Functions

### For Lobby Owners:
- `createGame(gameId, wagerAmount)` - Create a new game
- `distributePrize(gameId, winner)` - Distribute prize to winner
- `emergencyRefund(gameId)` - Refund all players if needed

### For Players:
- `depositWager(gameId)` - Deposit wager to join game
- `getGameInfo(gameId)` - View game details
- `hasPlayerDeposited(gameId, player)` - Check deposit status

## How It Works

1. **Lobby Creation**: Lobby owner calls `createGame()` with session code and wager amount
2. **Player Joining**: Each player calls `depositWager()` to deposit their wager
3. **Game Play**: Game proceeds normally with React Together for real-time sync
4. **Prize Distribution**: Lobby owner calls `distributePrize()` with winner's address
5. **Automatic Transfer**: Contract automatically sends all deposited funds to winner

## Gas Costs (Approximate)

- Contract Deployment: ~1,200,000 gas
- Create Game: ~100,000 gas  
- Deposit Wager: ~80,000 gas
- Distribute Prize: ~60,000 gas

## Security Features

- **Reentrancy Protection**: Uses checks-effects-interactions pattern
- **Access Control**: Only game owner can distribute prizes
- **Deposit Verification**: Prevents double deposits and wrong amounts
- **Emergency Refunds**: Owner can refund all players if game gets stuck

## Testing the Contract

You can test on Monad Testnet:

1. Deploy the contract
2. Create a game with test wager (e.g., 0.01 MON)
3. Have multiple players deposit
4. Distribute prize to winner
5. Verify transaction on [Monad Explorer](https://testnet.monadexplorer.com)

## Fallback Mode

If the contract isn't deployed (`GAME_ESCROW_ADDRESS` is `0x000...`), the app falls back to direct transfers to maintain functionality during development.

## Troubleshooting

**"Smart contract not deployed yet"**: Update `GAME_ESCROW_ADDRESS` with your deployed contract address.

**"Incorrect wager amount"**: Ensure the exact wager amount is sent with the transaction.

**"Player has already deposited"**: Each address can only deposit once per game.

**"Only game owner can call this"**: Only the lobby creator can distribute prizes.

## Next Steps

Consider these enhancements:
- Multi-token support (not just MON)
- Tournament brackets with multiple games  
- Automated prize distribution based on game events
- Integration with NFT rewards 