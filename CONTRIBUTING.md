# Contributing to Guess My Drawing

Thank you for your interest in contributing to Guess My Drawing! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Git

### Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/guessmydrawing.git`
3. Install dependencies: `npm install`
4. Copy environment variables: `cp .env.example .env`
5. Fill in your API keys in `.env` (see setup instructions below)
6. Start development server: `npm run dev`

### Required API Keys

#### Privy (Authentication)
1. Visit [Privy Dashboard](https://dashboard.privy.io/)
2. Create a new app
3. Copy your App ID to `VITE_PRIVY_APP_ID`

#### MultiSynq (Real-time Multiplayer)
1. Visit [MultiSynq](https://multisynq.io/)
2. Create an account and get API key
3. Add to `VITE_MULTISYNQ_API_KEY`

#### Optional: Monad Testnet (Blockchain Features)
- Get free testnet tokens from [Monad Faucet](https://faucet.monad.xyz)
- Deploy GameEscrow contract (see `SMART_CONTRACT_SETUP.md`)

## 🎯 How to Contribute

### Reporting Bugs
- Use GitHub Issues
- Include steps to reproduce
- Provide browser/OS information
- Include console errors if any

### Feature Requests
- Open a GitHub Issue
- Describe the feature and use case
- Discuss implementation approach

### Code Contributions

#### Areas for Contribution
- **UI/UX Improvements**: Better mobile experience, animations, accessibility
- **Game Features**: New drawing tools, word categories, game modes
- **Performance**: Canvas optimization, network efficiency
- **Social Features**: Leaderboards, achievements, sharing
- **Blockchain**: Smart contract improvements, new wagering features

#### Development Guidelines
1. **Code Style**: Follow existing patterns, use TypeScript
2. **Testing**: Test your changes thoroughly
3. **Mobile**: Ensure mobile compatibility
4. **Performance**: Consider real-time sync implications
5. **Documentation**: Update README if needed

#### Pull Request Process
1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Test thoroughly (especially multiplayer functionality)
4. Commit with clear messages
5. Push to your fork
6. Open a Pull Request with:
   - Clear description of changes
   - Screenshots/videos if UI changes
   - Testing instructions

## 🏗️ Architecture Overview

### Key Technologies
- **React 18 + TypeScript**: Frontend framework
- **ReactTogether**: Real-time multiplayer synchronization
- **Privy**: Wallet authentication
- **Ethers.js**: Blockchain interaction
- **TailwindCSS**: Styling
- **Vite**: Build tool

### Key Components
- `DrawingCanvas`: HTML5 canvas with real-time sync
- `GameChat`: Real-time chat with guess detection
- `PlayerList`: Player management and scoring
- `GameEscrow.sol`: Smart contract for wagering

### State Management
- Uses `useStateTogether` for multiplayer state
- Session-specific state keys for multiple lobbies
- Optimistic updates for better UX

## 🎨 Design Guidelines

### UI Principles
- **Mobile-first**: Touch-friendly interactions
- **Real-time feedback**: Immediate visual responses
- **Social**: Show player identities and interactions
- **Accessible**: Good contrast, keyboard navigation

### Drawing Canvas
- Smooth drawing experience
- Path simplification for network efficiency
- Visual feedback for drawing tools
- Cross-platform compatibility

## 🔧 Development Tips

### Testing Multiplayer Features
- Open multiple browser tabs/windows
- Test with different network conditions
- Verify state synchronization
- Test edge cases (disconnections, etc.)

### Performance Considerations
- Canvas operations are expensive
- Network messages have size limits (~10KB)
- Use path simplification for long strokes
- Optimize re-renders with React.memo

### Common Issues
- **Wallet Connection**: Ensure proper network (Monad Testnet)
- **Real-time Sync**: Check API keys and network
- **Canvas Performance**: Use requestAnimationFrame
- **Mobile Touch**: Handle touch events properly

## 📝 Code Style

### TypeScript
- Use strict typing
- Define interfaces for all data structures
- Use proper error handling

### React
- Use functional components with hooks
- Implement proper cleanup in useEffect
- Use useCallback for event handlers

### CSS
- Use TailwindCSS classes
- Mobile-first responsive design
- Consistent spacing and colors

## 🚀 Deployment

### Vercel (Recommended)
1. Connect GitHub repository
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

### Other Platforms
- Netlify, Cloudflare Pages also supported
- Ensure environment variables are set
- Static site hosting required

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🤝 Community

- **Issues**: Bug reports and feature requests
- **Discussions**: General questions and ideas
- **Pull Requests**: Code contributions

## 🙏 Recognition

Contributors will be recognized in the README and release notes. Thank you for helping make Guess My Drawing better!

---

For questions, open an issue or start a discussion. Happy coding! 🎨 