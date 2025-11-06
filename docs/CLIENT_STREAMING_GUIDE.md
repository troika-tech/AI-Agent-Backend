# Client Streaming Integration Guide

## Overview

This guide shows you how to integrate the streaming chat API into your chatbot widget or web application. Streaming provides a significantly better user experience with instant feedback (~500ms first response vs 8-11s full response).

---

## Quick Start

### Basic Streaming Request

```javascript
const streamChatQuery = async (query, chatbotId) => {
  const response = await fetch('https://your-api.com/api/chat/query/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({
      query: query,
      chatbotId: chatbotId,
      enableTTS: false // Set to true for audio streaming
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    // Process SSE events (see below)
    processSSEChunk(chunk);
  }
};
```

---

## Complete Implementation

### 1. Streaming Chat Client Class

```javascript
class StreamingChatClient {
  constructor(apiUrl, chatbotId) {
    this.apiUrl = apiUrl;
    this.chatbotId = chatbotId;
    this.sessionId = null;
  }

  /**
   * Send a streaming chat query
   * @param {string} query - User's question
   * @param {Object} options - Additional options
   * @param {Function} options.onText - Callback for text chunks
   * @param {Function} options.onAudio - Callback for audio chunks
   * @param {Function} options.onSuggestions - Callback for suggestions
   * @param {Function} options.onComplete - Callback for completion
   * @param {Function} options.onError - Callback for errors
   * @returns {Promise<Object>} Final result
   */
  async streamQuery(query, options = {}) {
    const {
      onText = () => {},
      onAudio = () => {},
      onSuggestions = () => {},
      onComplete = () => {},
      onError = () => {},
      enableTTS = false,
      language = 'en-IN'
    } = options;

    try {
      const response = await fetch(`${this.apiUrl}/api/chat/query/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
          query,
          chatbotId: this.chatbotId,
          sessionId: this.sessionId,
          enableTTS,
          language
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await this._processStream(response, {
        onText,
        onAudio,
        onSuggestions,
        onComplete,
        onError
      });

    } catch (error) {
      onError(error);
      throw error;
    }
  }

  async _processStream(response, callbacks) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('event:')) {
          const eventType = line.substring(6).trim();
          const dataLine = lines[i + 1];

          if (dataLine && dataLine.startsWith('data:')) {
            const dataStr = dataLine.substring(5).trim();

            try {
              const data = JSON.parse(dataStr);

              switch (eventType) {
                case 'connected':
                  console.log('Stream connected:', data.clientId);
                  break;

                case 'text':
                  fullText += data.content;
                  callbacks.onText(data.content);
                  break;

                case 'audio':
                  callbacks.onAudio(data.chunk, data.sequence);
                  break;

                case 'suggestions':
                  callbacks.onSuggestions(data.suggestions);
                  break;

                case 'complete':
                  // Save session ID for future requests
                  if (data.sessionId) {
                    this.sessionId = data.sessionId;
                  }
                  callbacks.onComplete(data);
                  return { fullText, metrics: data };

                case 'error':
                  const error = new Error(data.error);
                  error.code = data.code;
                  callbacks.onError(error);
                  throw error;

                case 'warning':
                  console.warn('Stream warning:', data.warning);
                  break;
              }
            } catch (parseError) {
              // Ignore heartbeats and other non-JSON data
              if (!dataStr.startsWith(':')) {
                console.warn('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      }
    }

    return { fullText };
  }

  /**
   * Fallback to non-streaming endpoint
   * Use this if streaming fails or is not supported
   */
  async queryNonStreaming(query, options = {}) {
    const response = await fetch(`${this.apiUrl}/api/chat/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        chatbotId: this.chatbotId,
        sessionId: this.sessionId,
        language: options.language || 'en-IN'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    // Save session ID
    if (data.sessionId) {
      this.sessionId = data.sessionId;
    }

    return data;
  }
}
```

---

### 2. Widget Integration Example

```javascript
class ChatbotWidget {
  constructor(containerEl, chatbotId, apiUrl) {
    this.container = containerEl;
    this.client = new StreamingChatClient(apiUrl, chatbotId);
    this.messages = [];

    this.setupUI();
  }

  setupUI() {
    this.container.innerHTML = `
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-container">
        <input type="text" id="chat-input" placeholder="Ask a question..." />
        <button id="chat-send">Send</button>
      </div>
    `;

    this.messagesContainer = document.getElementById('chat-messages');
    this.input = document.getElementById('chat-input');
    this.sendButton = document.getElementById('chat-send');

    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  async sendMessage() {
    const query = this.input.value.trim();
    if (!query) return;

    // Add user message
    this.addMessage('user', query);
    this.input.value = '';

    // Add bot message placeholder
    const botMessageEl = this.addMessage('bot', '');
    const textEl = botMessageEl.querySelector('.message-text');

    try {
      // Stream the response
      await this.client.streamQuery(query, {
        onText: (content) => {
          // Append text in real-time
          textEl.textContent += content;
          this.scrollToBottom();
        },

        onSuggestions: (suggestions) => {
          // Add suggestion buttons
          this.addSuggestions(suggestions);
        },

        onComplete: (metrics) => {
          console.log('Response complete:', metrics);
        },

        onError: (error) => {
          console.error('Streaming error:', error);
          textEl.textContent = 'Sorry, I encountered an error. Please try again.';
        }
      });

    } catch (error) {
      console.error('Failed to send message:', error);

      // Fallback to non-streaming
      try {
        const result = await this.client.queryNonStreaming(query);
        textEl.textContent = result.answer;
        if (result.suggestions) {
          this.addSuggestions(result.suggestions);
        }
      } catch (fallbackError) {
        textEl.textContent = 'Sorry, I am unable to respond right now.';
      }
    }
  }

  addMessage(sender, text) {
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${sender}`;
    messageEl.innerHTML = `
      <div class="message-avatar">${sender === 'user' ? '👤' : '🤖'}</div>
      <div class="message-content">
        <div class="message-text">${text}</div>
      </div>
    `;
    this.messagesContainer.appendChild(messageEl);
    this.scrollToBottom();
    return messageEl;
  }

  addSuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) return;

    const suggestionsEl = document.createElement('div');
    suggestionsEl.className = 'suggestions';

    suggestions.forEach(suggestion => {
      const btn = document.createElement('button');
      btn.className = 'suggestion-btn';
      btn.textContent = suggestion;
      btn.addEventListener('click', () => {
        this.input.value = suggestion;
        this.sendMessage();
      });
      suggestionsEl.appendChild(btn);
    });

    this.messagesContainer.appendChild(suggestionsEl);
    this.scrollToBottom();
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
}

// Initialize widget
const widget = new ChatbotWidget(
  document.getElementById('chatbot-container'),
  'your-chatbot-id',
  'https://your-api.com'
);
```

---

### 3. Audio Streaming Support

If `enableTTS: true`, you'll receive audio chunks. Here's how to handle them:

```javascript
class AudioStreamPlayer {
  constructor() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.queue = [];
    this.isPlaying = false;
  }

  /**
   * Add an audio chunk to the playback queue
   * @param {string} base64Chunk - Base64 encoded LINEAR16 PCM audio
   * @param {number} sequence - Sequence number for ordering
   */
  addChunk(base64Chunk, sequence) {
    try {
      const audioBuffer = this.decodeLinear16PCM(base64Chunk);
      this.queue.push({ buffer: audioBuffer, sequence });

      // Sort by sequence to ensure correct order
      this.queue.sort((a, b) => a.sequence - b.sequence);

      if (!this.isPlaying) {
        this.playNext();
      }
    } catch (error) {
      console.error('Failed to decode audio chunk:', error);
    }
  }

  /**
   * Decode LINEAR16 PCM audio from base64
   * @param {string} base64String - Base64 encoded audio data
   * @returns {AudioBuffer} Decoded audio buffer
   */
  decodeLinear16PCM(base64String, sampleRate = 24000) {
    // Decode base64
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert to Int16Array (LINEAR16 is 16-bit PCM)
    const samples = new Int16Array(bytes.buffer);

    // Create AudioBuffer
    const audioBuffer = this.audioContext.createBuffer(1, samples.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    // Normalize Int16 to Float32 [-1, 1]
    for (let i = 0; i < samples.length; i++) {
      channelData[i] = samples[i] / 32768.0;
    }

    return audioBuffer;
  }

  /**
   * Play the next audio chunk in queue
   */
  async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const { buffer } = this.queue.shift();

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    return new Promise(resolve => {
      source.onended = () => {
        resolve();
        this.playNext();
      };
      source.start(0);
    });
  }

  /**
   * Clear the audio queue and stop playback
   */
  clear() {
    this.queue = [];
    this.isPlaying = false;
  }
}

// Usage with streaming client
const audioPlayer = new AudioStreamPlayer();

client.streamQuery(query, {
  enableTTS: true,
  onText: (content) => displayText(content),
  onAudio: (chunk, sequence) => {
    audioPlayer.addChunk(chunk, sequence);
  }
});
```

---

## Error Handling & Fallbacks

### Automatic Fallback Pattern

```javascript
async function sendChatMessage(query) {
  try {
    // Try streaming first
    return await streamingClient.streamQuery(query, callbacks);
  } catch (streamError) {
    console.warn('Streaming failed, falling back to REST:', streamError);

    try {
      // Fallback to non-streaming
      return await streamingClient.queryNonStreaming(query);
    } catch (restError) {
      console.error('Both streaming and REST failed:', restError);
      throw new Error('Unable to connect to chat service');
    }
  }
}
```

### Timeout Handling

```javascript
function streamWithTimeout(query, timeout = 30000) {
  return Promise.race([
    client.streamQuery(query, callbacks),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
}
```

### Network Interruption Detection

```javascript
class StreamingChatClient {
  async streamQuery(query, options) {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 30000);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: abortController.signal
      });

      return await this._processStream(response, callbacks);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout or network interruption');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
```

---

## Browser Compatibility

| Browser | Streaming Support | Audio Support | Notes |
|---------|-------------------|---------------|-------|
| Chrome 80+ | ✅ Full | ✅ Full | Best performance |
| Firefox 75+ | ✅ Full | ✅ Full | Excellent support |
| Safari 14+ | ✅ Full | ⚠️ Requires polyfill | Need AudioContext polyfill |
| Edge 80+ | ✅ Full | ✅ Full | Full support |
| IE 11 | ❌ No SSE | ❌ Limited | Use REST fallback |
| Mobile Safari | ✅ Full | ⚠️ User gesture | Audio requires tap |
| Mobile Chrome | ✅ Full | ✅ Full | Full support |

### Polyfills

For older browsers, include:

```html
<!-- EventSource polyfill for IE/Edge -->
<script src="https://cdn.jsdelivr.net/npm/eventsource-polyfill@0.9.6/dist/eventsource.min.js"></script>

<!-- AudioContext polyfill for Safari < 14 -->
<script>
window.AudioContext = window.AudioContext || window.webkitAudioContext;
</script>
```

---

## Performance Best Practices

### 1. Connection Reuse

```javascript
// DON'T: Create new client for each message
messages.forEach(msg => {
  const client = new StreamingChatClient(url, chatbotId);
  client.streamQuery(msg);
});

// DO: Reuse client instance
const client = new StreamingChatClient(url, chatbotId);
messages.forEach(msg => client.streamQuery(msg));
```

### 2. Debounce User Input

```javascript
let debounceTimer;
input.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // Only send if user stops typing for 500ms
    sendTypingIndicator(e.target.value);
  }, 500);
});
```

### 3. Lazy Load Audio Player

```javascript
let audioPlayer = null;

