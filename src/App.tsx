import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ReactTogether, useStateTogether, useMyId, useAllNicknames } from 'react-together';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { GAME_ESCROW_ABI, GAME_ESCROW_ADDRESS, GameInfo } from './contracts/GameEscrow';

// Constants
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Environment Variables
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID;
const MULTISYNQ_API_KEY = import.meta.env.VITE_MULTISYNQ_API_KEY;
const MULTISYNQ_APP_ID = import.meta.env.VITE_MULTISYNQ_APP_ID;

// Add console info about wallet injection conflicts
console.log(
  '%c🎨 Guess My Drawing',
  'color: #4f46e5; font-size: 20px; font-weight: bold;'
);
console.log(
  '%cℹ️ Wallet injection conflicts in console are normal when multiple wallet extensions are installed (MetaMask, Backpack, etc.). They do not affect game functionality.',
  'color: #6b7280; font-size: 12px;'
);

// Types and Interfaces
interface Point {
  x: number;
  y: number;
}

interface DrawingPath {
  id: string;
  userId: string;
  points: Point[];
  color: string;
  strokeWidth: number;
  timestamp: number;
}

interface Player {
  id: string;
  nickname: string;
  score: number;
  hasPaid: boolean;
  isReady: boolean;
  walletAddress?: string;
  paymentTxHash?: string;
  joinedAt: number; // Add timestamp for join order
}

interface GameState {
  phase: 'lobby' | 'wagering' | 'playing' | 'intermission' | 'finished';
  currentRound: number;
  totalRounds: number;
  currentDrawer: string | null;
  currentWord: string | null;
  timeRemaining: number;
  roundStartTime: number;
  scores: Record<string, number>;
  wagerAmount: number;
  lobbyOwner: string;
  guessedCorrectly: string[];
  sessionCode: string;
  createdAt: number;
}

interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  timestamp: number;
  isGuess: boolean;
  isCorrect?: boolean;
}

// Global window type extension
declare global {
  interface Window {
    ethereum?: any;
    nextRoundTriggered?: boolean;
  }
}

// Helper function to generate a consistent user identifier
const getConsistentUserId = (user: any, connectedWallet?: string | null): string => {
  // Always prioritize wallet address if available (most important for blockchain games)
  if (connectedWallet) {
    return `wallet:${connectedWallet.toLowerCase()}`;
  }
  
  // Fallback to Privy wallet if available
  if (user?.wallet?.address) {
    return `wallet:${user.wallet.address.toLowerCase()}`;
  }
  
  // Fallback to user ID-based identification
  if (user?.id) {
    return `user:${user.id}`;
  }
  
  // Last resort - use email if available
  if (user?.email?.address) {
    return `email:${user.email.address}`;
  }
  
  return `unknown:${Date.now()}`;
};

// Helper function to detect ethereum provider
const detectEthereumProvider = async (): Promise<any> => {
  if ((window as any).ethereum) {
    return (window as any).ethereum;
  }

  return new Promise((resolve) => {
    let provider: any = null;
    
    const handleEthereum = () => {
      if ((window as any).ethereum) {
        provider = (window as any).ethereum;
        resolve(provider);
      }
    };

    window.addEventListener('ethereum#initialized', handleEthereum, { once: true });
    
    setTimeout(() => {
      if (!provider && (window as any).ethereum) {
        provider = (window as any).ethereum;
      }
      resolve(provider);
    }, 3000);

    handleEthereum();
  });
};

// Word bank for the game
const WORD_BANK = [
  'cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'star', 'flower', 'bird',
  'fish', 'boat', 'airplane', 'bicycle', 'apple', 'banana', 'pizza', 'burger', 'cake', 'ice cream',
  'guitar', 'piano', 'book', 'pencil', 'computer', 'phone', 'clock', 'key', 'door', 'window',
  'mountain', 'ocean', 'beach', 'forest', 'desert', 'rainbow', 'lightning', 'snowman', 'umbrella', 'balloon',
  'elephant', 'lion', 'tiger', 'monkey', 'dolphin', 'butterfly', 'spider', 'snake', 'rabbit', 'horse'
];

// Monad Testnet Configuration
const MONAD_TESTNET = {
  chainId: '0x279f', // 10143 in hex
  chainName: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: ['https://testnet-rpc.monad.xyz'],
  blockExplorerUrls: ['https://testnet.monadexplorer.com']
};

// Enhanced Drawing Canvas Component
const DrawingCanvas: React.FC<{
  paths: DrawingPath[];
  setPaths: (paths: DrawingPath[]) => void;
  canDraw: boolean;
  color: string;
  strokeWidth: number;
  currentPlayerKey: string | null;
}> = ({ paths, setPaths, canDraw, color, strokeWidth, currentPlayerKey }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);

  // Optimistic rendering state
  const optimisticallyAddedPathRef = useRef<DrawingPath | null>(null);

  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canDraw || !currentPlayerKey) return;
    setIsDrawing(true);
    const pos = getMousePos(e);
    setCurrentPath([pos]);
  }, [canDraw, currentPlayerKey, getMousePos]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canDraw) return;
    const pos = getMousePos(e);
    setCurrentPath(prev => [...prev, pos]);
  }, [isDrawing, canDraw, getMousePos]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing || !currentPlayerKey || currentPath.length < 2) {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    const newPath: DrawingPath = {
      id: `${currentPlayerKey}-${Date.now()}-${Math.random()}`,
      userId: currentPlayerKey,
      points: currentPath,
      color,
      strokeWidth,
      timestamp: Date.now()
    };

    // Optimistic rendering - show immediately
    optimisticallyAddedPathRef.current = newPath;
    
    // Update shared state - this will sync across all players
    setPaths([...paths, newPath]);
    setIsDrawing(false);
    setCurrentPath([]);
  }, [isDrawing, currentPlayerKey, currentPath, color, strokeWidth, paths, setPaths]);

  // Check if optimistic path is confirmed
  useEffect(() => {
    if (optimisticallyAddedPathRef.current && paths) {
      const optimisticPathId = optimisticallyAddedPathRef.current.id;
      if (paths.some(p => p.id === optimisticPathId)) {
        optimisticallyAddedPathRef.current = null;
      }
    }
  }, [paths]);

  // Redraw canvas with enhanced styling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#f8fafc');
    gradient.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add grid pattern
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    const gridSize = 20;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw all confirmed paths
    paths.forEach(path => {
      if (path.points.length < 2) return;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      path.points.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      
      ctx.shadowColor = 'transparent';
    });

    // Draw current path being drawn
    if (currentPath.length > 1) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      currentPath.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.shadowColor = 'transparent';
    }

    // Draw optimistic path
    const optimisticPath = optimisticallyAddedPathRef.current;
    if (optimisticPath && (!paths || !paths.some(p => p.id === optimisticPath.id))) {
      ctx.globalAlpha = 0.7; // Semi-transparent to show it's pending
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
      ctx.shadowBlur = 2;
      ctx.beginPath();
      ctx.moveTo(optimisticPath.points[0].x, optimisticPath.points[0].y);
      optimisticPath.points.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = optimisticPath.color;
      ctx.lineWidth = optimisticPath.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'transparent';
    }
  }, [paths, currentPath, color, strokeWidth]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className={`border-4 border-indigo-200 bg-white rounded-3xl shadow-2xl transition-all duration-300 card-hover ${
          canDraw ? 'cursor-crosshair border-indigo-400 pulse-glow' : 'cursor-not-allowed border-gray-300'
        }`}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
};

