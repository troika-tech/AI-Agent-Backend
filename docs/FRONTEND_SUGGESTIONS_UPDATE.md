# Frontend Changes for Suggestions

## File 1: `sseParser.js`

**Location**: Around line 160-164 (in the `processBuffer` method, `case 'suggestions':`)

**Current code:**
```javascript
case 'suggestions':
  console.log('SSE suggestions received:', event.data);
  break;
```

**Update to:**
```javascript
case 'suggestions':
  console.log('SSE suggestions received:', event.data);
  // Pass suggestions to handler
  if (handlers.onSuggestions) {
    handlers.onSuggestions(event.data);
  }
  break;
```

---

## File 2: `useStreamingChat.js`

### Add suggestions state

**Add this after your other useState declarations:**
```javascript
const [suggestions, setSuggestions] = useState([]);
```

### Add suggestions handler

**In the `sendMessage` function, update the `reader.start()` call:**

**Find this:**
```javascript
await reader.start({
  onText: (token) => {
    // ... existing code ...
  },

  onAudio: (audioContent, index) => {
    // ... existing code ...
  },

  onDone: (data) => {
    // ... existing code ...
  },

  onError: (errorData) => {
    // ... existing code ...
  },

  onConnectionError: (error) => {
    // ... existing code ...
  },
});
```

**Add the `onSuggestions` handler:**
```javascript
await reader.start({
  onText: (token) => {
    // ... existing code ...
  },

  onAudio: (audioContent, index) => {
    // ... existing code ...
  },

  onSuggestions: (data) => {
    console.log('Suggestions handler called:', data);

    // Backend sends either array directly or {items: [...]}
    const suggestionArray = Array.isArray(data) ? data : (data.items || []);

    console.log('Parsed suggestions:', suggestionArray);
    setSuggestions(suggestionArray);
  },

  onDone: (data) => {
    // ... existing code ...

    // Also check if done event has suggestions
    if (data.suggestions && data.suggestions.length > 0) {
      setSuggestions(data.suggestions);
    }
  },

  onError: (errorData) => {
    // ... existing code ...
  },

  onConnectionError: (error) => {
    // ... existing code ...
  },
});
```

### Return suggestions from hook

**At the bottom of `useStreamingChat`, update the return statement:**

**Find this:**
```javascript
return {
  // State
  streamingResponse,
  isStreaming,
  error,
  audioPlaying,
  metrics,

  // Controls
  sendMessage,
  stopStreaming,
  retry,
  pauseAudio,
  resumeAudio,
  getAudioState,
};
```

**Update to:**
```javascript
return {
  // State
  streamingResponse,
  isStreaming,
  error,
  audioPlaying,
  metrics,
  suggestions,  // ← Add this

  // Controls
  sendMessage,
  stopStreaming,
  retry,
  pauseAudio,
  resumeAudio,
  getAudioState,
};
```

### Clear suggestions on new message

**In the `sendMessage` function, add this at the beginning:**
```javascript
const sendMessage = useCallback(
  async (query) => {
    // ... existing validation code ...

    // Reset state
    setStreamingResponse('');
    setError(null);
    setIsStreaming(true);
    setMetrics(null);
    setSuggestions([]);  // ← Add this to clear old suggestions

    // ... rest of the function ...
  },
  [apiBase, chatbotId, sessionId, enableTTS, isStreaming, onComplete, onError]
);
```

---

## File 3: `SupaChatbot.jsx` (Your Main Chat Component)

### Get suggestions from hook

**Update where you use the hook:**

**Find this:**
```javascript
const {
  streamingResponse,
  isStreaming,
  error,
  audioPlaying,
  sendMessage,
  stopStreaming,
  retry,
} = useStreamingChat({
  // ... options
});
```

**Update to:**
```javascript
const {
  streamingResponse,
  isStreaming,
  error,
  audioPlaying,
  suggestions,  // ← Add this
  sendMessage,
  stopStreaming,
  retry,
} = useStreamingChat({
  // ... options
});
```

### Add suggestion click handler

**Add this function in your component:**
```javascript
const handleSuggestionClick = (suggestion) => {
  console.log('Suggestion clicked:', suggestion);
  sendMessage(suggestion);
};
```

### Render suggestion buttons

**Add this in your JSX, after the chat messages:**

```jsx
{/* Suggestion Buttons */}
{suggestions && suggestions.length > 0 && !isStreaming && (
  <div style={{
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '12px',
    marginTop: '8px'
  }}>
    {suggestions.map((suggestion, index) => (
      <button
        key={index}
        onClick={() => handleSuggestionClick(suggestion)}
        style={{
          padding: '8px 16px',
          background: 'white',
          border: '1px solid #e0e0e0',
          borderRadius: '20px',
          fontSize: '14px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          color: '#333',
        }}
        onMouseEnter={(e) => {
          e.target.style.background = '#007bff';
          e.target.style.color = 'white';
          e.target.style.borderColor = '#007bff';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'white';
          e.target.style.color = '#333';
          e.target.style.borderColor = '#e0e0e0';
        }}
      >
        {suggestion}
      </button>
    ))}
  </div>
)}
```

---

## File 4: Add CSS (Optional - for better styling)

Create a CSS file or add to your existing styles:

```css
/* Suggestion buttons container */
.suggestions-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  margin-top: 8px;
}

/* Individual suggestion button */
.suggestion-button {
  padding: 8px 16px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #333;
  font-family: inherit;
}

.suggestion-button:hover {
  background: #007bff;
  color: white;
  border-color: #007bff;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.suggestion-button:active {
  transform: translateY(0);
}

.suggestion-button:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}
```

**Then use the CSS classes in your JSX:**
```jsx
{suggestions && suggestions.length > 0 && !isStreaming && (
  <div className="suggestions-container">
    {suggestions.map((suggestion, index) => (
      <button
        key={index}
        className="suggestion-button"
        onClick={() => handleSuggestionClick(suggestion)}
      >
        {suggestion}
      </button>
    ))}
  </div>
)}
```

---

## Summary of Changes

| File | Changes | Why |
|------|---------|-----|
| `sseParser.js` | Add `handlers.onSuggestions()` call | Pass suggestions to hook |
| `useStreamingChat.js` | Add suggestions state and handler | Capture and store suggestions |
| `SupaChatbot.jsx` | Add suggestion buttons UI | Display clickable suggestion buttons |

---

## Testing Checklist

After making these changes:

1. ✅ Clear browser cache and reload
2. ✅ Send a test message
3. ✅ Check console for: `Suggestions handler called: [...]`
4. ✅ Verify message text has NO `[SUGGESTIONS: ...]`
5. ✅ Verify suggestion buttons appear below message
6. ✅ Click a suggestion button - should send that question
7. ✅ Verify old suggestions disappear when new message sent

---

## Expected Result

**Message text:**
```
Great question! My services are designed to turbocharge your digital presence...
```

**Suggestion buttons (below the message):**
```
[Tell me more about AI Websites]  [How does Supa Agent work?]  [What are the benefits of WhatsApp Marketing?]
```

**Console logs:**
```
SSE suggestions received: {items: Array(3)}
Suggestions handler called: ["Tell me more...", "How does...", "What are..."]
Parsed suggestions: (3) ["Tell me more...", "How does...", "What are..."]
```
