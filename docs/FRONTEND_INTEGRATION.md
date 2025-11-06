# Frontend Integration Guide

## Intelligent Chat API - Frontend Integration

This guide shows how to integrate the Intelligent Chat API into your frontend, exactly like the existing chat route.

---

## Basic Integration (Minimal Payload)

### **Request Format**

```javascript
const requestData = {
  chatbotId: "60d5f484f8d2c45a7c8e1234",  // Required: Your chatbot ID
  query: "What is your refund policy?",     // Required: User's question
  sessionId: "sess_1736446800123_abc",      // Optional: For conversation continuity
  phone: "9999999999"                        // Optional: User's phone number
};

const response = await fetch('/api/troika/intelligent-chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(requestData)
});

const data = await response.json();
```

### **Response Format**

```javascript
{
  success: true,
  data: {
    answer: "Our refund policy allows...",      // ← Display this to user
    sessionId: "sess_1736446800123_abc",        // ← Save for next request
    intelligenceLevel: "SUBTLE",
    intent: { category: "faq", ... },
    intelligenceUsed: 0,
    citations: [],
    metadata: { isFollowUp: false, ... }
  }
}
```

---

## Complete React Example

```jsx
import { useState, useEffect } from 'react';

function IntelligentChatWidget({ chatbotId }) {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (textToSend) => {
    if (!textToSend.trim()) return;

    // Add user message to UI
    const userMessage = { role: 'user', content: textToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Call Intelligent Chat API
      const requestData = {
        chatbotId,
        query: textToSend,
        sessionId,
        phone: "9999999999"  // Optional: Get from user profile
      };

      const response = await fetch('/api/troika/intelligent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();

      if (data.success) {
        // Save session ID for conversation continuity
        if (data.data.sessionId) {
          setSessionId(data.data.sessionId);
        }

        // Add bot response to UI
        const botMessage = {
          role: 'bot',
          content: data.data.answer,
          intelligenceLevel: data.data.intelligenceLevel,
          citations: data.data.citations
        };
        setMessages(prev => [...prev, botMessage]);

        // Optional: Show citations if available
        if (data.data.citations && data.data.citations.length > 0) {
          console.log('Sources:', data.data.citations);
        }
      } else {
        throw new Error(data.message || 'Failed to get response');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        role: 'bot',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-widget">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {msg.content}
            {msg.citations && msg.citations.length > 0 && (
              <div className="citations">
                Sources: {msg.citations.map(c => c.source).join(', ')}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="loading">Thinking...</div>}
      </div>

      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && sendMessage(input)}
        placeholder="Ask me anything..."
      />
      <button onClick={() => sendMessage(input)} disabled={loading}>
        Send
      </button>
    </div>
  );
}

export default IntelligentChatWidget;
```

---

## With TTS Support (Voice Output)

```javascript
const [audioUrl, setAudioUrl] = useState(null);

const sendMessage = async (textToSend) => {
  const requestData = {
    chatbotId,
    query: textToSend,
    sessionId,
    phone: "9999999999",
    enableTTS: true  // ← Enable voice output
  };

  const response = await fetch('/api/troika/intelligent-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData)
  });

  const data = await response.json();

  if (data.success) {
    // Display text
    const botMessage = { role: 'bot', content: data.data.answer };
    setMessages(prev => [...prev, botMessage]);

    // Play audio if available
    if (data.data.audio) {
      const audio = new Audio(data.data.audio);
      audio.play();
      setAudioUrl(data.data.audio); // Save for replay
    }
  }
};
```

---

## Voice Input + Voice Output

```jsx
const sendVoiceMessage = async (audioBlob) => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('chatbotId', chatbotId);
  formData.append('sessionId', sessionId);
  formData.append('phone', '9999999999');
  formData.append('enableTTS', 'true');  // Get voice response

  const response = await fetch('/api/troika/intelligent-chat/voice', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();

  if (data.success) {
    // Show transcription
    console.log('You said:', data.data.transcription.text);

    // Show bot response
    const botMessage = { role: 'bot', content: data.data.answer };
    setMessages(prev => [...prev, botMessage]);

    // Play audio response
    if (data.data.audio) {
      const audio = new Audio(data.data.audio);
      audio.play();
    }
  }
};
```

---

## Vanilla JavaScript Example

