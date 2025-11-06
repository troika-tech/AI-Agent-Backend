# Streaming Response Architecture - Complete Technical Guide

Comprehensive documentation of the streaming response system for the chatbot backend.

## Table of Contents
- [Overview](#overview)
- [Why Streaming?](#why-streaming)
- [Architecture](#architecture)
- [Server-Sent Events (SSE)](#server-sent-events-sse)
- [Implementation Details](#implementation-details)
- [API Endpoints](#api-endpoints)
- [Event Types](#event-types)
- [TTS Audio Streaming](#tts-audio-streaming)
- [Caching Strategy](#caching-strategy)
- [Error Handling](#error-handling)
- [Performance](#performance)
- [Security Considerations](#security-considerations)
- [Client Implementation Guide](#client-implementation-guide)

---

## Overview

The streaming response system transforms the chatbot from a traditional request-response model to a real-time streaming model, providing instant feedback to users as the AI generates responses.

### Key Benefits

1. **Faster Time to First Response**: ~500ms vs 8-11s
2. **Better User Experience**: Users see responses appearing in real-time
3. **Reduced Perceived Latency**: Progressive rendering keeps users engaged
4. **Efficient TTS Delivery**: Audio plays as soon as first sentence is ready
5. **Scalable Architecture**: Handles concurrent streams efficiently

### System Comparison

| Metric | Traditional | Streaming | Improvement |
|--------|------------|-----------|-------------|
| First Response | 8-11s | ~500ms | **16-22x faster** |
| Complete Response | 8-11s | 2-3s | **3-4x faster** |
| User Engagement | Wait for complete response | See instant progress | **Significantly better** |
| TTS Latency | Full text ready first | Streams per sentence | **Instant playback** |

---

## Why Streaming?

### Problem Statement

Traditional chatbot architecture had several issues:

1. **Long Wait Times**: Users waited 8-11 seconds for complete responses
2. **Poor UX**: No feedback during AI processing
3. **Inefficient TTS**: Had to wait for complete text before generating audio
4. **Timeout Risks**: Long responses risked HTTP timeouts
5. **Resource Waste**: Server held connections open while processing

### Streaming Solution

Streaming addresses these issues by:

1. **Progressive Delivery**: Send tokens as they're generated
2. **Instant Feedback**: Users see response building in real-time
3. **Parallel TTS**: Generate audio while streaming text
4. **Long-Running Connections**: SSE handles extended connections efficiently
5. **Better Resource Usage**: Asynchronous processing

---

## Architecture

### High-Level Flow

```
┌─────────┐      HTTP/SSE      ┌──────────────┐
│ Client  │ ───────────────────> │   Nginx      │
│(Browser)│                      │ (Reverse     │
└─────────┘                      │  Proxy)      │
     │                           └──────────────┘
     │                                   │
     │                                   ▼
     │                           ┌──────────────┐
     │                           │   Express    │
     │                           │   Server     │
     │                           └──────────────┘
     │                                   │
     │                                   ▼
     │                           ┌──────────────┐
     │                           │  Streaming   │
     │                           │  Controller  │
     │                           └──────────────┘
     │                                   │
     │                   ┌───────────────┴────────────────┐
     │                   ▼                                 ▼
     │           ┌───────────────┐              ┌──────────────────┐
     │           │ Streaming     │              │ Streaming Voice  │
     │           │ Response      │              │ Service (TTS)    │
     │           │ Service       │              └──────────────────┘
     │           └───────────────┘                       │
     │                   │                               │
     │                   ▼                               ▼
     │           ┌───────────────┐              ┌──────────────────┐
     │           │   OpenAI      │              │  Google Cloud    │
     │           │   Streaming   │              │  TTS API         │
     │           │   API         │              └──────────────────┘
     │           └───────────────┘
     │                   │
     │                   │
     ▼                   ▼
┌──────────────────────────┐
│  SSE Event Stream        │
│  ┌────────────────────┐  │
│  │ event: text        │  │
│  │ data: "Hello"      │  │
│  │                    │  │
│  │ event: text        │  │
│  │ data: " world"     │  │
│  │                    │  │
│  │ event: audio       │  │
│  │ data: {base64...}  │  │
│  │                    │  │
│  │ event: done        │  │
│  │ data: {...}        │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

### Component Breakdown

#### 1. Client Layer
- Opens SSE connection to backend
- Receives streaming events in real-time
- Renders text progressively
- Plays audio as it arrives

#### 2. Nginx Layer
- Reverse proxy for the backend
- **Critical**: Disables buffering for SSE routes
- Handles SSL/TLS termination
- Load balancing across PM2 instances

#### 3. Express Server
- Handles SSE connections
- Routes to appropriate streaming endpoints
- Manages connection lifecycle
- Applies rate limiting

#### 4. Controller Layer
- Validates incoming requests
- Retrieves conversation history
- Manages KB context retrieval
- Orchestrates streaming services
- Tracks metrics

#### 5. Streaming Services
- **StreamingResponseService**: Orchestrates OpenAI + TTS
- **StreamingVoiceService**: Handles Google Cloud TTS
- **SentenceDetector**: Splits text into sentences for TTS
- **SSEHelper**: Formats SSE events

#### 6. External APIs
- **OpenAI API**: Generates AI responses (streaming mode)
- **Google Cloud TTS**: Converts text to audio (streaming)

#### 7. Data Layer
- **MongoDB**: Stores chatbot config, history, KB
- **Redis**: Caches KB context and TTS audio

---

## Server-Sent Events (SSE)

### What is SSE?

Server-Sent Events is a web standard for unidirectional server-to-client streaming over HTTP.

### SSE vs WebSockets

| Feature | SSE | WebSockets |
|---------|-----|------------|
| Direction | Server → Client | Bidirectional |
| Protocol | HTTP/HTTPS | WS/WSS (custom) |
| Reconnection | Automatic | Manual |
| Complexity | Simple | Complex |
| Use Case | Server updates | Real-time communication |
| Browser Support | Excellent | Excellent |

**Why SSE for this project?**
- Only need server → client streaming
- Simpler than WebSockets
- Works over standard HTTP/HTTPS
- Automatic reconnection
- Built-in browser support

### SSE Message Format

```
event: <event_type>
data: <json_payload>
id: <optional_event_id>

```

**Example**:
```
event: text
data: {"token":"Hello"}

event: audio
data: {"audioContent":"SGVsbG8gd29ybGQ=","index":0}

event: done
data: {"success":true,"metrics":{"duration":2500}}

```

**Key Points**:
- Each field is on a separate line
- `data:` field contains JSON payload
- Empty line separates events
- `event:` specifies the event type
- Browser's `EventSource` API handles parsing

---

## Implementation Details

### Core Services

#### 1. StreamingResponseService

**Purpose**: Main orchestrator for streaming AI responses with optional TTS

**Location**: [services/streamingResponseService.js](../services/streamingResponseService.js)

**Key Features**:
- Streams text from OpenAI API
- Detects sentences using SentenceDetector
- Triggers TTS for complete sentences
- Manages multiple concurrent streams
- Tracks active streams for memory management
- Emits SSE events for text, audio, and completion

**Main Method**:
```javascript
async *streamResponse({
  chatbotId,
  query,
  conversationHistory,
  kbContext,
  userLanguageCode,
  enableTTS = false,
  clientId = null,
}) {
  // Setup
  const streamId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  this.activeStreams.add(streamId);

  try {
    // 1. Get chatbot config
    const chatbot = await Chatbot.findById(chatbotId);

    // 2. Build system prompt
    const systemPrompt = buildSystemPrompt(chatbot, kbContext);

    // 3. Stream from OpenAI
    const stream = await openai.chat.completions.create({
      model: chatbot.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: query }
      ],
      stream: true, // Enable streaming
      temperature: chatbot.temperature
    });

    // 4. Process stream
    let fullAnswer = '';
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';

      if (token) {
        fullAnswer += token;

        // Yield text event
        yield { type: 'text', data: token };

        // Add to sentence detector
        if (enableTTS) {
          sentenceDetector.addText(token);

          // Check for complete sentences
          const sentences = sentenceDetector.getSentences();
          for (const sentence of sentences) {
            // Generate and stream TTS
            const audioStream = voiceService.streamVoice(sentence, userLanguageCode);
            for await (const audioChunk of audioStream) {
              yield { type: 'audio', data: audioChunk };
            }
          }
        }
      }
    }

    // 5. Handle remaining text for TTS
    if (enableTTS) {
      const finalSentence = sentenceDetector.flush();
      if (finalSentence) {
        const audioStream = voiceService.streamVoice(finalSentence, userLanguageCode);
        for await (const audioChunk of audioStream) {
          yield { type: 'audio', data: audioChunk };
        }
      }
    }

    // 6. Yield completion event
    yield {
      type: 'done',
      data: {
        success: true,
        fullAnswer,
        metrics: { duration, wordCount, audioChunks }
      }
    };

  } finally {
    // Cleanup
    this.activeStreams.delete(streamId);
    // Clean up resources
  }
}
```

#### 2. StreamingVoiceService

**Purpose**: Handles Google Cloud TTS streaming with caching

**Location**: [services/streamingVoiceService.js](../services/streamingVoiceService.js)

**Key Features**:
- Streams TTS audio from Google Cloud
- Caches audio with 1-hour TTL
- Chunks large audio into manageable pieces
- Handles multiple language codes
- Base64 encodes audio for SSE transmission

**Main Method**:
```javascript
async *streamVoice(text, languageCode = 'en-US') {
  // 1. Check cache
  const cacheKey = this.getCacheKey(text, languageCode);
  const cachedAudio = await redisClient.get(cacheKey);

  if (cachedAudio) {
    // Stream cached audio in chunks
    yield* this.chunkAudio(cachedAudio, 0);
    return;
  }

  // 2. Generate TTS
  const request = {
    input: { text },
    voice: {
      languageCode,
      name: this.getVoiceName(languageCode)
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.0,
      pitch: 0.0
    }
  };

  const [response] = await this.client.synthesizeSpeech(request);
  const audioContent = response.audioContent;

  // 3. Cache audio
  await redisClient.setex(cacheKey, 3600, audioContent); // 1 hour TTL

  // 4. Stream audio in chunks
  yield* this.chunkAudio(audioContent, 0);
}
```

#### 3. SentenceDetector

**Purpose**: Detects sentence boundaries in streaming text

**Location**: [utils/sentenceDetector.js](../utils/sentenceDetector.js)

**Why Needed**: TTS works best on complete sentences, so we need to detect when a sentence ends while text is streaming.

**Key Features**:
- Detects multiple sentence terminators (. ! ? \n\n)
- Handles edge cases (abbreviations, URLs)
- Buffers partial sentences
- Flushes remaining text on stream end

**Example**:
```javascript
const detector = new SentenceDetector();

detector.addText("Hello world"); // No complete sentence yet
detector.addText(". How are you"); // Returns ["Hello world."]
detector.addText("?"); // Returns ["How are you?"]
const final = detector.flush(); // Returns any remaining text
```

#### 4. SSEHelper

**Purpose**: Formats data as SSE events

**Location**: [utils/sseHelper.js](../utils/sseHelper.js)

**Key Methods**:
```javascript
class SSEHelper {
  // Format any event
  static formatEvent(eventType, data) {
    return `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  // Format text token
  static formatTextEvent(token) {
    return this.formatEvent('text', { token });
  }

  // Format audio chunk
  static formatAudioEvent(audioContent, index) {
    return this.formatEvent('audio', {
      audioContent: audioContent.toString('base64'),
      index
    });
  }

  // Format completion
  static formatDoneEvent(data) {
    return this.formatEvent('done', data);
  }

  // Format error
  static formatErrorEvent(error) {
    return this.formatEvent('error', {
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
}
```

---

## API Endpoints

### 1. User Chatbot Streaming

**Endpoint**: `POST /api/chat/query/stream`

**Purpose**: Stream responses for general user chatbot queries

**Request**:
```json
{
  "chatbotId": "60f7b3b3e6b6f40015e6b6f4",
  "query": "What are your business hours?",
  "sessionId": "session-123",
  "enableTTS": true,
  "userLanguageCode": "en-US"
}
```

**Response**: SSE stream with events:
- `text`: Individual tokens as they're generated
- `audio`: TTS audio chunks (if enableTTS=true)
- `done`: Completion event with full response and metrics
- `error`: Error event if something fails

**Example Usage**:
```bash
curl -X POST http://localhost:5000/api/chat/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "chatbotId": "60f7b3b3e6b6f40015e6b6f4",
    "query": "Hello",
    "sessionId": "test-session",
    "enableTTS": false
  }'
```

**Implementation**: [controllers/chat/messageController.js](../controllers/chat/messageController.js)

### 2. Troika Intelligent Chat Streaming

**Endpoint**: `POST /api/troika/intelligent-chat/stream`

**Purpose**: Stream responses for the 3-phase intelligent sales system

**Request**:
```json
{
  "chatbotId": "60f7b3b3e6b6f40015e6b6f4",
  "query": "I need help with pricing",
  "sessionId": "session-456",
  "enableTTS": true,
  "userLanguageCode": "en-US",
  "context": {
    "currentPhase": "discovery",
    "userIntent": "pricing_inquiry"
  }
}
```

**Response**: Same SSE format as user chatbot

**Phases**:
1. **Discovery**: Understand user needs and context
2. **Solution Presentation**: Present tailored solutions
3. **Closure**: Handle objections and close

**Implementation**: [controllers/troikaIntelligentChatController.js](../controllers/troikaIntelligentChatController.js)

---

## Event Types

### Text Event

**Purpose**: Stream individual text tokens as AI generates them

**Format**:
```
event: text
data: {"token":"Hello"}

```

**Payload**:
```typescript
{
  token: string  // Individual token (word or partial word)
}
```

**Client Handling**:
```javascript
eventSource.addEventListener('text', (event) => {
  const data = JSON.parse(event.data);
  appendTextToUI(data.token);
});
```

### Audio Event

**Purpose**: Stream TTS audio chunks for progressive playback

**Format**:
```
event: audio
data: {"audioContent":"SGVsbG8gd29ybGQ=","index":0}

```

**Payload**:
```typescript
{
  audioContent: string  // Base64-encoded MP3 audio
  index: number         // Chunk sequence number
}
```

**Client Handling**:
```javascript
eventSource.addEventListener('audio', (event) => {
  const data = JSON.parse(event.data);
  const audioBlob = base64ToBlob(data.audioContent, 'audio/mp3');
  playAudio(audioBlob);
});
```

### Done Event

**Purpose**: Signal completion and provide final metrics

**Format**:
```
event: done
data: {"success":true,"fullAnswer":"Hello world","metrics":{...}}

```

**Payload**:
```typescript
{
  success: boolean
  fullAnswer: string
  metrics: {
    duration: number           // Total time (ms)
    wordCount: number          // Number of words
    firstTokenLatency?: number // Time to first token (ms)
    firstAudioLatency?: number // Time to first audio (ms)
    audioChunks?: number       // Number of audio chunks sent
  }
  conversationId?: string      // MongoDB conversation ID
}
```

**Client Handling**:
```javascript
eventSource.addEventListener('done', (event) => {
  const data = JSON.parse(event.data);
  console.log('Stream complete:', data.metrics);
  eventSource.close();
  onStreamComplete(data);
});
```

### Error Event

**Purpose**: Communicate errors during streaming

**Format**:
```
event: error
data: {"message":"OpenAI API error","code":"OPENAI_ERROR"}

```

**Payload**:
```typescript
{
  message: string     // Human-readable error message
  code: string        // Error code for programmatic handling
  details?: any       // Optional additional details
}
```

**Error Codes**:
- `OPENAI_ERROR`: OpenAI API failure
- `TTS_ERROR`: Google Cloud TTS failure
- `KB_ERROR`: Knowledge base retrieval failure
- `VALIDATION_ERROR`: Invalid request parameters
- `RATE_LIMIT_ERROR`: Rate limit exceeded
- `UNKNOWN_ERROR`: Unexpected error

**Client Handling**:
```javascript
eventSource.addEventListener('error', (event) => {
  const data = JSON.parse(event.data);
  console.error('Stream error:', data);
  eventSource.close();
  showErrorToUser(data.message);
});
```

---

## TTS Audio Streaming

### How It Works

1. **Sentence Detection**: As text streams, SentenceDetector identifies complete sentences
2. **Parallel TTS**: Each complete sentence is sent to Google Cloud TTS
3. **Audio Streaming**: TTS audio is streamed back in chunks alongside text
4. **Progressive Playback**: Client plays audio as soon as first chunk arrives

### Sentence Detection Algorithm

```javascript
// Detect sentence boundaries
const SENTENCE_TERMINATORS = ['.', '!', '?', '\n\n'];

addText(text) {
  this.buffer += text;
  const sentences = [];

  for (const terminator of SENTENCE_TERMINATORS) {
    const parts = this.buffer.split(terminator);

    if (parts.length > 1) {
      // Found complete sentence(s)
      for (let i = 0; i < parts.length - 1; i++) {
        const sentence = parts[i].trim() + terminator;
        if (sentence.length > 3) {
          sentences.push(sentence);
        }
      }
      // Keep the last part in buffer (incomplete)
      this.buffer = parts[parts.length - 1];
    }
  }

  return sentences;
}
```

### Audio Format

- **Encoding**: MP3
- **Sample Rate**: 24kHz (Google Cloud default)
- **Transmission**: Base64-encoded in SSE events
- **Chunk Size**: ~32KB per chunk

### Voice Configuration

```javascript
// Default voice configuration by language
const VOICE_CONFIG = {
  'en-US': { name: 'en-US-Chirp-HD', gender: 'NEUTRAL' },
  'en-GB': { name: 'en-GB-Chirp-HD', gender: 'NEUTRAL' },
  'es-ES': { name: 'es-ES-Chirp-HD', gender: 'NEUTRAL' },
  'fr-FR': { name: 'fr-FR-Chirp-HD', gender: 'NEUTRAL' },
  // ... more languages
};
```

### TTS Caching

**Cache Key Format**: `tts:${languageCode}:${md5(text)}`

**Example**:
```
tts:en-US:5d41402abc4b2a76b9719d911017c592
```

**TTL**: 1 hour (3600 seconds)

**Benefits**:
- Repeated sentences are instant
- Reduces Google Cloud API costs
- Improves response time for common phrases

---

## Caching Strategy

### Knowledge Base Context Cache

**What**: Vector search results for queries

**Cache Key**: `kb:${chatbotId}:${md5(query)}`

**TTL**: 10 minutes (600 seconds)

**Why**: During conversations, similar queries may occur. Caching avoids expensive vector searches.

**Hit Rate**: 60-70% expected

**Implementation**:
```javascript
// services/queryService.js
const response = await wrap({
  keyParts: ['kb', chatbotId, query],
  ttlSec: 600,
  fn: async () => vectorSearchByText({
    text: query,
    chatbotId,
    topK: 5
  })
});
```

### TTS Audio Cache

**What**: Generated audio for text segments

**Cache Key**: `tts:${languageCode}:${md5(text)}`

**TTL**: 1 hour (3600 seconds)

**Why**: Common phrases and responses are reused across conversations

**Hit Rate**: 50-60% expected

**Implementation**:
```javascript
// services/streamingVoiceService.js
const cacheKey = `tts:${languageCode}:${crypto.createHash('md5').update(text).digest('hex')}`;
const cachedAudio = await redisClient.get(cacheKey);

if (cachedAudio) {
  return cachedAudio; // Cache hit
}

// Generate TTS
const audioContent = await this.generateTTS(text, languageCode);
await redisClient.setex(cacheKey, 3600, audioContent);
return audioContent;
```

### Cache Warming (Optional)

For frequently used phrases, pre-populate cache:

```javascript
// scripts/warmCache.js
const commonPhrases = [
  "Hello, how can I help you today?",
  "Thank you for contacting us.",
  "Let me look that up for you."
];

for (const phrase of commonPhrases) {
  await streamingVoiceService.streamVoice(phrase, 'en-US');
}
```

---

## Error Handling

### Error Categories

#### 1. OpenAI Errors
- API rate limits
- Invalid model/parameters
- Network timeouts
- Service unavailable

**Handling**:
```javascript
try {
  const stream = await openai.chat.completions.create({...});
} catch (error) {
  if (error.status === 429) {
    // Rate limit - retry with backoff
  } else if (error.status >= 500) {
    // Server error - retry
  } else {
    // Client error - don't retry
  }
  yield { type: 'error', data: { code: 'OPENAI_ERROR', message: error.message } };
}
```

#### 2. TTS Errors
- Google Cloud API errors
- Invalid language code
- Text too long
- Network issues

**Handling**:
```javascript
try {
  const [response] = await this.client.synthesizeSpeech(request);
} catch (error) {
  // Log error but don't fail the whole stream
  logger.error('TTS error:', error);
  // Continue text streaming without audio
}
```

#### 3. Database Errors
- MongoDB connection lost
- Query timeouts
- Invalid chatbot ID

**Handling**:
```javascript
try {
  const chatbot = await Chatbot.findById(chatbotId);
  if (!chatbot) {
    throw new Error('Chatbot not found');
  }
} catch (error) {
  yield { type: 'error', data: { code: 'DB_ERROR', message: 'Database error' } };
  return;
}
```

#### 4. Client Disconnect
- User closes browser tab
- Network interruption
- Client-side timeout

**Handling**:
```javascript
// Check connection before expensive operations
if (!res.writable) {
  logger.info('Client disconnected, stopping stream');
  break;
}
```

### Graceful Degradation

**TTS Optional**: If TTS fails, continue streaming text

```javascript
if (enableTTS) {
  try {
    // Generate TTS
  } catch (error) {
    logger.error('TTS failed, continuing without audio:', error);
    // Don't throw - continue text streaming
  }
}
```

**Cache Optional**: If Redis is down, continue without caching

```javascript
let cachedData = null;
try {
  cachedData = await redisClient.get(cacheKey);
} catch (error) {
  logger.warn('Redis unavailable, skipping cache');
}

if (!cachedData) {
  // Generate fresh data
}
```

---

## Performance

### Latency Targets

| Metric | Target (p95) | Excellent | Acceptable | Poor |
|--------|--------------|-----------|------------|------|
| First Token | < 500ms | < 300ms | 500-1000ms | > 1000ms |
| First Audio | < 1500ms | < 1000ms | 1500-2000ms | > 2000ms |
| Complete Response | < 3000ms | < 2000ms | 3000-5000ms | > 5000ms |

### Optimization Techniques

#### 1. Parallel Processing
```javascript
// Process text and TTS in parallel
async function* streamWithTTS(textStream) {
  const ttsQueue = [];

  for await (const token of textStream) {
    // Stream text immediately
    yield { type: 'text', data: token };

    // Queue TTS processing (non-blocking)
    if (completeSentence(token)) {
      ttsQueue.push(generateTTS(token));
    }
  }

  // Wait for remaining TTS
  for (const ttsPromise of ttsQueue) {
    const audio = await ttsPromise;
    yield { type: 'audio', data: audio };
  }
}
```

#### 2. Connection Pooling
```javascript
// MongoDB connection pool
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000
});

// Redis connection pool
const redisClient = new Redis({
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false
});
```

#### 3. Memory Management
```javascript
// Track active streams
this.activeStreams = new Set();

// Cleanup on stream end
finally {
  this.activeStreams.delete(streamId);
  sentenceDetector.clear();
  textBuffer = null;
  if (global.gc) global.gc();
}
```

#### 4. Response Length Limiting
```javascript
const MAX_RESPONSE_LENGTH = 2000;

for await (const chunk of stream) {
  if (fullAnswer.length >= MAX_RESPONSE_LENGTH) {
    logger.warn('Response truncated at max length');
    break;
  }
  // ... process chunk
}
```

### Resource Usage

**Typical Per-Stream Resource Usage**:
- Memory: 10-20MB per active stream
- CPU: 5-10% per stream (varies with TTS)
- Network: 1-5 KB/s text, 20-50 KB/s with TTS

**Recommended Limits**:
- Max concurrent streams per instance: 100
- PM2 cluster mode: 2-4 instances per server
- Memory limit per instance: 1GB

---

## Security Considerations

### Authentication

All streaming endpoints require authentication:

```javascript
// JWT authentication
router.post('/stream', authenticateToken, streamingController);
```

### Rate Limiting

Streaming-specific rate limits:

```javascript
const streamingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 30,                   // 30 streams per minute
  message: "Streaming rate limit exceeded"
});

app.use("/api/chat/query/stream", streamingLimiter);
```

### Input Validation

Validate all request parameters:

```javascript
// Validate chatbotId
if (!mongoose.Types.ObjectId.isValid(chatbotId)) {
  return res.status(400).json({ error: 'Invalid chatbot ID' });
}

// Validate query length
if (query.length > 1000) {
  return res.status(400).json({ error: 'Query too long' });
}

// Sanitize input
const sanitizedQuery = sanitizeHtml(query);
```

### Resource Protection

Prevent abuse:

```javascript
// Limit response length
const MAX_RESPONSE_LENGTH = 2000;

// Limit active streams per user
const userStreams = activeStreamsByUser.get(userId) || 0;
if (userStreams >= 3) {
  return res.status(429).json({ error: 'Too many concurrent streams' });
}

// Timeout long-running streams
const streamTimeout = setTimeout(() => {
  logger.warn('Stream timeout, closing connection');
  res.end();
}, 60000); // 60 seconds
```

### Data Privacy

- Don't log sensitive user data
- Sanitize errors before sending to client
- Use secure Redis connections in production
- Encrypt data at rest and in transit

---

## Client Implementation Guide

### Basic JavaScript Implementation

```javascript
// Create SSE connection
const eventSource = new EventSource('/api/chat/query/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    chatbotId: '60f7b3b3e6b6f40015e6b6f4',
    query: 'Hello',
    sessionId: 'test-session',
    enableTTS: true
  })
});

let fullResponse = '';

// Handle text events
eventSource.addEventListener('text', (event) => {
  const data = JSON.parse(event.data);
  fullResponse += data.token;

  // Update UI
  document.getElementById('response').textContent = fullResponse;
});

// Handle audio events
eventSource.addEventListener('audio', (event) => {
  const data = JSON.parse(event.data);

  // Convert base64 to blob
  const audioBlob = base64ToBlob(data.audioContent, 'audio/mp3');
  const audioUrl = URL.createObjectURL(audioBlob);

  // Play audio
  const audio = new Audio(audioUrl);
  audio.play();
});

// Handle completion
eventSource.addEventListener('done', (event) => {
  const data = JSON.parse(event.data);
  console.log('Stream complete:', data.metrics);
  eventSource.close();
});

// Handle errors
eventSource.addEventListener('error', (event) => {
  const data = JSON.parse(event.data);
  console.error('Stream error:', data);
  eventSource.close();
  showError(data.message);
});

// Helper: Convert base64 to blob
function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let i = 0; i < byteCharacters.length; i++) {
    byteArrays.push(byteCharacters.charCodeAt(i));
  }

  return new Blob([new Uint8Array(byteArrays)], { type: mimeType });
}
```

### React Implementation

```jsx
import { useEffect, useState, useRef } from 'react';

function ChatStreaming({ chatbotId, query, onComplete }) {
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (!query) return;

    setIsStreaming(true);
    setResponse('');
    setError(null);

    // Note: EventSource doesn't support POST with body
    // Use fetch with ReadableStream instead
    const startStream = async () => {
      try {
        const response = await fetch('/api/chat/query/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            chatbotId,
            query,
            sessionId: 'session-123',
            enableTTS: true
          })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          const chunk = decoder.decode(value);
          const events = parseSSE(chunk);

          for (const event of events) {
            if (event.type === 'text') {
              setResponse(prev => prev + event.data.token);
            } else if (event.type === 'audio') {
              playAudio(event.data.audioContent);
            } else if (event.type === 'done') {
              setIsStreaming(false);
              onComplete?.(event.data);
            } else if (event.type === 'error') {
              setError(event.data.message);
              setIsStreaming(false);
            }
          }
        }
      } catch (err) {
        setError(err.message);
        setIsStreaming(false);
      }
    };

    startStream();

    return () => {
      // Cleanup on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [query, chatbotId]);

  return (
    <div>
      {isStreaming && <div className="loading">Streaming...</div>}
      {error && <div className="error">{error}</div>}
      <div className="response">{response}</div>
    </div>
  );
}

// Helper: Parse SSE events from chunk
function parseSSE(chunk) {
  const events = [];
  const lines = chunk.split('\n');
  let currentEvent = {};

  for (const line of lines) {
    if (line.startsWith('event:')) {
      currentEvent.type = line.substring(7).trim();
    } else if (line.startsWith('data:')) {
      currentEvent.data = JSON.parse(line.substring(6).trim());
    } else if (line === '' && currentEvent.type) {
      events.push(currentEvent);
      currentEvent = {};
    }
  }

  return events;
}
```

### Error Handling

```javascript
// Reconnection logic
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

function createEventSource() {
  const es = new EventSource(url);

  es.onerror = (error) => {
    console.error('EventSource error:', error);
    es.close();

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      console.log(`Reconnecting... attempt ${reconnectAttempts}`);
      setTimeout(createEventSource, 1000 * reconnectAttempts);
    } else {
      showError('Connection lost. Please refresh the page.');
    }
  };

  return es;
}
```

---

## Testing

### Manual Testing

```bash
# Test user chatbot streaming
node scripts/testUserChatbotStreaming.js <CHATBOT_ID> "Hello"

# Test with curl
curl -X POST http://localhost:5000/api/chat/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"chatbotId":"...","query":"Hello","sessionId":"test","enableTTS":false}'
```

### Load Testing

```bash
# Quick test (10 concurrent, 100 total)
node scripts/loadTestStreaming.js quick

# Sustained load (50 concurrent, 1000 total)
node scripts/loadTestStreaming.js sustained

# Spike test (200 concurrent, 500 total)
node scripts/loadTestStreaming.js spike
```

### Unit Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test streamingResponseService.unit.test.js

# Test with coverage
npm run test:coverage
```

---

## Troubleshooting

### Issue: No events received

**Cause**: Nginx buffering enabled

**Solution**: Ensure `proxy_buffering off;` in Nginx config

### Issue: Audio not playing

**Cause**: Base64 decoding issue or incorrect MIME type

**Solution**: Verify base64 decoding and use `audio/mp3` MIME type

### Issue: High latency

**Cause**: Cold start, cache miss, or network issues

**Solution**: Check cache hit rates, warm up cache, verify network

### Issue: Memory leaks

**Cause**: Streams not cleaned up properly

**Solution**: Ensure cleanup in `finally` blocks, check active stream tracking

### Issue: Connection timeout

**Cause**: Nginx timeout too short

**Solution**: Increase `proxy_read_timeout` to 300s

---

## References

- [Server-Sent Events Specification](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [OpenAI Streaming Documentation](https://platform.openai.com/docs/api-reference/streaming)
- [Google Cloud TTS API](https://cloud.google.com/text-to-speech/docs)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- [MONITORING.md](./MONITORING.md)
- [CLIENT_STREAMING_GUIDE.md](./CLIENT_STREAMING_GUIDE.md)
