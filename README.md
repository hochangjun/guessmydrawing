# 🎨 Guess My Drawing

A real-time multiplayer drawing guessing game with blockchain wagering on Monad Testnet, powered by MultiSynq for seamless real-time synchronization.

## 🎮 Game Features

- **Real-time Multiplayer Drawing Canvas** - Players draw and see others' drawings in real-time
- **Smart Guessing System** - Chat integration that detects correct answers and awards points
- **Blockchain Wagering** - Monad Testnet integration for betting with MON tokens
- **Lobby System** - Create or join lobbies with unique codes (max 9 players)
- **Game Management** - Full round system with automatic progression
- **Live Scoring** - Points awarded based on guess timing and position
- **Mobile-Responsive UI** - Beautiful TailwindCSS design

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

### Setup

```bash
# Clone the repository
git clone https://github.com/hochangjun/guessmydrawing.git
cd guessmydrawing

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

## 🔧 Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS
- **Real-time Sync**: MultiSynq/React Together
- **Blockchain**: Monad Testnet (Chain ID: 10143)
- **Deployment**: Vercel

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