```javascript
// Simple vanilla JS integration
async function sendChatMessage(query) {
  const chatbotId = 'YOUR_CHATBOT_ID';
  const sessionId = localStorage.getItem('chatSessionId');

  const response = await fetch('/api/troika/intelligent-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatbotId,
      query,
      sessionId,
      phone: '9999999999'
    })
  });

  const data = await response.json();

  if (data.success) {
    // Save session for next message
    localStorage.setItem('chatSessionId', data.data.sessionId);

    // Display answer
    document.getElementById('bot-response').textContent = data.data.answer;

    // Show citations if available
    if (data.data.citations.length > 0) {
      const citationsHtml = data.data.citations
        .map(c => `<a href="${c.url}" target="_blank">${c.source}</a>`)
        .join(', ');
      document.getElementById('citations').innerHTML = `Sources: ${citationsHtml}`;
    }

    return data.data.answer;
  }
}

// Usage
sendChatMessage('What are your pricing plans?');
```

---

## Optional Parameters

You can include additional parameters for enhanced features:

```javascript
const requestData = {
  // Required
  chatbotId: "60d5f484f8d2c45a7c8e1234",
  query: "What services do you offer?",

  // Optional - Conversation tracking
  sessionId: "sess_123",
  phone: "9999999999",
  email: "user@example.com",

  // Optional - Language
  language: "hi",  // 'en', 'hi', etc.

  // Optional - Context for personalization
  context: {
    industry: "Real Estate",
    services: ["Supa Agent", "WhatsApp Marketing"]
  },

  // Optional - Voice output
  enableTTS: true
};
```

---

## Response Fields Explained

| Field | Type | Description |
|-------|------|-------------|
| `answer` | string | **Main bot response** - Display this to the user |
| `sessionId` | string | **Save this** for next request (conversation continuity) |
| `intelligenceLevel` | string | Type of intelligence used (NONE, SUBTLE, DATA_POINTS, EXPLICIT, RECENT_UPDATES) |
| `intent.category` | string | Detected intent category |
| `intelligenceUsed` | number | Number of market intelligence sources used |
| `citations` | array | Sources cited (show to user for transparency) |
| `audio` | string | Base64 audio data URL (if `enableTTS: true`) |
| `processedText` | string | Text that was converted to speech |

---

## Error Handling

```javascript
try {
  const response = await fetch('/api/troika/intelligent-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData)
  });

  const data = await response.json();

  if (!data.success) {
    console.error('Error:', data.message);
    // Show error to user
    alert(data.message || 'Failed to get response');
    return;
  }

  // Success - use data.data.answer
  console.log('Bot says:', data.data.answer);

} catch (error) {
  console.error('Network error:', error);
  alert('Connection failed. Please check your internet.');
}
```

---

## Best Practices

### 1. **Always Save Session ID**
```javascript
// Save session for conversation continuity
if (data.data.sessionId) {
  localStorage.setItem('chatSessionId', data.data.sessionId);
}
```

### 2. **Show Citations for Transparency**
```javascript
if (data.data.citations.length > 0) {
  console.log('This answer uses data from:',
    data.data.citations.map(c => c.source).join(', ')
  );
}
```

### 3. **Handle Different Intelligence Levels**
```javascript
if (data.data.intelligenceLevel === 'EXPLICIT') {
  // This is a competitive comparison - show citations prominently
  showCitations(data.data.citations);
}
```

### 4. **Reuse Audio**
```javascript
// Save audio URL for replay button
if (data.data.audio) {
  setAudioUrl(data.data.audio);
  // User can replay later without API call
}
```

---

## Migration from Existing Chat Route

If you're using the existing `/api/chat/query` route, migration is simple:

### **Before (Existing Route)**
```javascript
const requestData = {
  chatbotId,
  query: textToSend,
  sessionId,
  phone: "9999999999"
};

fetch('/api/chat/query', { ... });
```

### **After (Intelligent Chat Route)**
```javascript
const requestData = {
  chatbotId,          // ← Same
  query: textToSend,  // ← Same
  sessionId,          // ← Same
  phone: "9999999999" // ← Same
};

fetch('/api/troika/intelligent-chat', { ... });  // ← Just change URL!
```

**Response handling:** Same structure, just access `data.data.answer` instead of `data.answer`.

---

## Testing

Test the API with curl:

```bash
curl -X POST http://localhost:5000/api/troika/intelligent-chat \
  -H "Content-Type: application/json" \
  -d '{
    "chatbotId": "60d5f484f8d2c45a7c8e1234",
    "query": "What are your pricing plans?",
    "sessionId": "sess_test_123",
    "phone": "9999999999"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "answer": "Our pricing plans start at ₹2,999/month...",
    "sessionId": "sess_test_123",
    ...
  }
}
```

---

## Summary

**Minimal Request:**
```javascript
{
  chatbotId: "60d5f484f8d2c45a7c8e1234",
  query: "Your question here",
  sessionId: "sess_123",
  phone: "9999999999"
}
```

**Response:**
```javascript
{
  success: true,
  data: {
    answer: "Bot response here",
    sessionId: "sess_123",
    // ... other metadata
  }
}
```

That's it! The intelligent chat works exactly like your existing chat route, with added market intelligence! 🚀
