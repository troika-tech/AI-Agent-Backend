# Frontend Integration Guide: Suggestion Questions

This guide shows how to integrate the dynamic suggestion questions feature into your chatbot frontend.

## API Response Structure

When you send a chat query, the response now includes a `suggestions` array:

```javascript
{
  "answer": "Our service offers automated responses, analytics, and multi-language support.",
  "suggestions": [
    "What languages are supported?",
    "How does the analytics work?",
    "What are the pricing plans?"
  ],
  "tokens": 150,
  "sessionId": "abc-123",
  // ... other fields
}
```

## React Example

### Basic Implementation

```jsx
import React, { useState } from 'react';
import './ChatWidget.css';

function ChatWidget({ chatbotId, sessionId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const sendMessage = async (messageText) => {
    // Add user message to UI
    setMessages(prev => [...prev, {
      sender: 'user',
      content: messageText,
      timestamp: new Date()
    }]);

    setLoading(true);
    
    try {
      const response = await fetch('/api/chat/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: messageText,
          chatbotId,
          sessionId,
        }),
      });

      const data = await response.json();

      // Add bot response to UI
      setMessages(prev => [...prev, {
        sender: 'bot',
        content: data.answer,
        timestamp: new Date()
      }]);

      // Update suggestions for next message
      setSuggestions(data.suggestions || []);

    } catch (error) {
      console.error('Error sending message:', error);
      // Handle error appropriately
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    sendMessage(suggestion);
  };

  return (
    <div className="chat-widget">
      {/* Messages Display */}
      <div className="messages-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {loading && <div className="typing-indicator">Bot is typing...</div>}
      </div>

      {/* Suggestion Buttons */}
      {suggestions.length > 0 && !loading && (
        <div className="suggestions-container">
          <p className="suggestions-label">You might also ask:</p>
          <div className="suggestions-buttons">
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
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
          className="message-input"
        />
        <button 
          type="submit" 
          disabled={loading || !input.trim()}
          className="send-button"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatWidget;
```

### CSS Styling

```css
/* ChatWidget.css */

.chat-widget {
  display: flex;
  flex-direction: column;
  height: 600px;
  max-width: 400px;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 16px;
  word-wrap: break-word;
}

.message.user {
  align-self: flex-end;
  background: #007bff;
  color: white;
  border-bottom-right-radius: 4px;
}

.message.bot {
  align-self: flex-start;
  background: #f1f3f4;
  color: #333;
  border-bottom-left-radius: 4px;
}

.typing-indicator {
  align-self: flex-start;
  padding: 12px 16px;
  background: #f1f3f4;
  border-radius: 16px;
  font-style: italic;
  color: #666;
}

/* Suggestion Buttons Styling */
.suggestions-container {
  padding: 12px 20px;
  border-top: 1px solid #e0e0e0;
  background: #fafafa;
}

.suggestions-label {
  font-size: 12px;
  color: #666;
  margin: 0 0 8px 0;
  font-weight: 500;
}

.suggestions-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-button {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 10px 14px;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: all 0.2s ease;
}

.suggestion-button:hover {
  background: #007bff;
  color: white;
  border-color: #007bff;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.suggestion-button:active {
  transform: translateY(0);
}

/* Input Form Styling */
.input-form {
  display: flex;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background: #fff;
  gap: 8px;
}

.message-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e0e0e0;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
}

.message-input:focus {
  border-color: #007bff;
}

.message-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.send-button {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s ease;
}

.send-button:hover:not(:disabled) {
  background: #0056b3;
}

.send-button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
```

## Vanilla JavaScript Example

```javascript
class ChatbotWidget {
  constructor(chatbotId, sessionId) {
    this.chatbotId = chatbotId;
    this.sessionId = sessionId;
    this.suggestions = [];
    
    this.initializeElements();
    this.attachEventListeners();
  }

  initializeElements() {
    this.messagesContainer = document.getElementById('messages');
    this.suggestionsContainer = document.getElementById('suggestions');
    this.inputField = document.getElementById('message-input');
    this.sendButton = document.getElementById('send-button');
  }

  attachEventListeners() {
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  async sendMessage(text = null) {
    const message = text || this.inputField.value.trim();
    if (!message) return;

    // Display user message
    this.addMessage('user', message);
    this.inputField.value = '';
    this.inputField.disabled = true;
    this.sendButton.disabled = true;

    try {
      const response = await fetch('/api/chat/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: message,
          chatbotId: this.chatbotId,
          sessionId: this.sessionId
        })
      });

      const data = await response.json();

      // Display bot response
      this.addMessage('bot', data.answer);

      // Update suggestions
      this.updateSuggestions(data.suggestions || []);

    } catch (error) {
      console.error('Error:', error);
      this.addMessage('bot', 'Sorry, something went wrong. Please try again.');
    } finally {
      this.inputField.disabled = false;
      this.sendButton.disabled = false;
      this.inputField.focus();
    }
  }

  addMessage(sender, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = content;
    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  updateSuggestions(suggestions) {
    this.suggestions = suggestions;
    this.suggestionsContainer.innerHTML = '';

    if (suggestions.length === 0) {
      this.suggestionsContainer.style.display = 'none';
      return;
    }

    this.suggestionsContainer.style.display = 'block';

    const label = document.createElement('p');
    label.textContent = 'You might also ask:';
    label.className = 'suggestions-label';
    this.suggestionsContainer.appendChild(label);

    suggestions.forEach(suggestion => {
      const button = document.createElement('button');
      button.className = 'suggestion-button';
      button.textContent = suggestion;
      button.onclick = () => this.sendMessage(suggestion);
      this.suggestionsContainer.appendChild(button);
    });
  }
}

// Initialize the widget
const chatbot = new ChatbotWidget('your-chatbot-id', 'session-id');
```

