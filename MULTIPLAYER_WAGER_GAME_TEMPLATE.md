# Multiplayer Wager Game Development Template

## 🎯 **Overview**
Template for building real-time multiplayer games with blockchain wagering using ReactTogether + Smart Contracts.

## 🏗️ **Core Architecture**

### **Tech Stack**
- **Frontend**: Vite + React + TypeScript + TailwindCSS
- **Real-time Sync**: ReactTogether (Multisynq)
- **Authentication**: Privy
- **Blockchain**: ethers.js + Custom Escrow Contract
- **State Management**: useStateTogether hooks

### **Key Principles**
1. **Single ReactTogether Session**: One global session for lobby discovery, individual sessions per game
2. **Wallet-Based Player IDs**: Use `wallet:${address.toLowerCase()}` as consistent player keys
3. **Optimistic Updates**: Update UI immediately, sync to ReactTogether after
4. **Smart Contract First**: Lobby owner creates contract, others join existing contract

## 🔧 **ReactTogether Best Practices**

### **State Management Patterns**
```typescript
// ✅ GOOD: Wallet-based keys for consistency
const [players, setPlayers] = useStateTogether<Record<string, Player>>(
  `players_${sessionCode}`, {}
);

// ✅ GOOD: Session-specific state
const [gameState, setGameState] = useStateTogether<GameState>(
  `gameState_${sessionCode}`, defaultState
);

// ✅ GOOD: Global shared state
const [publicLobbies, setPublicLobbies] = useStateTogether<Record<string, PublicLobby>>(
  'publicLobbies', {}
);

// ❌ BAD: Don't mix localStorage with ReactTogether
localStorage.setItem('gameData', JSON.stringify(data)); // Never do this for shared data
```

### **Player Management**
```typescript
// Consistent player key generation
const getPlayerKey = (walletAddress: string) => `wallet:${walletAddress.toLowerCase()}`;

// Player initialization with join timestamps for lobby ownership
const newPlayer: Player = {
  id: playerKey,
  nickname: `Player ${walletAddress.slice(0, 6)}`,
  score: 0,
  hasPaid: false,
  walletAddress: walletAddress,
  joinedAt: Date.now() // Critical for lobby owner determination
};

// Lobby owner = earliest joined player
const earliestPlayer = Object.values(players).reduce((earliest, current) => 
  current.joinedAt < earliest.joinedAt ? current : earliest
);
```

### **Avoiding Infinite Loops**
```typescript
// ❌ BAD: Causes infinite re-renders
useEffect(() => {
  if (Object.keys(players).length > 0) { // Creates new array every render
    // Update logic
  }
}, [Object.keys(players).length]); // Unstable dependency

// ✅ GOOD: Stable dependencies
const playerCount = Object.keys(players).length;
useEffect(() => {
  if (playerCount > 0) {
    // Update logic
  }
}, [playerCount]); // Stable primitive value
```

## 💰 **Smart Contract Integration**

### **Escrow Contract Pattern**
```solidity
// Current implementation (needs improvement)
contract GameEscrow {
    struct Game {
        address owner;           // Lobby creator
        uint256 wagerAmount;     // Fixed wager per player
        uint256 totalDeposits;   // Total collected
        mapping(address => bool) hasDeposited;
        address[] players;
        bool isFinished;
        address winner;
    }
    
    // Issues with current design:
    // 1. Only owner can distribute prize (centralized)
    // 2. No automatic distribution mechanism
    // 3. No dispute resolution
}
```

### **Improved Contract Design**
```solidity
// 🚀 BETTER: Decentralized prize distribution
contract ImprovedGameEscrow {
    struct Game {
        address owner;
        uint256 wagerAmount;
        uint256 totalDeposits;
        mapping(address => bool) hasDeposited;
        address[] players;
        bool isFinished;
        address winner;
        uint256 gameEndTime;     // NEW: Automatic distribution timer
        mapping(address => bool) votedWinner; // NEW: Player voting system
        mapping(address => uint256) winnerVotes; // NEW: Vote counting
    }
    
    // NEW: Players can vote on winner if owner doesn't distribute
    function voteWinner(string memory gameId, address winner) external;
    
    // NEW: Automatic distribution after timeout
    function autoDistribute(string memory gameId) external;
    
    // NEW: Emergency refund if game stalls
    function emergencyRefund(string memory gameId) external;
}
```