function getAudioPlayer() {
  if (!audioPlayer) {
    audioPlayer = new AudioStreamPlayer();
  }
  return audioPlayer;
}

// Only initialize when audio is needed
if (enableTTS) {
  getAudioPlayer().addChunk(chunk, sequence);
}
```

### 4. Virtual Scrolling for Long Conversations

```javascript
// For chat histories with 100+ messages, use virtual scrolling
import VirtualScroll from 'virtual-scroll-library';

const virtualScroll = new VirtualScroll({
  container: messagesContainer,
  items: messages,
  itemHeight: 80
});
```

---

## Testing

### Manual Testing

```javascript
// Test with different scenarios
const testCases = [
  { query: 'Hello', expected: 'greeting' },
  { query: 'What are your prices?', expected: 'pricing info' },
  { query: 'Very long question...', expected: 'handles long text' }
];

for (const test of testCases) {
  console.log(`Testing: ${test.query}`);
  await client.streamQuery(test.query, {
    onComplete: (metrics) => {
      console.log(`✓ Passed: ${metrics.duration}ms`);
    },
    onError: (error) => {
      console.error(`✗ Failed: ${error.message}`);
    }
  });
}
```

### Load Testing

```javascript
// Simulate multiple concurrent users
async function loadTest(concurrentUsers = 10) {
  const promises = [];

  for (let i = 0; i < concurrentUsers; i++) {
    const client = new StreamingChatClient(url, chatbotId);
    promises.push(client.streamQuery(`Test query ${i}`));
  }

  const results = await Promise.allSettled(promises);
  const successes = results.filter(r => r.status === 'fulfilled').length;

  console.log(`${successes}/${concurrentUsers} requests succeeded`);
}
```

---

## Troubleshooting

### Issue: No text appears

**Symptoms:** Stream connects but no text is displayed.

**Solutions:**
1. Check if `onText` callback is being called
2. Verify SSE parsing is correct (check browser console)
3. Test with curl to see raw SSE events
4. Check if content is empty strings

### Issue: Audio doesn't play

**Symptoms:** Text streams correctly but no audio.

**Solutions:**
1. Verify `enableTTS: true` in request
2. Check browser audio permissions
3. Ensure AudioContext is initialized after user gesture
4. Check browser console for decoding errors
5. Verify base64 decode is working

### Issue: Stream disconnects randomly

**Symptoms:** Connection closes unexpectedly.

**Solutions:**
1. Check network stability
2. Verify firewall/proxy allows SSE
3. Implement reconnection logic
4. Check server logs for errors
5. Add heartbeat monitoring

### Issue: High latency

**Symptoms:** Slow response times.

**Solutions:**
1. Check network latency (ping API server)
2. Verify API server performance
3. Check if Redis cache is working
4. Review OpenAI API response times
5. Consider CDN for static assets

---

## Migration Checklist

- [ ] Install/update API client library
- [ ] Implement streaming client class
- [ ] Update widget to use streaming
- [ ] Add error handling and fallbacks
- [ ] Test on all target browsers
- [ ] Add audio support (if needed)
- [ ] Implement loading states
- [ ] Add retry logic
- [ ] Update UI for real-time display
- [ ] Test with slow networks
- [ ] Monitor error rates
- [ ] Gather user feedback

---

## Support

For issues or questions:
- **API Documentation:** See [STREAMING_API.md](./STREAMING_API.md)
- **Backend Guide:** See [STREAMING_IMPLEMENTATION_PLAN.md](./STREAMING_IMPLEMENTATION_PLAN.md)
- **GitHub Issues:** Report bugs and feature requests
- **Email Support:** contact@your-company.com

---

**Last Updated:** January 2025
