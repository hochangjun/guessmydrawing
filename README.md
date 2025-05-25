# 🎨 Guess My Drawing

A real-time multiplayer drawing guessing game with blockchain wagering on Monad Testnet, powered by MultiSynq for seamless real-time synchronization and Privy for secure wallet authentication.

## 📱 Farcaster Mini App Version

**NEW!** We're building a Farcaster mini app version optimized for mobile and social gaming. See [`FARCASTER_MINIAPP_PROMPT.md`](./FARCASTER_MINIAPP_PROMPT.md) for detailed implementation instructions.

### Key Farcaster Features:
- **🎯 Social Identity Integration** - Use Farcaster profiles, pfps, and usernames
- **📱 Mobile-First Design** - Touch-optimized drawing canvas and UI
- **🔗 Viral Sharing** - Auto-compose casts for lobby invites and game results
- **👥 Social Discovery** - Find lobbies with mutual follows and friends
- **🏆 Social Achievements** - Leaderboards with Farcaster social context

> **Want to build the Farcaster version?** Check out the comprehensive prompt in `FARCASTER_MINIAPP_PROMPT.md` with all technical details, environment variables, and implementation steps.

## 🎮 Game Features

- **🎨 Real-time Multiplayer Drawing Canvas** - Players draw and see others' drawings in real-time with enhanced visual effects
- **🧠 Smart Guessing System** - Chat integration that detects correct answers and awards points automatically
- **💰 Blockchain Wagering** - Monad Testnet integration for betting with MON tokens via Privy wallet authentication
- **🏠 Lobby System** - Create or join lobbies with unique codes (max 9 players)
- **⚡ Game Management** - Full round system with automatic progression and timers
- **🏆 Live Scoring** - Points awarded based on guess timing, position, and drawing bonuses
- **📱 Mobile-Responsive UI** - Beautiful modern design with gradients, shadows, and smooth animations
- **🔒 Secure Authentication** - Privy integration for seamless wallet connection and user management
- **🎯 Enhanced Drawing Tools** - Color picker, adjustable brush sizes, grid background, and visual feedback

## 🎯 How to Play

1. **Create/Join Lobby** → Enter lobby code or create new one
2. **Connect Wallet** → MetaMask integration for Monad Testnet
3. **Pay Wager** → Send MON tokens to participate  
4. **Game Starts** → Lobby owner starts when 2+ players ready
5. **Draw & Guess** → 60 seconds per round, points for correct guesses
6. **Winner Takes All** → Highest score wins the entire prize pool

## 💰 Scoring System

- **First correct guess:** 100 points + time bonus (up to 20 pts)
- **Second correct guess:** 80 points + time bonus  
- **Third correct guess:** 60 points + time bonus
- **Later guesses:** 40 points + time bonus
- **Drawer bonus:** 20 points per correct guess from others

## 🚀 Development

### Prerequisites

- Node.js 16+
- MetaMask wallet
- Monad Testnet MON tokens ([Get from faucet](https://faucet.monad.xyz))

### Setup (Web Version)

```bash
# Clone the repository
git clone https://github.com/hochangjun/guessmydrawing.git
cd guessmydrawing

# Install dependencies
npm install

# Create environment file
cat > .env << EOF
VITE_PRIVY_APP_ID="your_privy_app_id"
VITE_MULTISYNQ_API_KEY="your_multisynq_api_key"
VITE_MULTISYNQ_APP_ID="io.multisynq.guessmydrawing.v2"
EOF

# Start development server
npm run dev
```

### Setup (Farcaster Mini App Version)

For the Farcaster mini app implementation, follow the detailed instructions in [`FARCASTER_MINIAPP_PROMPT.md`](./FARCASTER_MINIAPP_PROMPT.md). The prompt includes:

- Complete environment variable setup
- Farcaster SDK integration steps
- Mobile-optimized component architecture
- Social features implementation guide
- Deployment and testing checklist

### Environment Variables

Create a `.env` file in the root directory with:

- `VITE_PRIVY_APP_ID` - Your Privy application ID for wallet authentication
- `VITE_MULTISYNQ_API_KEY` - Your MultiSynq API key for real-time synchronization
- `VITE_MULTISYNQ_APP_ID` - Your MultiSynq application ID (can be custom)

### Build for Production

```bash
npm run build
```

## 🔧 Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS with custom animations and effects
- **Authentication**: Privy for secure wallet connection
- **Real-time Sync**: MultiSynq/React Together with environment variable configuration
- **Blockchain**: Monad Testnet (Chain ID: 10143) with Ethers.js
- **Deployment**: Vercel with optimized build configuration

## 🌐 Deployment

This project is configured for easy deployment on Vercel:

1. Connect your GitHub repository to Vercel
2. Import the project
3. Deploy automatically

## 🎨 Game Mechanics

- **3 rounds total** with rotating drawers
- **60 seconds** per drawing round
- **Up to 9 players** per lobby
- **50 word bank** with diverse categories
- **Real-time chat** with guess detection
- **Automatic round progression**

## 📱 Browser Support

- Chrome/Chromium 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use this project for learning and development!

---

Built with ❤️ using MultiSynq and Monad Testnet 