## Vue.js Example

```vue
<template>
  <div class="chat-widget">
    <div class="messages-container" ref="messagesContainer">
      <div 
        v-for="(message, index) in messages" 
        :key="index"
        :class="['message', message.sender]"
      >
        {{ message.content }}
      </div>
      <div v-if="loading" class="typing-indicator">
        Bot is typing...
      </div>
    </div>

    <!-- Suggestion Buttons -->
    <div v-if="suggestions.length > 0 && !loading" class="suggestions-container">
      <p class="suggestions-label">You might also ask:</p>
      <button
        v-for="(suggestion, index) in suggestions"
        :key="index"
        class="suggestion-button"
        @click="handleSuggestionClick(suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>

    <!-- Input Form -->
    <form @submit.prevent="handleSubmit" class="input-form">
      <input
        v-model="input"
        type="text"
        placeholder="Type your message..."
        :disabled="loading"
        class="message-input"
      />
      <button 
        type="submit" 
        :disabled="loading || !input.trim()"
        class="send-button"
      >
        Send
      </button>
    </form>
  </div>
</template>

<script>
export default {
  name: 'ChatWidget',
  props: {
    chatbotId: {
      type: String,
      required: true
    },
    sessionId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      messages: [],
      input: '',
      suggestions: [],
      loading: false
    };
  },
  methods: {
    async sendMessage(messageText) {
      this.messages.push({
        sender: 'user',
        content: messageText,
        timestamp: new Date()
      });

      this.loading = true;

      try {
        const response = await fetch('/api/chat/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: messageText,
            chatbotId: this.chatbotId,
            sessionId: this.sessionId
          })
        });

        const data = await response.json();

        this.messages.push({
          sender: 'bot',
          content: data.answer,
          timestamp: new Date()
        });

        this.suggestions = data.suggestions || [];

      } catch (error) {
        console.error('Error:', error);
      } finally {
        this.loading = false;
        this.input = '';
        this.$nextTick(() => {
          this.scrollToBottom();
        });
      }
    },
    handleSubmit() {
      if (this.input.trim()) {
        this.sendMessage(this.input);
      }
    },
    handleSuggestionClick(suggestion) {
      this.sendMessage(suggestion);
    },
    scrollToBottom() {
      const container = this.$refs.messagesContainer;
      container.scrollTop = container.scrollHeight;
    }
  }
};
</script>

<style scoped>
/* Use the same CSS as shown in the React example */
</style>
```

## Best Practices

### 1. User Experience
- **Clear Visual Distinction**: Make suggestion buttons visually distinct from regular UI elements
- **Smooth Transitions**: Use CSS transitions when showing/hiding suggestions
- **Accessibility**: Ensure buttons are keyboard accessible and have proper ARIA labels

### 2. Performance
- **Debounce Clicks**: Prevent multiple rapid clicks on suggestion buttons
- **Loading States**: Show loading indicators while waiting for responses
- **Error Handling**: Gracefully handle cases where suggestions aren't provided

### 3. Responsive Design
```css
/* Mobile-friendly suggestions */
@media (max-width: 768px) {
  .suggestion-button {
    font-size: 13px;
    padding: 8px 12px;
  }
  
  .suggestions-buttons {
    gap: 6px;
  }
}
```

### 4. Analytics (Optional)
Track suggestion usage for insights:

```javascript
const handleSuggestionClick = (suggestion, index) => {
  // Track analytics
  if (window.analytics) {
    window.analytics.track('Suggestion Clicked', {
      suggestion,
      position: index,
      chatbotId,
      sessionId
    });
  }
  
  // Send message
  sendMessage(suggestion);
};
```

## Testing the Integration

1. **Send a test query**:
   ```javascript
   POST /api/chat/query
   {
     "query": "Tell me about your services",
     "chatbotId": "your-chatbot-id",
     "sessionId": "test-session"
   }
   ```

2. **Verify response includes suggestions**:
   ```javascript
   {
     "answer": "...",
     "suggestions": ["...", "...", "..."],
     ...
   }
   ```

3. **Test suggestion click flow**:
   - Click a suggestion
   - Verify it sends as a new query
   - Verify new suggestions are generated

## Fallback Handling

Always handle cases where suggestions might not be available:

```javascript
// Safe access to suggestions
const displaySuggestions = data.suggestions && data.suggestions.length > 0;

if (displaySuggestions) {
  // Show suggestions UI
} else {
  // Hide suggestions UI or show default suggestions
}
```

## Additional Resources

- [Main Documentation](./SUGGESTION_QUESTIONS_FEATURE.md)
- [API Response Format](#api-response-structure)
- [Troubleshooting Guide](./SUGGESTION_QUESTIONS_FEATURE.md#troubleshooting)

