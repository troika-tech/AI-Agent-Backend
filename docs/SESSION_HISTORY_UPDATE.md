# Session-Based Chat History Update

## Summary
Updated the chat service to send only **session-specific messages** to the LLM, with a maximum of **10 user-bot pairs (20 messages)** per session.

## Changes Made

### 1. `services/chatService.js`
- **Added `sessionId` parameter** to `generateAnswer()` function
- **Session filtering**: Only messages from the current session are included in history
- **Increased limit**: Changed from 10 messages to 20 messages (10 pairs) max
- **Better context**: Ensures LLM only sees relevant conversation from current session

### 2. `services/chatbotService.js`
- **Pass sessionId**: Now passes `sessionId` to `generateAnswer()` function
- **Increased fetch limit**: Changed from 10 to 25 messages to account for deduplication
- **Added sessionId to history context**: Each message now includes `sessionId` field for filtering

## How It Works

### Before
```javascript
// Sent ALL messages across ALL sessions (limited to 10 total)
Message.find({ chatbot_id: chatbotId })
  .limit(10)
```

### After
```javascript
// Fetch messages for CURRENT session only
Message.find({ chatbot_id: chatbotId, session_id: sessionId })
  .limit(25) // Fetch more for deduplication

// Filter by session and limit to 10 pairs (20 messages)
if (sessionId) {
  sessionHistory = historyContext.filter(msg => 
    !msg.sessionId || msg.sessionId === sessionId
  );
}
if (uniqueHistory.length > 20) {
  trimmedHistory = uniqueHistory.slice(-20); // Last 10 pairs
}
```

## Benefits

✅ **Session isolation**: Each session has its own conversation context  
✅ **No context pollution**: Previous sessions don't interfere with current conversation  
✅ **Better relevance**: LLM gets only the current conversation history  
✅ **Proper pairing**: 10 user-bot pairs ensure balanced conversation context  
✅ **Efficient token usage**: Only sends relevant history to LLM  

## Example Scenario

**User Session 1** (sessionId: abc123):
- User: "What are your products?"
- Bot: "We offer A, B, C..."
- User: "Tell me about A"
- Bot: "A is..."

**User Session 2** (sessionId: xyz789):
- User: "What is your pricing?"
- Bot: "Our pricing is..." ← Only sees messages from xyz789, not abc123

## Testing

To verify:
1. Start a new chat session
2. Have a conversation with 5+ exchanges
3. Check LLM request logs - should see max 20 history messages
4. Start a new session - should NOT see history from previous session
