import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ReactTogether, useStateTogether, useMyId, useAllNicknames, useConnectedUsers } from 'react-together';

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
  }
}

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

// MultiSynq Configuration - Using your existing API key
const MULTISYNQ_CONFIG = {
  appId: 'io.multisynq.guessmydrawing',
  apiKey: '2sEh6UDXdrDn7QUYfQWKSigKShshqcGt3mV3PSSvz2'
};

// Drawing Canvas Component
const DrawingCanvas: React.FC<{
  paths: DrawingPath[];
  setPaths: (paths: DrawingPath[]) => void;
  canDraw: boolean;
  color: string;
  strokeWidth: number;
}> = ({ paths, setPaths, canDraw, color, strokeWidth }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const myId = useMyId();

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
    if (!canDraw || !myId) return;
    setIsDrawing(true);
    const pos = getMousePos(e);
    setCurrentPath([pos]);
  }, [canDraw, myId, getMousePos]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canDraw) return;
    const pos = getMousePos(e);
    setCurrentPath(prev => [...prev, pos]);
  }, [isDrawing, canDraw, getMousePos]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing || !myId || currentPath.length < 2) {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    const newPath: DrawingPath = {
      id: `${myId}-${Date.now()}-${Math.random()}`,
      userId: myId,
      points: currentPath,
      color,
      strokeWidth,
      timestamp: Date.now()
    };

    setPaths([...paths, newPath]);
    setIsDrawing(false);
    setCurrentPath([]);
  }, [isDrawing, myId, currentPath, color, strokeWidth, paths, setPaths]);

  // Redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all completed paths
    paths.forEach(path => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      path.points.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });

    // Draw current path being drawn
    if (currentPath.length > 1) {
      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      currentPath.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }, [paths, currentPath, color, strokeWidth]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className={`border-2 border-gray-300 bg-white rounded-lg ${canDraw ? 'cursor-crosshair' : 'cursor-not-allowed'}`}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      style={{ maxWidth: '100%', height: 'auto' }}
    />
  );
};

// Game Chat Component
const GameChat: React.FC<{
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  currentWord: string | null;
  isDrawer: boolean;
  gamePhase: string;
}> = ({ messages, onSendMessage, currentWord, isDrawer, gamePhase }) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isDrawer && gamePhase === 'playing') {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="bg-white border-2 border-gray-300 rounded-lg p-4 h-96 flex flex-col">
      <h3 className="text-lg font-bold mb-3 text-gray-800">Game Chat</h3>
      <div className="flex-1 overflow-y-auto mb-3 space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-2 rounded text-sm ${
              msg.isGuess
                ? msg.isCorrect
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            <span className="font-semibold">{msg.userId.slice(0, 8)}:</span> {msg.message}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={
            isDrawer
              ? "You're drawing! Others will guess."
              : gamePhase === 'playing'
              ? 'Type your guess...'
              : 'Game not active'
          }
          disabled={isDrawer || gamePhase !== 'playing'}
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isDrawer || gamePhase !== 'playing' || !inputValue.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
        >
          Send
        </button>
      </form>
    </div>
  );
};