### **Payment Flow**
```typescript
// 1. Lobby owner pays first (creates contract)
const createAndPay = async () => {
  // Create game in contract
  await gameContract.createGame(sessionCode, wagerWei);
  // Immediately deposit own wager
  await gameContract.depositWager(sessionCode, { value: wagerWei });
};

// 2. Other players join existing contract
const joinAndPay = async () => {
  // Check if game exists
  const gameInfo = await gameContract.getGameInfo(sessionCode);
  if (gameInfo.owner === ZERO_ADDRESS) {
    throw new Error('Game not created yet');
  }
  // Deposit to existing game
  await gameContract.depositWager(sessionCode, { value: wagerWei });
};
```

## 🎮 **Game State Management**

### **Phase-Based Architecture**
```typescript
type GamePhase = 'lobby' | 'playing' | 'finished';

interface GameState {
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  currentPlayer: string | null;
  timeRemaining: number;
  wagerAmount: number;        // Immutable after creation
  lobbyOwner: string;
  sessionCode: string;
  createdAt: number;
}
```

### **Dynamic Game Rules**
```typescript
// Scale rounds with player count
const calculateRounds = (playerCount: number) => playerCount * 2; // Everyone plays twice

// Scale timer based on game complexity
const getTimeLimit = (gameType: string) => {
  switch(gameType) {
    case 'drawing': return 35; // Shorter for drawing games
    case 'trivia': return 15;  // Quick for trivia
    case 'strategy': return 60; // Longer for strategy
    default: return 30;
  }
};
```

## 🎨 **UI/UX Best Practices**

### **Lobby Owner Clarity**
```typescript
// Clear indication of responsibilities
{gameState.lobbyOwner === currentPlayerKey && !currentPlayer?.hasPaid && (
  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-3">
    <p className="text-yellow-800 text-sm font-medium text-center">
      ⚠️ As lobby owner, you must pay first to activate the smart contract
    </p>
    <p className="text-yellow-700 text-xs text-center mt-1">
      Other players are waiting for you to create the game contract
    </p>
  </div>
)}
```

### **Payment Status Indicators**
```typescript
// Visual payment status
<div className={`w-4 h-4 rounded-full ${
  player.hasPaid 
    ? 'bg-gradient-to-r from-green-400 to-green-600 shadow-lg pulse-glow' 
    : 'bg-gradient-to-r from-red-400 to-red-500'
}`} />

// Button states
<button
  disabled={isPaying || currentPlayer?.hasPaid}
  className="disabled:opacity-50 disabled:cursor-not-allowed"
>
  {currentPlayer?.hasPaid ? '✅ Payment Made' : 
   isPaying ? '⏳ Processing...' : 
   `💳 Pay Wager (${wagerAmount} MON)`}
</button>
```

### **Real-time Feedback**
```typescript
// Optimistic updates with rollback
const payWager = async () => {
  // Optimistic update
  setPlayers(prev => ({
    ...prev,
    [playerKey]: { ...prev[playerKey], hasPaid: true }
  }));
  
  try {
    await contractTransaction();
  } catch (error) {
    // Rollback on error
    setPlayers(prev => ({
      ...prev,
      [playerKey]: { ...prev[playerKey], hasPaid: false }
    }));
    throw error;
  }
};
```

### **Prize Pool Display**
```typescript
// Clean number formatting
const formatPrize = (amount: number) => {
  return amount.toString().replace(/\.?0+$/, ''); // Remove trailing zeros
};

// Contract vs calculated amounts
const displayPrizeAmount = (() => {
  let amount;
  if (contractGameInfo) {
    amount = parseFloat(ethers.formatEther(contractGameInfo.totalDeposits));
  } else {
    amount = wagerAmount * playerCount;
  }
  return formatPrize(amount);
})();
```

