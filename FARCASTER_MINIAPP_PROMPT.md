# Farcaster Mini App Implementation Prompt

## Project Overview
Create a Farcaster mini app version of "Guess My Drawing" - a real-time multiplayer drawing and guessing game with blockchain wagering. This should be a separate, optimized implementation specifically designed for the Farcaster ecosystem.

## Source Code
Download and analyze the existing web version from: https://github.com/hochangjun/guessmydrawing

Study the current implementation to understand:
- Game mechanics and flow
- Real-time multiplayer architecture (ReactTogether)
- Blockchain integration (Monad testnet)
- Drawing canvas implementation
- Player management and scoring system

## Technical Requirements

### Core Framework
- **Frontend**: React 18+ with TypeScript
- **Styling**: Tailwind CSS (mobile-first approach)
- **Real-time**: ReactTogether for multiplayer sync
- **Blockchain**: Ethers.js for Monad testnet integration 
- **Authentication**: Privy for wallet management
- **Farcaster**: @farcaster/frame-sdk for mini app integration

### Environment Variables
Create a `.env` file with the following variables:

```bash
# Farcaster Mini App Configuration
VITE_FARCASTER_APP_NAME="Guess My Drawing"
VITE_FARCASTER_APP_VERSION="1.0.0"
VITE_FARCASTER_DOMAIN="your-domain.com"

# ReactTogether (Multisynq) Configuration
VITE_MULTISYNQ_API_KEY="your_multisynq_api_key_here"
VITE_MULTISYNQ_APP_ID="your_multisynq_app_id_here"

# Privy Authentication
VITE_PRIVY_APP_ID="your_privy_app_id_here"

# Blockchain Configuration (Monad Testnet)
VITE_GAME_ESCROW_CONTRACT_ADDRESS="0x..." # Deploy new contract or use existing
VITE_MONAD_RPC_URL="https://testnet-rpc.monad.xyz"
VITE_MONAD_EXPLORER_URL="https://testnet.monadexplorer.com"

# Optional: Analytics & Monitoring
VITE_ANALYTICS_ID="your_analytics_id_here"
VITE_SENTRY_DSN="your_sentry_dsn_here"
```

## Farcaster-Specific Features to Implement

### 1. Mini App Integration
- Implement Farcaster Frame SDK initialization
- Add proper meta tags for frame preview
- Create `.well-known/farcaster.json` manifest
- Handle mini app lifecycle (ready, context, etc.)

### 2. Social Identity Integration
- Use Farcaster user profiles (username, pfp, bio)
- Display player's follower count and verification status
- Show mutual connections in lobbies
- Replace generic nicknames with Farcaster identities

### 3. Enhanced Sharing Mechanics
- Auto-compose cast functionality for:
  - Lobby invitations ("🎨 Join my drawing game! Code: 123")
  - Game results ("🏆 Just won 0.5 MON in Guess My Drawing!")
  - Funny drawings ("😂 Someone drew this for 'cat'...")
- Deep linking from casts back to specific lobbies
- Share-to-timeline button for memorable moments

### 4. Mobile-Optimized UI/UX
- Touch-friendly drawing canvas with gesture support
- Larger UI elements for mobile interaction
- Simplified color palette (6-8 colors max)
- Thumb-zone navigation layout
- Swipe gestures for tool switching