// Player List Component
const PlayerList: React.FC<{ players: Player[]; gameState: GameState }> = ({ players, gameState }) => {
  return (
    <div className="bg-white border-2 border-gray-300 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-3 text-gray-800">Players ({players.length}/9)</h3>
      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className={`flex justify-between items-center p-2 rounded ${
              gameState.currentDrawer === player.id
                ? 'bg-blue-100 border-2 border-blue-500'
                : 'bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  player.hasPaid ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="font-medium text-sm">
                {player.nickname} {gameState.lobbyOwner === player.id && '👑'}
              </span>
            </div>
            <span className="text-sm font-bold text-blue-600">{player.score}pts</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Game Component
const GuessMyDrawingGame: React.FC = () => {
  const myId = useMyId();
  const allNicknames = useAllNicknames();

  // Game state
  const [gameState, setGameState] = useStateTogether<GameState>('gameState', {
    phase: 'lobby',
    currentRound: 0,
    totalRounds: 3,
    currentDrawer: null,
    currentWord: null,
    timeRemaining: 60,
    roundStartTime: 0,
    scores: {},
    wagerAmount: 0.01,
    lobbyOwner: '',
    guessedCorrectly: []
  });

  const [drawingPaths, setDrawingPaths] = useStateTogether<DrawingPath[]>('drawingPaths', []);
  const [players, setPlayers] = useStateTogether<Record<string, Player>>('players', {});
  const [chatMessages, setChatMessages] = useStateTogether<ChatMessage[]>('chatMessages', []);
  const [walletConnected, setWalletConnected] = useState(false);

  // Local state
  const [currentColor, setCurrentColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(3);

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

  // Auto-advance round when time runs out
  useEffect(() => {
    if (gameState.phase === 'playing' && gameState.timeRemaining === 0 && gameState.lobbyOwner === myId) {
      setTimeout(() => nextRound(), 2000);
    }
  }, [gameState.timeRemaining, gameState.phase, gameState.lobbyOwner, myId]);

  // Initialize player when connecting
  useEffect(() => {
    if (myId && !players[myId]) {
      const newPlayer: Player = {
        id: myId,
        nickname: allNicknames[myId] || `Player ${myId.slice(0, 6)}`,
        score: 0,
        hasPaid: false,
        isReady: false
      };
      setPlayers(prev => ({ ...prev, [myId]: newPlayer }));

      if (Object.keys(players).length === 0 && !gameState.lobbyOwner) {
        setGameState(prev => ({ ...prev, lobbyOwner: myId }));
      }
    }
  }, [myId, players, allNicknames, setPlayers, gameState.lobbyOwner, setGameState]);

  // Blockchain functions
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      setWalletConnected(true);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const switchToMonadTestnet = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: MONAD_TESTNET.chainId }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [MONAD_TESTNET],
        });
      }
    }
  };

  const payWager = async () => {
    if (!window.ethereum || !myId) return;

    try {
      await switchToMonadTestnet();
      
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const wagerWei = Math.floor(gameState.wagerAmount * 1e18).toString(16);

      await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: accounts[0],
          to: '0x0000000000000000000000000000000000000000',
          value: `0x${wagerWei}`,
        }],
      });

      setPlayers(prev => ({
        ...prev,
        [myId]: { ...prev[myId], hasPaid: true, isReady: true }
      }));

    } catch (error: any) {
      console.error('Payment failed:', error);
      if (error.message?.includes('insufficient funds')) {
        const userConfirmed = confirm(
          '❌ Insufficient funds! You need testnet MON tokens to pay.\n\n' +
          '🎁 Click OK to get free testnet MON from the faucet, or Cancel to try again later.'
        );
        
        if (userConfirmed) {
          window.open('https://faucet.monad.xyz', '_blank');
        }
      } else {
        alert('Payment failed. Please try again.');
      }
    }
  };

  // Game functions
  const startGame = () => {
    if (gameState.lobbyOwner !== myId) return;
    
    const readyPlayers = Object.values(players).filter((p: Player) => p.hasPaid && p.isReady);
    if (readyPlayers.length < 2) {
      alert('Need at least 2 players to start!');
      return;
    }

    const firstDrawer = readyPlayers[0];
    const word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];

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
    if (gameState.lobbyOwner !== myId) return;

    const readyPlayers = Object.values(players).filter((p: Player) => p.hasPaid && p.isReady);
    const currentDrawerIndex = readyPlayers.findIndex((p: Player) => p.id === gameState.currentDrawer);
    const nextDrawerIndex = (currentDrawerIndex + 1) % readyPlayers.length;

    if (gameState.currentRound >= gameState.totalRounds) {
      setGameState(prev => ({ ...prev, phase: 'finished' }));
      return;
    }

    const nextDrawer = readyPlayers[nextDrawerIndex];
    const word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];

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

  const sendChatMessage = (message: string) => {
    if (!myId || !gameState.currentWord) return;

    const isGuess = gameState.phase === 'playing' && gameState.currentDrawer !== myId;
    const isCorrect = isGuess && message.toLowerCase() === gameState.currentWord.toLowerCase();

    const chatMessage: ChatMessage = {
      id: `${myId}-${Date.now()}`,
      userId: myId,
      message,
      timestamp: Date.now(),
      isGuess,
      isCorrect
    };

    setChatMessages(prev => [...prev, chatMessage]);

    if (isCorrect && !gameState.guessedCorrectly.includes(myId)) {
      const timeBonus = Math.max(0, Math.floor((gameState.timeRemaining / 60) * 20));
      const positionBonus = [100, 80, 60, 40][gameState.guessedCorrectly.length] || 40;
      const totalPoints = positionBonus + timeBonus;

      setGameState(prev => ({
        ...prev,
        scores: {
          ...prev.scores,
          [myId]: (prev.scores[myId] || 0) + totalPoints,
          [prev.currentDrawer!]: (prev.scores[prev.currentDrawer!] || 0) + 20
        },
        guessedCorrectly: [...prev.guessedCorrectly, myId]
      }));

      setPlayers(prev => ({
        ...prev,
        [myId]: { ...prev[myId], score: (prev[myId]?.score || 0) + totalPoints }
      }));
    }
  };

  const currentPlayer = players[myId || ''];
  const isDrawer = gameState.currentDrawer === myId;
  const canDraw = isDrawer && gameState.phase === 'playing';

  // Render different phases
  if (gameState.phase === 'lobby') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 to-blue-600 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-6">
          <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
            🎨 Guess My Drawing
          </h1>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Game Setup</h3>
                
                {gameState.lobbyOwner === myId && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Wager Amount (MON)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={gameState.wagerAmount}
                        onChange={(e) => setGameState(prev => ({
                          ...prev,
                          wagerAmount: parseFloat(e.target.value) || 0.01
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 p-4 bg-blue-50 rounded">
                  <p className="text-sm text-blue-800">
                    <strong>Wager:</strong> {gameState.wagerAmount} MON per player
                  </p>
                  <p className="text-sm text-blue-800">
                    <strong>Prize Pool:</strong> {(gameState.wagerAmount * Object.keys(players).length).toFixed(3)} MON
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {!walletConnected ? (
                  <button
                    onClick={connectWallet}
                    className="w-full py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600"
                  >
                    Connect Wallet
                  </button>
                ) : !currentPlayer?.hasPaid ? (
                  <button
                    onClick={payWager}
                    className="w-full py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600"
                  >
                    Pay Wager ({gameState.wagerAmount} MON)
                  </button>
                ) : (
                  <div className="text-center text-green-600 font-semibold">
                    ✅ Ready to Play!
                  </div>
                )}

                {gameState.lobbyOwner === myId && (
                  <button
                    onClick={startGame}
                    disabled={Object.values(players).filter((p: Player) => p.hasPaid).length < 2}
                    className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300"
                  >
                    Start Game
                  </button>
                )}
              </div>
            </div>

            <PlayerList players={Object.values(players)} gameState={gameState} />
          </div>
        </div>
      </div>
    );
  }

  if (gameState.phase === 'finished') {
    const winner = Object.values(players).reduce((prev: Player, current: Player) => 
      (current.score > prev.score) ? current : prev
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 to-blue-600 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-6">
          <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
            🏆 Game Finished!
          </h1>
          
          <div className="text-center space-y-6">
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6">
              <h2 className="text-3xl font-bold text-yellow-800 mb-2">
                🎉 Winner: {winner.nickname}
              </h2>
              <p className="text-xl text-yellow-700">
                Prize: {(gameState.wagerAmount * Object.keys(players).length).toFixed(3)} MON
              </p>
            </div>

            <PlayerList players={Object.values(players)} gameState={gameState} />

            <button
              onClick={() => window.location.reload()}
              className="py-3 px-6 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600"
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing phase
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Guess My Drawing</h1>
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold">
                Round {gameState.currentRound}/{gameState.totalRounds}
              </div>
              <div className={`text-2xl font-bold ${gameState.timeRemaining <= 10 ? 'text-red-500' : 'text-blue-600'}`}>
                {gameState.timeRemaining}s
              </div>
            </div>
          </div>
          
          {isDrawer && (
            <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
              <p className="text-blue-800">
                <strong>Your word:</strong> <span className="text-xl font-bold">{gameState.currentWord}</span>
              </p>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 space-y-4">
            {isDrawer && (
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Color</label>
                    <input
                      type="color"
                      value={currentColor}
                      onChange={(e) => setCurrentColor(e.target.value)}
                      className="w-12 h-8 border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Brush Size</label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={strokeWidth}
                      onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                      className="w-24"
                    />
                  </div>
                  <button
                    onClick={() => setDrawingPaths([])}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-4">
              <DrawingCanvas
                paths={drawingPaths}
                setPaths={setDrawingPaths}
                canDraw={canDraw}
                color={currentColor}
                strokeWidth={strokeWidth}
              />
            </div>
          </div>

          <div className="space-y-4">
            <PlayerList players={Object.values(players)} gameState={gameState} />
            <GameChat
              messages={chatMessages}
              onSendMessage={sendChatMessage}
              currentWord={gameState.currentWord}
              isDrawer={isDrawer}
              gamePhase={gameState.phase}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// App wrapper with MultiSynq
const App: React.FC = () => {
  const [sessionName, setSessionName] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const joinSession = () => {
    if (sessionName.trim()) {
      setIsConnected(true);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 to-blue-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
            🎨 Guess My Drawing
          </h1>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Enter Lobby Code</label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Enter lobby code..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={joinSession}
              disabled={!sessionName.trim()}
              className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-300"
            >
              Join Game
            </button>
            <button
              onClick={() => {
                const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
                setSessionName(randomCode);
                setIsConnected(true);
              }}
              className="w-full py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600"
            >
              Create New Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ReactTogether
      sessionParams={{
        appId: MULTISYNQ_CONFIG.appId,
        apiKey: MULTISYNQ_CONFIG.apiKey,
        name: `guess-drawing-${sessionName}`,
        password: 'game-session'
      }}
      rememberUsers={true}
    >
      <GuessMyDrawingGame />
    </ReactTogether>
  );
};

export default App; 