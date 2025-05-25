# ReactTogether State Management Troubleshooting Guide

## 🚨 **Critical Issue: Mixing localStorage with ReactTogether**

### **Problem Description**
When building multiplayer applications with ReactTogether, a common mistake is mixing localStorage with ReactTogether's shared state management. This creates inconsistent state synchronization and breaks real-time multiplayer functionality.

### **Root Cause**
- **localStorage is per-browser/user**: Each user has their own localStorage that is NOT shared between different users or browser sessions
- **ReactTogether is shared state**: Designed to synchronize state across all connected users in real-time
- **Mixing both creates conflicts**: Some data is local-only while other data is shared, leading to inconsistent views

### **Symptoms**
1. **Intermittent visibility**: Items appear and disappear randomly across different users
2. **State desynchronization**: Different users see different data
3. **One-way updates**: Changes from one user don't propagate to others
4. **Session isolation**: Users can't see each other's actions properly

### **Example of WRONG Implementation**
```typescript
// ❌ BAD: Mixing localStorage with ReactTogether
const [sharedData, setSharedData] = useStateTogether('sharedKey', {});

useEffect(() => {
  // Loading from localStorage - NOT shared between users!
  const localData = JSON.parse(localStorage.getItem('myData') || '{}');
  setSharedData(localData); // This overwrites shared state with local data
}, []);

const updateData = (newData) => {
  // Saving to localStorage - only visible to current user!
  localStorage.setItem('myData', JSON.stringify(newData));
  setSharedData(newData); // This might work but creates inconsistencies
};
```

### **Correct Implementation**
```typescript
// ✅ GOOD: Pure ReactTogether state management
const [sharedData, setSharedData] = useStateTogether('sharedKey', {});

// No localStorage operations needed!
const updateData = (newData) => {
  // Direct update to shared state - visible to ALL users immediately
  setSharedData(prev => ({
    ...prev,
    ...newData
  }));
};

// Optional: Clean up old data periodically
useEffect(() => {
  const cleanup = setInterval(() => {
    const now = Date.now();
    setSharedData(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(key => {
        if (updated[key].createdAt < now - 30 * 60 * 1000) {
          delete updated[key]; // Remove items older than 30 minutes
        }
      });
      return updated;
    });
  }, 60000); // Check every minute

  return () => clearInterval(cleanup);
}, [setSharedData]);
```

## 🔧 **Best Practices for ReactTogether**

### **1. Use ReactTogether for ALL Shared State**
- Public lobbies, game state, player lists, chat messages
- Anything that needs to be synchronized between users

### **2. Use localStorage ONLY for User-Specific Data**
- User preferences, settings, authentication tokens
- Data that should NOT be shared between users

### **3. Consistent State Keys**
```typescript
// ✅ GOOD: Descriptive, consistent naming
const [publicLobbies, setPublicLobbies] = useStateTogether('publicLobbies', {});
const [gameState, setGameState] = useStateTogether(`gameState_${sessionCode}`, defaultGameState);
const [players, setPlayers] = useStateTogether(`players_${sessionCode}`, {});

// ❌ BAD: Inconsistent or unclear naming
const [data1, setData1] = useStateTogether('data', {});
const [stuff, setStuff] = useStateTogether('randomKey123', {});
```

### **4. Session-Specific vs Global State**
```typescript
// Global state (shared across entire app)
const [publicLobbies, setPublicLobbies] = useStateTogether('publicLobbies', {});

// Session-specific state (unique per game/lobby)
const [gameState, setGameState] = useStateTogether(`gameState_${sessionCode}`, {});
const [players, setPlayers] = useStateTogether(`players_${sessionCode}`, {});

// User-specific state (unique per user)
const [userState, setUserState] = useStateTogether(`user_${walletAddress}`, {});
```

### **5. Avoid Global Functions and Custom Events**
```typescript
// ❌ BAD: Complex global function system
(window as any).updateSharedData = (data) => { /* complex logic */ };
window.dispatchEvent(new CustomEvent('dataUpdated', { detail: data }));

// ✅ GOOD: Direct state updates
setSharedData(prev => ({ ...prev, ...newData }));
```

## 🐛 **Common Debugging Steps**

### **1. Check State Keys**
```typescript
// Add debug logging to see what keys are being used
console.log('State key:', `gameState_${sessionCode}`);
console.log('Current state:', gameState);
```

### **2. Verify Single ReactTogether Session**
```typescript
// Make sure all components use the same session parameters
const sessionParams = {
  appId: 'your-app-id',
  apiKey: 'your-api-key',
  name: 'consistent-session-name',
  password: 'consistent-password',
};
```

### **3. Remove All localStorage Operations**
```bash
# Search for localStorage usage in your codebase
grep -r "localStorage" src/
```

### **4. Check for State Overwrites**
```typescript
// ❌ BAD: This overwrites shared state
setSharedData(localData);

// ✅ GOOD: This merges with shared state
setSharedData(prev => ({ ...prev, ...newData }));
```

## 📋 **Migration Checklist**

When fixing localStorage + ReactTogether issues:

- [ ] Remove all `localStorage.getItem()` calls for shared data
- [ ] Remove all `localStorage.setItem()` calls for shared data
- [ ] Remove all `localStorage.removeItem()` calls for shared data
- [ ] Remove global functions like `(window as any).functionName`
- [ ] Remove custom event listeners and dispatchers
- [ ] Replace with direct `setSharedState()` calls
- [ ] Ensure all components use the same ReactTogether session
- [ ] Test with multiple browser windows/users
- [ ] Verify real-time synchronization works

## 🎯 **Key Takeaways**

1. **ReactTogether handles persistence**: No need for localStorage for shared data
2. **One source of truth**: Use either localStorage OR ReactTogether, never both for the same data
3. **Real-time by default**: ReactTogether automatically syncs across all users
4. **Session consistency**: All components must use the same session parameters
5. **Direct state updates**: Avoid complex global function systems

## 🔍 **Warning Signs**

If you see these patterns, you likely have localStorage + ReactTogether conflicts:

- Data appears/disappears randomly
- Different users see different states
- Need to refresh to see updates
- Complex global function systems
- Custom event dispatching for state updates
- Loading data from localStorage into ReactTogether state

## 📚 **Additional Resources**

- [ReactTogether Documentation](https://react-together.com)
- [State Management Best Practices](https://react-together.com/docs/best-practices)
- [Debugging ReactTogether Apps](https://react-together.com/docs/debugging)

---

**Remember**: ReactTogether is designed to handle all the complexity of real-time state synchronization. Trust it to do its job and avoid mixing it with localStorage for shared data! 