### 5. Farcaster-Native Features
- "Friends Playing" discovery (show lobbies with mutual follows)
- Social proof indicators ("3 of your follows are playing")
- Farcaster notification integration for game invites
- Channel-specific tournaments (#art, #games, etc.)

## Game Mechanics Adaptations

### Mobile-First Drawing Experience
- Implement pressure-sensitive drawing (if supported)
- Add drawing gesture shortcuts (double-tap to clear, pinch to zoom)
- Optimize canvas performance for mobile devices
- Add haptic feedback for drawing actions

### Social Scoring System
- Bonus points for playing with followers
- Social achievements ("Played with 10 different people")
- Leaderboards with Farcaster social context
- Weekly tournaments with cast announcements

### Streamlined Onboarding
- One-tap wallet connection via Farcaster
- Auto-populate player info from Farcaster profile
- Skip manual nickname entry
- Instant lobby creation with smart defaults

## Technical Implementation Details

### Project Structure
```
farcaster-guess-my-drawing/
├── public/
│   ├── .well-known/
│   │   └── farcaster.json
│   ├── frame-preview.png (1200x800, 3:2 ratio)
│   ├── splash.png (200x200)
│   ├── opengraph.png (1200x630)
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── farcaster/
│   │   │   ├── FarcasterProvider.tsx
│   │   │   ├── SocialPlayerList.tsx
│   │   │   ├── ShareButton.tsx
│   │   │   └── FriendsFeed.tsx
│   │   ├── game/
│   │   │   ├── MobileDrawingCanvas.tsx
│   │   │   ├── TouchGameControls.tsx
│   │   │   └── SocialGameChat.tsx
│   │   └── ui/
│   ├── hooks/
│   │   ├── useFarcasterContext.ts
│   │   ├── useSocialFeatures.ts
│   │   └── useMobileOptimizations.ts
│   ├── utils/
│   │   ├── farcaster.ts
│   │   ├── social.ts
│   │   └── mobile.ts
│   └── App.tsx
```

### Key Components to Build

#### 1. FarcasterProvider Component
```typescript
interface FarcasterContextType {
  user: FarcasterUser | null;
  isInFarcaster: boolean;
  shareToFarcaster: (content: ShareContent) => void;
  openComposer: (text: string, embeds?: string[]) => void;
  context: FrameContext | null;
}
```

#### 2. SocialPlayerList Component
- Display Farcaster pfps and usernames
- Show verification badges and follower counts
- Highlight mutual connections
- Add "Follow" buttons for new connections

#### 3. MobileDrawingCanvas Component
- Touch-optimized drawing with gesture support
- Pressure sensitivity (where available)
- Zoom and pan capabilities
- Performance optimizations for mobile

#### 4. ShareButton Component
- Context-aware sharing (lobby invite vs. game result)
- Auto-generate engaging cast text
- Include relevant embeds and images
- Track sharing analytics

### Farcaster Integration Checklist

#### Frame Metadata Setup
- [ ] Add proper `fc:frame` meta tag with app details
- [ ] Create frame preview image (3:2 aspect ratio)
- [ ] Set up splash screen image (200x200px)
- [ ] Configure OpenGraph tags for social sharing

#### Domain Verification
- [ ] Generate domain manifest using Warpcast mobile app
- [ ] Add `.well-known/farcaster.json` with accountAssociation
- [ ] Verify domain ownership in Farcaster

#### SDK Integration
- [ ] Install and configure @farcaster/frame-sdk
- [ ] Implement proper SDK initialization
- [ ] Handle frame context and user data
- [ ] Add ready() call to hide loading screen

#### Social Features
- [ ] Integrate Farcaster user profiles
- [ ] Implement cast composer integration
- [ ] Add social discovery features
- [ ] Create sharing workflows

## Performance Optimizations

### Mobile Performance
- Implement canvas virtualization for large drawings
- Use requestAnimationFrame for smooth drawing
- Optimize re-renders with React.memo and useMemo
- Implement proper touch event handling

### Network Optimization
- Compress drawing data before syncing
- Implement delta updates for canvas changes
- Add offline support with local storage
- Optimize real-time sync for mobile networks

## Deployment Strategy

### Hosting Requirements
- Static hosting with HTTPS (Vercel, Netlify, or Cloudflare Pages)
- Custom domain for Farcaster verification
- CDN for global performance
- Environment variable management

### Testing Checklist
- [ ] Test in Warpcast mobile app
- [ ] Verify frame preview displays correctly
- [ ] Test sharing functionality
- [ ] Validate wallet connections
- [ ] Performance test on various mobile devices
- [ ] Test real-time multiplayer sync

## Launch Strategy

### Pre-Launch
1. Deploy to staging environment
2. Test with small group of Farcaster users
3. Create promotional assets (preview images, demo videos)
4. Prepare launch cast content

### Launch Day
1. Deploy to production
2. Post launch cast with demo
3. Share in relevant Farcaster channels
4. Monitor for issues and user feedback

### Post-Launch
1. Gather user analytics and feedback
2. Iterate on mobile UX improvements
3. Add requested social features
4. Plan tournament events

## Success Metrics to Track

### Engagement Metrics
- Daily/Weekly active users
- Session duration and retention
- Games completed vs. abandoned
- Sharing rate (casts per game)

### Social Metrics
- Viral coefficient (new users from shares)
- Cross-follow rate (players following each other)
- Cast engagement (likes, recasts, replies)
- Channel participation

### Technical Metrics
- Mobile performance (FPS, load times)
- Real-time sync reliability
- Wallet connection success rate
- Error rates and crash reports

## Additional Features for Future Iterations

### Advanced Social Features
- Tournament hosting with cast announcements
- Custom word packs created by community
- NFT achievements and collectibles
- Integration with Farcaster channels

### Monetization Options
- Premium drawing tools and effects
- Tournament entry fees with prize pools
- Custom lobby themes and branding
- Creator revenue sharing for word packs

### Technical Enhancements
- AI-powered drawing assistance
- Voice chat integration
- Replay system for memorable games
- Advanced analytics dashboard

---

## Getting Started

1. Clone the original repository and study the codebase
2. Set up a new React project with the specified tech stack
3. Configure all environment variables
4. Implement Farcaster SDK integration first
5. Adapt the core game mechanics for mobile
6. Add social features incrementally
7. Test thoroughly in Farcaster environment
8. Deploy and launch with community engagement

Remember to prioritize mobile UX and social features that leverage Farcaster's unique social graph and identity system. The goal is to create a viral, engaging experience that feels native to the Farcaster ecosystem while maintaining the fun and competitive spirit of the original game. 