// Enhanced Game Chat Component
const GameChat: React.FC<{
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isDrawer: boolean;
  gamePhase: string;
  myId: string | null;
  guessedCorrectly: string[];
}> = ({ messages, onSendMessage, isDrawer, gamePhase, myId, guessedCorrectly }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ensure guessedCorrectly is always an array
  const safeGuessedCorrectly = guessedCorrectly || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isDrawer && gamePhase === 'playing' && !safeGuessedCorrectly.includes(myId || '')) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  // Check if user has already guessed correctly
  const hasGuessedCorrectly = Boolean(myId && safeGuessedCorrectly.includes(myId));

  return (
    <div className="bg-white border-2 border-indigo-200 rounded-3xl p-6 h-96 flex flex-col shadow-2xl card-hover backdrop-blur-sm bg-opacity-95">
      <h3 className="text-xl font-bold mb-4 text-indigo-800 flex items-center">
        💬 Game Chat
      </h3>
      <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2">
        {(messages || []).map((msg) => {
          // Hide correct answers from other players (but show to the person who guessed it)
          const shouldHideMessage = msg.isCorrect && msg.userId !== myId;
          
          return (
            <div
              key={msg.id}
              className={`p-3 rounded-xl text-sm transition-all duration-300 transform hover:scale-105 ${
                shouldHideMessage
                  ? 'bg-gradient-to-r from-gray-100 to-gray-100 text-gray-500'
                  : msg.isGuess
                  ? msg.isCorrect
                    ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-l-4 border-green-500 shadow-lg animate-bounce-once'
                    : 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border-l-4 border-amber-500'
                  : 'bg-gradient-to-r from-slate-100 to-gray-100 text-slate-800'
              }`}
            >
              <span className="font-bold text-indigo-600">{msg.userId.slice(0, 8)}:</span>{' '}
              <span className={msg.isCorrect && !shouldHideMessage ? 'font-bold' : ''}>
                {shouldHideMessage ? '✅ guessed correctly!' : msg.message}
              </span>
              {msg.isCorrect && !shouldHideMessage && <span className="ml-2">🎉</span>}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            isDrawer
              ? "🎨 You're drawing! Others will guess."
              : hasGuessedCorrectly
              ? '✅ You guessed correctly! Wait for next round.'
              : gamePhase === 'playing'
              ? '💭 Type your guess...'
              : '⏳ Game not active'
          }
          disabled={isDrawer || gamePhase !== 'playing' || hasGuessedCorrectly}
          className="flex-1 px-4 py-3 border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 transition-all duration-200 shadow-inner"
        />
        <button
          type="submit"
          disabled={isDrawer || gamePhase !== 'playing' || !inputValue.trim() || hasGuessedCorrectly}
          className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl hover:from-indigo-600 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 font-medium transition-all duration-200 transform hover:scale-105 disabled:transform-none shadow-lg btn-glow"
        >
          Send
        </button>
      </form>
    </div>
  );
};

// Enhanced Player List Component
const PlayerList: React.FC<{ 
  players: Player[]; 
  gameState: GameState; 
  onLeaveLobby?: () => void;
  connectedWallet?: string | null;
  onDisconnectWallet?: () => void;
}> = ({ 
  players, 
  gameState, 
  onLeaveLobby,
  connectedWallet,
  onDisconnectWallet
}) => {
  return (
    <div className="bg-white border-2 border-indigo-200 rounded-3xl p-6 shadow-2xl card-hover backdrop-blur-sm bg-opacity-95">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-indigo-800 flex items-center">
          👥 Players ({players.length}/9)
        </h3>
        <div className="flex gap-2">
          {connectedWallet && onDisconnectWallet && (
            <button
              onClick={onDisconnectWallet}
              className="px-3 py-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md btn-glow"
              title="Disconnect Wallet"
            >
              Disconnect
            </button>
          )}
          {onLeaveLobby && (
            <button
              onClick={onLeaveLobby}
              className="px-3 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md btn-glow"
            >
              Leave
            </button>
          )}
        </div>
      </div>
      
      {connectedWallet && (
        <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
          <div className="text-sm">
            <span className="font-medium text-blue-800">Connected Wallet:</span>
            <br />
            <span className="font-mono text-blue-600">{connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)}</span>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {players.map((player) => (
          <div
            key={player.id}
            className={`flex justify-between items-center p-4 rounded-xl transition-all duration-300 card-hover ${
              gameState.currentDrawer === player.id
                ? 'bg-gradient-to-r from-indigo-100 via-purple-100 to-indigo-100 border-2 border-indigo-500 shadow-xl transform scale-105 pulse-glow'
                : 'bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 hover:from-slate-100 hover:to-gray-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  player.hasPaid ? 'bg-gradient-to-r from-green-400 to-green-600 shadow-lg pulse-glow' : 'bg-gradient-to-r from-red-400 to-red-500'
                }`}
              />
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 text-sm">
                  {player.nickname}
                </span>
                {gameState.lobbyOwner === player.id && (
                  <span className="text-xl animate-bounce-once" title="Lobby Owner">👑</span>
                )}
                {gameState.currentDrawer === player.id && (
                  <span className="text-lg animate-pulse" title="Currently Drawing">🎨</span>
                )}
              </div>
            </div>
            <span className="text-sm font-black text-indigo-600 bg-gradient-to-r from-indigo-100 to-purple-100 px-3 py-1 rounded-full shadow-inner">
              {player.score}pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Game Component
const GuessMyDrawingGame: React.FC<{ sessionCode: string; wagerAmount: number }> = ({ sessionCode, wagerAmount }) => {
  const myId = useMyId();
  const allNicknames = useAllNicknames();
  const { user, authenticated, ready, login, logout } = usePrivy();

  // Wallet state
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [ethProvider, setEthProvider] = useState<any>(null);
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [isDistributingPrize, setIsDistributingPrize] = useState<boolean>(false);
  const [prizeDistributionTx, setPrizeDistributionTx] = useState<string | null>(null);
  const [contractGameInfo, setContractGameInfo] = useState<GameInfo | null>(null);

  // Game state with optimistic updates
  const [gameState, setGameState] = useStateTogether<GameState>('gameState', {
    phase: 'lobby',
    currentRound: 0,
    totalRounds: 3,
    currentDrawer: null,
    currentWord: null,
    timeRemaining: 60,
    roundStartTime: 0,
    scores: {},
    wagerAmount: wagerAmount, // Set from props and immutable
    lobbyOwner: '',
    guessedCorrectly: [],
    sessionCode: sessionCode,
    createdAt: Date.now()
  });

  const [drawingPaths, setDrawingPaths] = useStateTogether<DrawingPath[]>('drawingPaths', []);
  const [players, setPlayers] = useStateTogether<Record<string, Player>>('players', {});
  const [chatMessages, setChatMessages] = useStateTogether<ChatMessage[]>('chatMessages', []);
  const [usedWords, setUsedWords] = useStateTogether<string[]>('usedWords', []); // Track used words

  // Local state
  const [currentColor, setCurrentColor] = useState('#4f46e5');
  const [strokeWidth, setStrokeWidth] = useState(4);

  // Optimistic state
  const optimisticGameStateRef = useRef<Partial<GameState> | null>(null);

  // Get consistent user ID - prioritize connectedWallet over Privy wallet
  const consistentUserId = getConsistentUserId(user, connectedWallet);

  // Get current player using wallet-based key
  const currentPlayerKey = connectedWallet ? `wallet:${connectedWallet.toLowerCase()}` : null;
  const currentPlayer = currentPlayerKey ? players[currentPlayerKey] : null;
  const isDrawer = Boolean(currentPlayerKey && gameState.currentDrawer === currentPlayerKey);
  const canDraw = isDrawer && gameState.phase === 'playing';

  // Disconnect wallet function
  const disconnectWallet = async () => {
    setConnectedWallet(null);
    // Update player info to remove wallet address
    if (currentPlayerKey && players[currentPlayerKey]) {
      setPlayers(prev => ({
        ...prev,
        [currentPlayerKey]: { ...prev[currentPlayerKey], walletAddress: '', hasPaid: false, isReady: false }
      }));
    }
  };

  // Detect ethereum provider
  useEffect(() => {
    const detectProvider = async () => {
      try {
        const provider = await detectEthereumProvider();
        setEthProvider(provider);
        
        if (provider && provider.request) {
          try {
            const accounts = await provider.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
              setConnectedWallet(accounts[0]);
            }
          } catch (error) {
            console.log('Could not get accounts:', error);
          }
        }
      } catch (error) {
        console.error('Failed to detect ethereum provider:', error);
      }
    };

    detectProvider();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (ethProvider && ethProvider.on) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setConnectedWallet(accounts[0]);
        } else {
          setConnectedWallet(null);
        }
      };

      ethProvider.on('accountsChanged', handleAccountsChanged);
      
      return () => {
        if (ethProvider.removeListener) {
          ethProvider.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, [ethProvider]);

  // Sync with Privy wallet if available and no ethereum provider wallet
  useEffect(() => {
    if (user?.wallet?.address && !connectedWallet) {
      setConnectedWallet(user.wallet.address);
    }
  }, [user?.wallet?.address, connectedWallet]);

  // Timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (gameState.phase === 'playing' && gameState.timeRemaining > 0) {
      interval = setInterval(() => {
        setGameState(prev => ({
          ...prev,
          timeRemaining: Math.max(0, prev.timeRemaining - 1)
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState.phase, gameState.timeRemaining, setGameState]);

  // Auto-advance round when time runs out OR everyone has guessed correctly
  useEffect(() => {
    if (gameState.phase === 'playing' && gameState.lobbyOwner === currentPlayerKey && gameState.timeRemaining >= 0) {
      const activePlayers = Object.values(players).filter((p: Player) => p.hasPaid && p.isReady);
      const nonDrawerPlayers = activePlayers.filter((p: Player) => p.id !== gameState.currentDrawer);
      const safeGuessedCorrectly = gameState.guessedCorrectly || [];
      const allGuessedCorrectly = nonDrawerPlayers.length > 0 && 
        nonDrawerPlayers.every(p => safeGuessedCorrectly.includes(p.id));
      
      console.log('🔍 Round advance check:', {
        timeRemaining: gameState.timeRemaining,
        allGuessedCorrectly,
        nonDrawerPlayers: nonDrawerPlayers.length,
        guessedCount: safeGuessedCorrectly.length,
        nextRoundTriggered: window.nextRoundTriggered
      });
      
      if ((gameState.timeRemaining === 0 || allGuessedCorrectly) && !window.nextRoundTriggered) {
        console.log('🚀 Triggering next round...');
        window.nextRoundTriggered = true;
        setTimeout(() => {
          nextRound();
          // Reset the flag after delay
          setTimeout(() => { 
            window.nextRoundTriggered = false; 
            console.log('🔄 Reset nextRoundTriggered flag');
          }, 2000);
        }, 3000);
      }
    }
  }, [
    gameState.timeRemaining, 
    gameState.phase, 
    gameState.lobbyOwner, 
    gameState.currentDrawer,
    gameState.guessedCorrectly?.length, // Track changes in guessed correctly count
    currentPlayerKey, 
    Object.keys(players).length // Track player count changes
  ]);

  // Initialize player when connecting - fix lobby owner logic
  useEffect(() => {
    if (myId && authenticated && user && connectedWallet) {
      // Use wallet address as the player key instead of myId
      const playerKey = `wallet:${connectedWallet.toLowerCase()}`;
      
      if (!players[playerKey]) {
        // Check if this wallet is already used by another player key
        const existingPlayerWithWallet = Object.values(players).find(
          (p: Player) => p.walletAddress && p.walletAddress.toLowerCase() === connectedWallet.toLowerCase()
        );
        
        if (existingPlayerWithWallet) {
          alert(`This wallet address is already connected by another player (${existingPlayerWithWallet.nickname}). Please use a different wallet or disconnect from the other session.`);
          disconnectWallet();
          return;
        }
        
        const joinTimestamp = Date.now();
        const newPlayer: Player = {
          id: playerKey, // Use wallet-based ID
          nickname: allNicknames[myId] || `Player ${connectedWallet.slice(0, 6)}`,
          score: 0,
          hasPaid: false,
          isReady: false,
          walletAddress: connectedWallet,
          joinedAt: joinTimestamp
        };
        
        setPlayers(prev => {
          const updatedPlayers = { ...prev, [playerKey]: newPlayer };
          
          // Determine who should be lobby owner based on join timestamps
          const allPlayers = Object.values(updatedPlayers);
          const earliestPlayer = allPlayers.reduce((earliest: Player, current: Player) => 
            current.joinedAt < earliest.joinedAt ? current : earliest
          );
          
          console.log('🏆 Lobby Owner Assignment:');
          console.log('Current player:', playerKey, 'joined at:', new Date(joinTimestamp).toLocaleTimeString());
          console.log('All players and join times:');
          allPlayers.forEach(p => {
            console.log(`  ${p.id}: ${new Date(p.joinedAt).toLocaleTimeString()}`);
          });
          console.log('Earliest player (should be lobby owner):', earliestPlayer.id);
          console.log('Current lobby owner:', gameState.lobbyOwner);
          
          // Set lobby owner to the player who joined earliest
          if (!gameState.lobbyOwner || gameState.lobbyOwner !== earliestPlayer.id) {
            console.log('🔄 Updating lobby owner to:', earliestPlayer.id);
            setGameState(prev => ({ ...prev, lobbyOwner: earliestPlayer.id }));
          }
          
          return updatedPlayers;
        });
      }
    }
  }, [myId, players, allNicknames, setPlayers, gameState.lobbyOwner, setGameState, authenticated, user, connectedWallet, disconnectWallet]);

  // Additional effect to verify lobby owner when players change
  useEffect(() => {
    const allPlayers = Object.values(players);
    if (allPlayers.length > 0) {
      const earliestPlayer = allPlayers.reduce((earliest: Player, current: Player) => 
        current.joinedAt < earliest.joinedAt ? current : earliest
      );
      
      // Correct lobby owner if it's wrong
      if (gameState.lobbyOwner && gameState.lobbyOwner !== earliestPlayer.id) {
        console.log('🔧 Correcting lobby owner from', gameState.lobbyOwner, 'to', earliestPlayer.id);
        setGameState(prev => ({ ...prev, lobbyOwner: earliestPlayer.id }));
      } else if (!gameState.lobbyOwner && allPlayers.length > 0) {
        console.log('🔧 Setting initial lobby owner to', earliestPlayer.id);
        setGameState(prev => ({ ...prev, lobbyOwner: earliestPlayer.id }));
      }
    }
  }, [Object.keys(players).length, gameState.lobbyOwner]);

  // Update player wallet address when connectedWallet changes
  useEffect(() => {
    if (myId && connectedWallet) {
      const playerKey = `wallet:${connectedWallet.toLowerCase()}`;
      
      // Remove old entries for this myId that don't match current wallet
      Object.keys(players).forEach(key => {
        if (key !== playerKey && players[key].walletAddress === connectedWallet) {
          setPlayers(prev => {
            const newPlayers = { ...prev };
            delete newPlayers[key];
            return newPlayers;
          });
        }
      });
      
      // Update current player entry
      if (players[playerKey] && players[playerKey].walletAddress !== connectedWallet) {
        setPlayers(prev => ({
          ...prev,
          [playerKey]: { ...prev[playerKey], walletAddress: connectedWallet }
        }));
      }
    }
  }, [myId, connectedWallet, players, setPlayers, disconnectWallet]);

  // Blockchain functions
  const switchToMonadTestnet = async () => {
    const provider = ethProvider || (window as any).ethereum;
    if (!provider) {
      throw new Error('No wallet found');
    }

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: MONAD_TESTNET.chainId }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [MONAD_TESTNET],
        });
      } else {
        throw switchError;
      }
    }
  };

  const payWager = async () => {
    if (!connectedWallet || !currentPlayerKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (isPaying) return;
    setIsPaying(true);

    try {
      await switchToMonadTestnet();
      
      const provider = new ethers.BrowserProvider(ethProvider || (window as any).ethereum);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      
      console.log('🔍 Debug Info:');
      console.log('Connected Wallet:', connectedWallet);
      console.log('Current Player Key:', currentPlayerKey);
      console.log('Signer Address:', signerAddress);
      console.log('Session Code:', gameState.sessionCode);
      console.log('Wager Amount:', gameState.wagerAmount);
      console.log('Lobby Owner:', gameState.lobbyOwner);
      
      // Check if contract address is set
      if ((GAME_ESCROW_ADDRESS as string) === ZERO_ADDRESS) {
        alert('Smart contract not deployed yet. Please deploy GameEscrow contract first.');
        return;
      }
      
      // Verify wallet addresses match
      if (signerAddress.toLowerCase() !== connectedWallet.toLowerCase()) {
        alert(`Wallet mismatch detected!\nConnected: ${connectedWallet}\nSigner: ${signerAddress}\n\nPlease refresh and reconnect your wallet.`);
        return;
      }
      
      // Create contract instance
      const gameEscrowContract = new ethers.Contract(GAME_ESCROW_ADDRESS, GAME_ESCROW_ABI, signer);
      
      // Check if game exists in contract with retry logic
      let gameInfo;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          gameInfo = await gameEscrowContract.getGameInfo(gameState.sessionCode);
          console.log('📋 Game Info from Contract (attempt', attempts + 1, '):', gameInfo);
          
          if (gameInfo.owner === ZERO_ADDRESS) {
            // Game doesn't exist, create it if we're the lobby owner
            if (gameState.lobbyOwner === currentPlayerKey) {
              console.log('🎮 Creating game in smart contract...');
              const wagerWei = ethers.parseEther(gameState.wagerAmount.toString());
              const createTx = await gameEscrowContract.createGame(gameState.sessionCode, wagerWei);
              console.log('⏳ Create transaction sent:', createTx.hash);
              await createTx.wait();
              console.log('✅ Game created in smart contract!');
              
              // Fetch updated game info
              gameInfo = await gameEscrowContract.getGameInfo(gameState.sessionCode);
              console.log('📋 Updated Game Info:', gameInfo);
              break;
            } else {
              // Wait a bit and retry - lobby owner might be creating the game
              console.log('⏳ Waiting for lobby owner to create game... (attempt', attempts + 1, ')');
              await new Promise(resolve => setTimeout(resolve, 2000));
              attempts++;
              continue;
            }
          } else {
            // Game exists, proceed
            break;
          }
        } catch (contractError: any) {
          console.error('❌ Contract interaction error (attempt', attempts + 1, '):', contractError);
          if (attempts === maxAttempts - 1) {
            alert(`Contract error: ${contractError.message || 'Unknown contract error'}`);
            return;
          }
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!gameInfo || gameInfo.owner === ZERO_ADDRESS) {
        alert('Game could not be created in smart contract. Please try again or ask the lobby owner to create it first.');
        return;
      }
      
      // Check if player already deposited
      const hasDeposited = await gameEscrowContract.hasPlayerDeposited(gameState.sessionCode, signerAddress);
      if (hasDeposited) {
        alert('You have already deposited your wager for this game.');
        return;
      }
      
      // Verify wager amount matches
      const contractWagerWei = gameInfo.wagerAmount;
      const expectedWagerWei = ethers.parseEther(gameState.wagerAmount.toString());
      if (contractWagerWei.toString() !== expectedWagerWei.toString()) {
        alert(`Wager amount mismatch!\nContract: ${ethers.formatEther(contractWagerWei)} MON\nExpected: ${gameState.wagerAmount} MON`);
        return;
      }
      
      // Deposit wager to the smart contract
      const wagerWei = ethers.parseEther(gameState.wagerAmount.toString());
      console.log(`💰 Depositing ${gameState.wagerAmount} MON to smart contract...`);
      
      try {
        // Try to estimate gas first to catch errors early
        const gasEstimate = await gameEscrowContract.depositWager.estimateGas(gameState.sessionCode, {
          value: wagerWei
        });
        console.log('⛽ Gas estimate:', gasEstimate.toString());
        
        // Send the actual transaction
        const tx = await gameEscrowContract.depositWager(gameState.sessionCode, {
          value: wagerWei,
          gasLimit: gasEstimate * 120n / 100n // Add 20% buffer
        });

        // Optimistic update
        setPlayers(prev => ({
          ...prev,
          [currentPlayerKey]: { ...prev[currentPlayerKey], hasPaid: true, isReady: true, paymentTxHash: tx.hash }
        }));

        console.log('⏳ Transaction sent:', tx.hash);
        await tx.wait();
        console.log('✅ Wager deposited to smart contract!');
        
      } catch (txError) {
        console.error('❌ Transaction error:', txError);
        throw txError;
      }
      
    } catch (error: any) {
      console.error('💥 Payment failed:', error);
      
      // Revert optimistic update on error
      setPlayers(prev => ({
        ...prev,
        [currentPlayerKey]: { ...prev[currentPlayerKey], hasPaid: false, isReady: false, paymentTxHash: undefined }
      }));

      // More specific error handling
      if (error.message?.includes('insufficient funds')) {
        const userConfirmed = confirm(
          '❌ Insufficient funds! You need testnet MON tokens to pay.\n\n' +
          '🎁 Click OK to get free testnet MON from the faucet, or Cancel to try again later.'
        );
        
        if (userConfirmed) {
          window.open('https://faucet.monad.xyz', '_blank');
        }
      } else if (error.message?.includes('Player has already deposited')) {
        alert('You have already deposited your wager for this game.');
      } else if (error.message?.includes('user rejected transaction')) {
        // User cancelled, don't show error
        console.log('User cancelled transaction');
      } else if (error.message?.includes('missing revert data')) {
        alert(`Transaction failed with missing revert data. This usually means:\n\n` +
              `• Game doesn't exist in contract\n` +
              `• Wallet address mismatch\n` +
              `• Insufficient gas or funds\n\n` +
              `Debug info:\n` +
              `Connected: ${connectedWallet}\n` +
              `Session: ${gameState.sessionCode}\n` +
              `Wager: ${gameState.wagerAmount} MON`);
      } else {
        alert(`Payment failed: ${error.message || 'Unknown error'}\n\nCheck console for details.`);
      }
    } finally {
      setIsPaying(false);
    }
  };

  // Helper function to get a random unused word
  const getRandomWord = () => {
    const availableWords = WORD_BANK.filter(word => !usedWords.includes(word));
    
    // If all words have been used, reset the used words list
    if (availableWords.length === 0) {
      setUsedWords([]);
      return WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
    }
    
    const selectedWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    setUsedWords(prev => [...prev, selectedWord]);
    return selectedWord;
  };

  // Game functions with optimistic updates
  const startGame = () => {
    if (gameState.lobbyOwner !== currentPlayerKey) {
      console.log('❌ Not lobby owner. Lobby owner:', gameState.lobbyOwner, 'Current:', currentPlayerKey);
      return;
    }
    
    const readyPlayers = Object.values(players).filter((p: Player) => p.hasPaid && p.isReady);
    if (readyPlayers.length < 2) {
      alert('Need at least 2 players to start!');
      return;
    }

    const firstDrawer = readyPlayers[0];
    const word = getRandomWord();

    console.log('🎮 Starting game with word:', word, 'drawer:', firstDrawer.id);

    // Reset used words for new game
    setUsedWords([word]);

    // Optimistic update
    optimisticGameStateRef.current = {
      phase: 'playing',
      currentRound: 1,
      currentDrawer: firstDrawer.id,
      currentWord: word,
      timeRemaining: 60,
      roundStartTime: Date.now(),
      guessedCorrectly: []
    };

    setGameState(prev => ({
      ...prev,
      phase: 'playing',
      currentRound: 1,
      currentDrawer: firstDrawer.id,
      currentWord: word,
      timeRemaining: 60,
      roundStartTime: Date.now(),
      guessedCorrectly: []
    }));

    setDrawingPaths([]);
  };

  const nextRound = () => {
    if (gameState.lobbyOwner !== currentPlayerKey) {
      console.log('❌ Not lobby owner for nextRound. Lobby owner:', gameState.lobbyOwner, 'Current:', currentPlayerKey);
      return;
    }

    const readyPlayers = Object.values(players).filter((p: Player) => p.hasPaid && p.isReady);
    const currentDrawerIndex = readyPlayers.findIndex((p: Player) => p.id === gameState.currentDrawer);
    const nextDrawerIndex = (currentDrawerIndex + 1) % readyPlayers.length;

    if (gameState.currentRound >= gameState.totalRounds) {
      // Game finished - automatically distribute prize to winner
      console.log('🏁 Game finished, moving to finished phase');
      setGameState(prev => ({ ...prev, phase: 'finished' }));
      // Auto-distribute prize after a short delay
      setTimeout(() => distributePrizeToWinner(), 2000);
      return;
    }

    const nextDrawer = readyPlayers[nextDrawerIndex];
    const word = getRandomWord();

    console.log('➡️ Next round:', gameState.currentRound + 1, 'word:', word, 'drawer:', nextDrawer.id);

    // Optimistic update
    optimisticGameStateRef.current = {
      currentRound: gameState.currentRound + 1,
      currentDrawer: nextDrawer.id,
      currentWord: word,
      timeRemaining: 60,
      roundStartTime: Date.now(),
      guessedCorrectly: []
    };

    setGameState(prev => ({
      ...prev,
      currentRound: prev.currentRound + 1,
      currentDrawer: nextDrawer.id,
      currentWord: word,
      timeRemaining: 60,
      roundStartTime: Date.now(),
      guessedCorrectly: []
    }));

    setDrawingPaths([]);
  };

  // Prize distribution function using smart contract
  const distributePrizeToWinner = async () => {
    if (!ethProvider || !connectedWallet) {
      console.error('No ethereum provider or wallet connected');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(ethProvider);
      const signer = await provider.getSigner();
      const gameEscrowContract = new ethers.Contract(GAME_ESCROW_ADDRESS, GAME_ESCROW_ABI, signer);
      
      // First, check who the contract owner is
      const gameInfo = await gameEscrowContract.getGameInfo(gameState.sessionCode);
      const contractOwner = gameInfo.owner;
      const currentWallet = await signer.getAddress();
      
      console.log('🔍 Prize Distribution Debug:');
      console.log('Contract Owner:', contractOwner);
      console.log('Current Wallet:', currentWallet);
      console.log('Lobby Owner (game state):', gameState.lobbyOwner);
      
      // Check if current wallet is the contract owner
      if (contractOwner.toLowerCase() !== currentWallet.toLowerCase()) {
        console.error('❌ Wallet mismatch: Current wallet is not the game creator in smart contract');
        alert(`❌ Only the game creator can distribute prizes!\n\nGame Creator: ${contractOwner.slice(0, 6)}...${contractOwner.slice(-4)}\nYour Wallet: ${currentWallet.slice(0, 6)}...${currentWallet.slice(-4)}\n\nPlease connect with the wallet that created this game.`);
        return;
      }
      
      const winner = Object.values(players).reduce((prev: Player, current: Player) => 
        (current.score > prev.score) ? current : prev
      );

      if (!winner.walletAddress) {
        console.error('Winner does not have a wallet address');
        alert('❌ Winner does not have a wallet address. Cannot distribute prize.');
        return;
      }

      setIsDistributingPrize(true);
      
      console.log(`🏆 Distributing prize to winner: ${winner.walletAddress}`);

      // Call smart contract to distribute prize
      const tx = await gameEscrowContract.distributePrize(gameState.sessionCode, winner.walletAddress);
      
      setPrizeDistributionTx(tx.hash);
      console.log(`💰 Prize distribution transaction: ${tx.hash}`);
      
      await tx.wait();
      console.log('✅ Prize distribution confirmed!');
      
      // Get final game info from contract
      const finalGameInfo = await gameEscrowContract.getGameInfo(gameState.sessionCode);
      console.log('Final game info:', finalGameInfo);
      
    } catch (error: any) {
      console.error('Prize distribution failed:', error);
      
      // More specific error messages
      if (error.message?.includes('Only game owner can call this')) {
        alert('❌ Only the game creator can distribute prizes!\n\nPlease connect with the wallet that originally created this game in the smart contract.');
      } else if (error.message?.includes('Game not finished')) {
        alert('❌ Game is not finished yet. Complete all rounds first.');
      } else if (error.message?.includes('Prize already distributed')) {
        alert('ℹ️ Prize has already been distributed for this game.');
      } else {
        alert(`Prize distribution failed: ${error.message || 'Unknown error'}\n\nCheck console for details.`);
      }
      
      // Don't revert game state - still show finished screen
    } finally {
      setIsDistributingPrize(false);
    }
  };

  const sendChatMessage = (message: string) => {
    if (!currentPlayerKey || !gameState.currentWord) return;

    const isGuess = gameState.phase === 'playing' && gameState.currentDrawer !== currentPlayerKey;
    const isCorrect = isGuess && message.toLowerCase() === gameState.currentWord.toLowerCase();
    const safeGuessedCorrectly = gameState.guessedCorrectly || [];

    // Prevent multiple guesses after already guessing correctly
    if (isGuess && safeGuessedCorrectly.includes(currentPlayerKey)) {
      return; // Don't allow more guesses
    }

    const chatMessage: ChatMessage = {
      id: `${currentPlayerKey}-${Date.now()}`,
      userId: currentPlayerKey,
      message,
      timestamp: Date.now(),
      isGuess,
      isCorrect
    };

    setChatMessages(prev => [...prev, chatMessage]);

    if (isCorrect && !safeGuessedCorrectly.includes(currentPlayerKey)) {
      const timeBonus = Math.max(0, Math.floor((gameState.timeRemaining / 60) * 20));
      const positionBonus = [100, 80, 60, 40][safeGuessedCorrectly.length] || 40;
      const totalPoints = positionBonus + timeBonus;

      // Optimistic updates
      setGameState(prev => ({
        ...prev,
        scores: {
          ...prev.scores,
          [currentPlayerKey]: (prev.scores[currentPlayerKey] || 0) + totalPoints,
          [prev.currentDrawer!]: (prev.scores[prev.currentDrawer!] || 0) + 20
        },
        guessedCorrectly: [...(prev.guessedCorrectly || []), currentPlayerKey]
      }));

      setPlayers(prev => ({
        ...prev,
        [currentPlayerKey]: { ...prev[currentPlayerKey], score: (prev[currentPlayerKey]?.score || 0) + totalPoints }
      }));
    }
  };

  const leaveLobby = () => {
    if (confirm('Are you sure you want to leave the lobby?')) {
      window.location.reload();
    }
  };

  // Fetch contract game info with improved refresh
  const fetchContractGameInfo = async () => {
    if (!ethProvider) return;
    
    try {
      const provider = new ethers.BrowserProvider(ethProvider);
      const gameEscrowContract = new ethers.Contract(GAME_ESCROW_ADDRESS, GAME_ESCROW_ABI, provider);
      const gameInfo = await gameEscrowContract.getGameInfo(gameState.sessionCode);
      
      setContractGameInfo({
        owner: gameInfo.owner,
        wagerAmount: gameInfo.wagerAmount,
        totalDeposits: gameInfo.totalDeposits,
        playerCount: gameInfo.playerCount,
        isFinished: gameInfo.isFinished,
        winner: gameInfo.winner
      });
    } catch (error) {
      console.error('Failed to fetch contract game info:', error);
    }
  };

  // Fetch contract info when game state changes and periodically
  useEffect(() => {
    if (gameState.sessionCode && ethProvider) {
      fetchContractGameInfo();
      
      // Refresh contract info every 10 seconds during gameplay
      const interval = setInterval(fetchContractGameInfo, 10000);
      return () => clearInterval(interval);
    }
  }, [gameState.sessionCode, ethProvider]);

  // Additional refresh when players change (for deposit tracking)
  useEffect(() => {
    if (gameState.sessionCode && ethProvider && Object.keys(players).length > 0) {
      fetchContractGameInfo();
    }
  }, [Object.keys(players).length, gameState.sessionCode, ethProvider]);

  // Authentication check
  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-2xl p-8 card-hover">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center card-hover">
          <div className="text-6xl mb-6 animate-bounce-once">🎨</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Guess My Drawing
          </h1>
          <p className="text-gray-600 mb-8">
            A multiplayer drawing & guessing game with blockchain wagering on Monad Testnet
          </p>
          <button
            onClick={login}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg btn-glow"
          >
            🚀 Connect Wallet & Play
          </button>
        </div>
      </div>
    );
  }

  // Render different phases
  if (gameState.phase === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-3xl shadow-2xl p-6 mb-6 card-hover backdrop-blur-sm bg-opacity-95">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 flex items-center gap-3">
                  🎨 <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Guess My Drawing</span>
                </h1>
                <p className="text-gray-600 mt-2">Session: <span className="font-mono font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded">{gameState.sessionCode}</span></p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Connected as</p>
                  <p className="font-bold text-indigo-600">
                    {connectedWallet ? 
                      `${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}` : 
                      user?.id ? `${user.id.slice(0, 6)}...${user.id.slice(-4)}` : 'Unknown'
                    }
                  </p>
                  {connectedWallet && (
                    <p className="text-xs text-green-600">✅ Wallet</p>
                  )}
                </div>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 btn-glow"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-white rounded-3xl shadow-2xl p-8 card-hover backdrop-blur-sm bg-opacity-95">
                <h3 className="text-2xl font-bold mb-6 text-indigo-800 flex items-center gap-2">
                  ⚙️ Game Setup
                </h3>
                
                {/* Show fixed wager amount */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-2xl border-2 border-indigo-200 shadow-inner">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-sm text-indigo-600 font-medium">Wager per Player</p>
                      <p className="text-2xl font-bold text-indigo-800">{gameState.wagerAmount} MON</p>
                    </div>
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Total Prize Pool</p>
                      <p className="text-2xl font-bold text-purple-800">
                        {contractGameInfo ? 
                          ethers.formatEther(contractGameInfo.totalDeposits) : 
                          (gameState.wagerAmount * Object.keys(players).length).toFixed(3)
                        } MON
                      </p>
                    </div>
                  </div>
                  <p className="text-center text-sm text-gray-600 mt-3">
                    💡 {contractGameInfo ? 'Secured by smart contract' : 'Wager amount fixed by lobby creator'}
                  </p>
                  
                  {/* Contract Status */}
                  {contractGameInfo && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <p className="text-green-800 text-xs font-medium text-center">
                        🔒 Smart Contract Active: {contractGameInfo.playerCount.toString()}/{Object.keys(players).length} players deposited
                      </p>
                    </div>
                  )}
                  
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-4 card-hover backdrop-blur-sm bg-opacity-95">
                {!connectedWallet ? (
                  <div className="text-center py-4 bg-gradient-to-r from-orange-100 to-yellow-100 rounded-2xl border-2 border-orange-300 shadow-inner">
                    <p className="text-orange-700 font-bold text-lg mb-3">⚠️ Wallet Required</p>
                    <p className="text-orange-600 text-sm">Please connect your wallet to participate</p>
                    {user?.wallet?.address && (
                      <p className="text-orange-500 text-xs mt-2">
                        Privy wallet detected: {user.wallet.address.slice(0, 6)}...{user.wallet.address.slice(-4)}
                        <br />But browser wallet not connected
                      </p>
                    )}
                  </div>
                ) : !currentPlayer?.hasPaid ? (
                  <button
                    onClick={payWager}
                    disabled={isPaying}
                    className="w-full py-4 bg-gradient-success text-white rounded-2xl font-bold text-lg hover:opacity-90 transition-all duration-300 transform hover:scale-105 shadow-lg btn-glow disabled:opacity-50"
                  >
                    {isPaying ? '⏳ Processing...' : `💳 Pay Wager (${gameState.wagerAmount} MON)`}
                  </button>
                ) : (
                  <div className="text-center py-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-2xl border-2 border-green-300 shadow-inner">
                    <span className="text-green-700 font-bold text-lg">✅ Ready to Play!</span>
                    {currentPlayer.paymentTxHash && (
                      <p className="text-green-600 text-xs mt-1">
                        Tx: {currentPlayer.paymentTxHash.slice(0, 10)}...
                      </p>
                    )}
                  </div>
                )}

                {/* Debug information */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-gray-500 bg-gray-100 p-3 rounded-lg">
                    <p><strong>Debug Info:</strong></p>
                    <p>MyId: {myId}</p>
                    <p>ConnectedWallet: {connectedWallet || 'None'}</p>
                    <p>Privy Wallet: {user?.wallet?.address || 'None'}</p>
                    <p>ConsistentUserId: {consistentUserId}</p>
                    <p>CurrentPlayer WalletAddr: {currentPlayer?.walletAddress || 'None'}</p>
                  </div>
                )}

                {/* Debug information for development */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="text-xs text-gray-500 bg-gray-100 p-3 rounded-lg mb-4">
                    <p><strong>Debug Info:</strong></p>
                    <p>MyId: {myId}</p>
                    <p>ConnectedWallet: {connectedWallet || 'None'}</p>
                    <p>Privy Wallet: {user?.wallet?.address || 'None'}</p>
                    <p>ConsistentUserId: {consistentUserId}</p>
                    <p>CurrentPlayerKey: {currentPlayerKey || 'None'}</p>
                    <p>Lobby Owner: {gameState.lobbyOwner || 'None'}</p>
                    <p>Is Lobby Owner: {(gameState.lobbyOwner === currentPlayerKey).toString()}</p>
                    <p>Ready Players: {Object.values(players).filter((p: Player) => p.hasPaid).length}</p>
                    <p>Total Players: {Object.keys(players).length}</p>
                    <div className="mt-2">
                      <p><strong>Join Order:</strong></p>
                      {Object.values(players)
                        .sort((a, b) => a.joinedAt - b.joinedAt)
                        .map((p, index) => (
                          <p key={p.id} className="ml-2">
                            {index + 1}. {p.id.slice(7, 13)}... at {new Date(p.joinedAt).toLocaleTimeString()}
                            {p.id === gameState.lobbyOwner && ' 👑'}
                          </p>
                        ))}
                    </div>
                  </div>
                )}

                {/* Show start game button with enhanced logic */}
                {gameState.lobbyOwner === currentPlayerKey && connectedWallet && (
                  <div className="space-y-2">
                    <button
                      onClick={startGame}
                      disabled={Object.values(players).filter((p: Player) => p.hasPaid).length < 2}
                      className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-lg hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-300 transform hover:scale-105 disabled:transform-none shadow-lg btn-glow"
                    >
                      🚀 Start Game (Owner Only)
                    </button>
                    <p className="text-xs text-blue-600 text-center">
                      You are the lobby owner
                    </p>
                  </div>
                )}

                {/* Show message for non-owners */}
                {gameState.lobbyOwner !== currentPlayerKey && connectedWallet && (
                  <div className="text-center py-4 bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl border-2 border-gray-300">
                    <p className="text-gray-600 text-sm">⏳ Waiting for lobby owner to start the game</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Owner: {gameState.lobbyOwner ? `${gameState.lobbyOwner.slice(7, 13)}...` : 'Unknown'}
                    </p>
                  </div>
                )}

                {/* Show message if no wallet connected */}
                {!connectedWallet && (
                  <div className="text-center py-4 bg-gradient-to-r from-orange-100 to-yellow-100 rounded-2xl border-2 border-orange-300">
                    <p className="text-orange-600 text-sm">⚠️ Connect wallet to see game controls</p>
                  </div>
                )}
              </div>
            </div>

            <PlayerList 
              players={Object.values(players)} 
              gameState={gameState} 
              onLeaveLobby={leaveLobby}
              connectedWallet={connectedWallet}
              onDisconnectWallet={disconnectWallet}
            />
          </div>
        </div>
      </div>
    );
  }

  if (gameState.phase === 'finished') {
    const winner = Object.values(players).reduce((prev: Player, current: Player) => 
      (current.score > prev.score) ? current : prev
    );

    // Use contract info for prize amount if available, fallback to local calculation
    const actualPrizeAmount = contractGameInfo ? 
      ethers.formatEther(contractGameInfo.totalDeposits) : 
      (gameState.wagerAmount * Object.keys(players).length).toFixed(3);

    return (
      <div className="min-h-screen bg-gradient-primary p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-8 card-hover">
            <h1 className="text-5xl font-bold text-center mb-8 text-gray-800">
              🏆 Game Finished!
            </h1>
            
            <div className="text-center space-y-8">
              <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border-4 border-yellow-400 rounded-3xl p-8 card-hover animate-bounce-once">
                <h2 className="text-4xl font-bold text-yellow-800 mb-4 flex items-center justify-center gap-3">
                  🎉 Winner: {winner.nickname}
                </h2>
                <p className="text-2xl text-yellow-700 font-bold mb-4">
                  Prize: {actualPrizeAmount} MON
                </p>
                
                {/* Smart Contract Info */}
                {contractGameInfo && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4 text-sm">
                    <p className="text-blue-800 font-medium mb-2">📋 Smart Contract Details</p>
                    <div className="grid grid-cols-2 gap-2 text-blue-700">
                      <div>Game Status: {contractGameInfo.isFinished ? '✅ Finished' : '⏳ Active'}</div>
                      <div>Players: {contractGameInfo.playerCount.toString()}</div>
                      <div>Total Deposits: {ethers.formatEther(contractGameInfo.totalDeposits)} MON</div>
                      <div>Contract Winner: {contractGameInfo.winner !== ZERO_ADDRESS ? 
                        `${contractGameInfo.winner.slice(0, 6)}...${contractGameInfo.winner.slice(-4)}` : 'None'}</div>
                    </div>
                  </div>
                )}
                
                {/* Prize Distribution Status */}
                {isDistributingPrize && (
                  <div className="bg-blue-100 border-2 border-blue-300 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-blue-800 font-medium">🤖 Automatically distributing prize via smart contract...</span>
                    </div>
                  </div>
                )}
                
                {prizeDistributionTx && (
                  <div className="bg-green-100 border-2 border-green-300 rounded-xl p-4 mb-4">
                    <p className="text-green-800 font-medium mb-2">💰 Prize Distribution Successful!</p>
                    <p className="text-sm text-green-700">
                      <span className="font-bold">Transaction Hash:</span>
                      <br />
                      <a 
                        href={`https://testnet.monadexplorer.com/tx/${prizeDistributionTx}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-mono text-green-600 hover:text-green-800 underline break-all"
                      >
                        {prizeDistributionTx}
                      </a>
                    </p>
                  </div>
                )}
                
                {!isDistributingPrize && !prizeDistributionTx && (
                  <div className="bg-gray-100 border-2 border-gray-300 rounded-xl p-4 mb-4">
                    <p className="text-gray-700 text-sm">
                      🤖 Prize distribution is automatic! Please wait a moment...
                    </p>
                  </div>
                )}
              </div>

              <PlayerList 
                players={Object.values(players)} 
                gameState={gameState}
                connectedWallet={connectedWallet}
                onDisconnectWallet={disconnectWallet}
              />

              <button
                onClick={() => window.location.reload()}
                className="py-4 px-8 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg btn-glow"
              >
                🔄 Play Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Playing phase
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Game Header */}
        <div className="bg-white rounded-3xl shadow-2xl p-6 mb-6 card-hover backdrop-blur-sm bg-opacity-95">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              🎨 <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Guess My Drawing</span>
            </h1>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Round</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {gameState.currentRound}/{gameState.totalRounds}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600">Time</p>
                <p className={`text-3xl font-black ${gameState.timeRemaining <= 10 ? 'text-red-500 animate-pulse pulse-glow' : 'text-blue-600'}`}>
                  {gameState.timeRemaining}s
                </p>
              </div>
              <button
                onClick={leaveLobby}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 text-sm btn-glow"
              >
                Leave Game
              </button>
            </div>
          </div>
          
          {isDrawer && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border-2 border-blue-200 card-hover">
              <p className="text-blue-800 text-center">
                <span className="font-bold">🎯 Your word:</span>{' '}
                <span className="text-2xl font-black text-indigo-700 bg-white px-4 py-2 rounded-xl shadow-lg pulse-glow">
                  {gameState.currentWord}
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Canvas and Tools */}
          <div className="lg:col-span-3 space-y-6">
            {/* Drawing Tools */}
            {isDrawer && (
              <div className="bg-white rounded-2xl shadow-xl p-6 card-hover backdrop-blur-sm bg-opacity-95">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  🎨 Drawing Tools
                </h3>
                <div className="flex items-center gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Color</label>
                    <input
                      type="color"
                      value={currentColor}
                      onChange={(e) => setCurrentColor(e.target.value)}
                      className="w-16 h-12 border-2 border-gray-300 rounded-xl cursor-pointer hover:border-indigo-400 transition-all duration-200 shadow-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Brush Size: {strokeWidth}px
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="30"
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                      className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    />
                  </div>
                  <button
                    onClick={() => setDrawingPaths([])}
                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 font-bold transition-all duration-200 transform hover:scale-105 shadow-lg btn-glow"
                  >
                    🗑️ Clear
                  </button>
                </div>
              </div>
            )}

            {/* Canvas */}
            <div className="bg-white rounded-3xl shadow-2xl p-6 card-hover">
              <DrawingCanvas
                paths={drawingPaths}
                setPaths={setDrawingPaths}
                canDraw={canDraw}
                color={currentColor}
                strokeWidth={strokeWidth}
                currentPlayerKey={currentPlayerKey}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <PlayerList 
              players={Object.values(players)} 
              gameState={gameState} 
              onLeaveLobby={leaveLobby}
              connectedWallet={connectedWallet}
              onDisconnectWallet={disconnectWallet}
            />
            <GameChat
              messages={chatMessages || []}
              onSendMessage={sendChatMessage}
              isDrawer={isDrawer}
              gamePhase={gameState.phase}
              myId={currentPlayerKey}
              guessedCorrectly={gameState.guessedCorrectly || []}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// Session Selection Component with Wager Amount Input
const SessionSelection: React.FC<{ onJoinSession: (code: string, wager: number) => void }> = ({ onJoinSession }) => {
  const [sessionCode, setSessionCode] = useState('');
  const [wagerAmount, setWagerAmount] = useState(0.01);
  const [isCreating, setIsCreating] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [ethProvider, setEthProvider] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const { authenticated, ready, login, logout, user } = usePrivy();

  // Detect ethereum provider
  useEffect(() => {
    const detectProvider = async () => {
      try {
        const provider = await detectEthereumProvider();
        setEthProvider(provider);
        
        if (provider && provider.request) {
          try {
            const accounts = await provider.request({ method: 'eth_accounts' });
            if (accounts && accounts.length > 0) {
              setConnectedWallet(accounts[0]);
            }
          } catch (error) {
            console.log('Could not get accounts:', error);
          }
        }
      } catch (error) {
        console.error('Failed to detect ethereum provider:', error);
      }
    };

    detectProvider();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (ethProvider && ethProvider.on) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setConnectedWallet(accounts[0]);
        } else {
          setConnectedWallet(null);
        }
      };

      ethProvider.on('accountsChanged', handleAccountsChanged);
      
      return () => {
        if (ethProvider.removeListener) {
          ethProvider.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, [ethProvider]);

  // Sync with Privy wallet if available and no ethereum provider wallet
  useEffect(() => {
    if (user?.wallet?.address && !connectedWallet) {
      setConnectedWallet(user.wallet.address);
    }
  }, [user?.wallet?.address, connectedWallet]);

  const connectWallet = async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    try {
      const provider = ethProvider || (window as any).ethereum;
      if (!provider) {
        alert('No wallet detected. Please ensure you have a wallet extension installed.');
        return;
      }

      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setConnectedWallet(accounts[0]);
      }
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      alert(`Failed to connect wallet: ${error.message || 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setConnectedWallet(null);
  };

  const handleJoin = () => {
    if (sessionCode.trim()) {
      onJoinSession(sessionCode.trim().toUpperCase(), wagerAmount);
    }
  };

  const createNewSession = () => {
    setIsCreating(true);
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    onJoinSession(randomCode, wagerAmount);
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-2xl p-8 card-hover">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center card-hover">
          <div className="text-6xl mb-6 animate-bounce-once">🎨</div>
          <h1 className="text-4xl font-bold text-gray-800 mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Guess My Drawing
          </h1>
          <p className="text-gray-600 mb-8">
            A multiplayer drawing & guessing game with blockchain wagering on Monad Testnet
          </p>
          <button
            onClick={login}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg btn-glow"
          >
            🚀 Connect Account & Play
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-primary flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full card-hover">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 animate-bounce-once">🎨</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Guess My Drawing
          </h1>
          <p className="text-gray-600">Join or create a game session</p>
          
          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={logout}
              className="px-3 py-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200"
            >
              Logout
            </button>
            
            {connectedWallet ? (
              <div className="text-right">
                <p className="text-xs text-green-600">✅ Wallet Connected</p>
                <p className="text-xs font-mono">{connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)}</p>
                <button
                  onClick={disconnectWallet}
                  className="text-xs text-orange-600 hover:text-orange-700 underline"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              🔑 Enter Lobby Code
            </label>
            <input
              type="text"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              placeholder="Enter lobby code..."
              className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg font-mono text-center shadow-inner"
              maxLength={6}
            />
          </div>

          <button
            onClick={handleJoin}
            disabled={!sessionCode.trim()}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold text-lg hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-300 transform hover:scale-105 disabled:transform-none shadow-lg btn-glow"
          >
            🚪 Join Game
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                💰 Set Wager Amount (MON)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={wagerAmount}
                onChange={(e) => setWagerAmount(parseFloat(e.target.value) || 0.01)}
                className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg font-bold shadow-inner"
              />
              <p className="text-xs text-gray-500 mt-1">This amount will be required from all players</p>
            </div>

            <button
              onClick={createNewSession}
              disabled={isCreating}
              className="w-full py-3 bg-gradient-success text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all duration-300 transform hover:scale-105 shadow-lg btn-glow"
            >
              {isCreating ? '⏳ Creating...' : '✨ Create New Lobby'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Game wrapper with session code and wager
const GameWithSession: React.FC<{ sessionCode: string; wagerAmount: number }> = ({ sessionCode, wagerAmount }) => {
  return (
    <ReactTogether
      sessionParams={{
        appId: MULTISYNQ_APP_ID,
        apiKey: MULTISYNQ_API_KEY,
        name: `guess-drawing-${sessionCode}`,
        password: `session-${sessionCode}-password`
      }}
      rememberUsers={true}
    >
      <GuessMyDrawingGame sessionCode={sessionCode} wagerAmount={wagerAmount} />
    </ReactTogether>
  );
};

// App wrapper with MultiSynq and Privy
const App: React.FC = () => {
  const [sessionCode, setSessionCode] = useState('');
  const [wagerAmount, setWagerAmount] = useState(0.01);
  const [isConnected, setIsConnected] = useState(false);

  const handleJoinSession = (code: string, wager: number) => {
    setSessionCode(code);
    setWagerAmount(wager);
    setIsConnected(true);
  };

  if (!isConnected) {
    return (
      <PrivyProvider appId={PRIVY_APP_ID}>
        <SessionSelection onJoinSession={handleJoinSession} />
      </PrivyProvider>
    );
  }

  return (
    <PrivyProvider appId={PRIVY_APP_ID}>
      <GameWithSession sessionCode={sessionCode} wagerAmount={wagerAmount} />
    </PrivyProvider>
  );
};

export default App; 