## 🔍 **Debug & Development**

### **Collapsible Debug Info**
```typescript
{process.env.NODE_ENV === 'development' && (
  <details className="mb-4">
    <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 p-2 rounded-lg">
      🔧 Debug Info (Click to expand)
    </summary>
    <div className="text-xs text-gray-500 bg-gray-100 p-3 rounded-lg mt-2">
      <p>Connected Wallet: {connectedWallet}</p>
      <p>Player Key: {currentPlayerKey}</p>
      <p>Lobby Owner: {gameState.lobbyOwner}</p>
      <p>Contract Status: {contractGameInfo ? 'Active' : 'Pending'}</p>
    </div>
  </details>
)}
```

### **Error Handling**
```typescript
// Specific error messages for common issues
if (error.message?.includes('insufficient funds')) {
  const userConfirmed = confirm(
    '❌ Insufficient funds! You need testnet tokens.\n\n' +
    '🎁 Click OK to get free tokens from faucet.'
  );
  if (userConfirmed) {
    window.open('https://faucet.example.com', '_blank');
  }
} else if (error.message?.includes('user rejected transaction')) {
  // Silent - user cancelled
} else {
  alert(`Transaction failed: ${error.message}`);
}
```

## 🚀 **Deployment Checklist**

### **Environment Variables**
```env
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_MULTISYNQ_API_KEY=your_multisynq_key
VITE_MULTISYNQ_APP_ID=your_multisynq_app_id
VITE_CONTRACT_ADDRESS=deployed_contract_address
```

### **Network Configuration**
```typescript
const NETWORK_CONFIG = {
  chainId: '0x279f', // Monad Testnet
  chainName: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: ['https://testnet-rpc.monad.xyz'],
  blockExplorerUrls: ['https://testnet.monadexplorer.com']
};
```

## 🎯 **Game-Specific Adaptations**

### **For Drawing Games**
- Canvas with optimistic rendering
- Real-time path synchronization
- Word bank management
- Guess validation

### **For Trivia Games**
- Question/answer management
- Timer-based rounds
- Score calculation
- Multiple choice handling

### **For Strategy Games**
- Turn-based state management
- Move validation
- Board state synchronization
- Complex scoring systems

## ⚠️ **Common Pitfalls**

1. **Don't mix localStorage with ReactTogether** - Use one or the other
2. **Avoid unstable dependencies in useEffect** - Extract to variables first
3. **Always handle wallet disconnection** - Clean up player state
4. **Test with multiple browser windows** - Ensure real-time sync works
5. **Handle network switches gracefully** - Auto-switch to correct chain
6. **Implement proper error boundaries** - Catch and display errors nicely
7. **Use optimistic updates sparingly** - Only for critical UX improvements

## 🔮 **Future Improvements**

### **Smart Contract Enhancements**
- Decentralized winner determination
- Automatic prize distribution
- Dispute resolution mechanism
- Multi-token support
- Tournament brackets

### **Game Features**
- Spectator mode
- Replay system
- Leaderboards
- Achievement system
- Custom game rules

### **Technical Improvements**
- WebRTC for lower latency
- State compression for large games
- Offline mode support
- Mobile optimization
- Progressive Web App features

---

**Remember**: Start simple, test thoroughly, and iterate based on user feedback. The core pattern of ReactTogether + Smart Contract escrow is solid - build your specific game logic on top of this foundation. 

**Pro tip**:
- put a default name and password in the ReactTogether session params, this helps to sync stuff
-  each “message” has a limit of about 10k, And each time you change the useStateTogether a message is sent (to the network), Meaning if you have large data to store in a given state (what I imagine is what is going on) you can either:
- compress the data so its under 10k
- split data into chunks (let’s say stateTogether 1 and stateTogether 2) each could hold 10k, so now you have a total of 20k of data you can handle
- a mix of the 2 above (best option)