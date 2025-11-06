# Frontend Streaming Implementation - Product Requirements Document (PRD)

**Version**: 1.0
**Date**: 2025-10-11
**Status**: Ready for Development
**Owner**: Frontend Team

---

## Executive Summary

This PRD outlines the requirements for implementing streaming responses in the chatbot frontend. The streaming feature will transform the user experience from waiting 8-11 seconds for complete responses to seeing instant, real-time responses with a first token latency of ~500ms.

### Goals
1. Implement Server-Sent Events (SSE) client to consume streaming responses
2. Display text responses progressively as they arrive
3. Play TTS audio in real-time as sentences complete
4. Maintain backward compatibility with non-streaming responses
5. Provide excellent UX with loading states, animations, and error handling

### Success Metrics
- Time to first visible text: < 500ms (from request start)
- Smooth text animation with no lag
- Audio playback starts within 1.5s of request
- Zero regressions in existing functionality
- User satisfaction increase (measured via feedback)

---

## Table of Contents
1. [Background](#background)
2. [User Stories](#user-stories)
3. [Technical Requirements](#technical-requirements)
4. [UI/UX Requirements](#uiux-requirements)
5. [API Specification](#api-specification)
6. [Implementation Plan](#implementation-plan)
7. [Testing Requirements](#testing-requirements)
8. [Performance Requirements](#performance-requirements)
9. [Security Requirements](#security-requirements)
10. [Rollout Plan](#rollout-plan)
11. [Dependencies](#dependencies)
12. [Open Questions](#open-questions)

---

## 1. Background

### Current State
- Users send a message and wait 8-11 seconds for a complete response
- No feedback during processing (only loading spinner)
- TTS audio is generated after complete text response
- Poor perceived performance despite accurate responses

### Proposed State
- Users see text appearing in real-time as it's generated
- First words appear within ~500ms
- TTS audio plays progressively as sentences complete
- Engaging, modern chat experience similar to ChatGPT

### Why Streaming?
1. **Better UX**: Users see immediate feedback
2. **Reduced Perceived Latency**: Progressive rendering keeps users engaged
3. **Faster TTS**: Audio plays as soon as first sentence is ready
4. **Modern Standard**: Expected behavior in modern AI chat interfaces
5. **Competitive Advantage**: Matches or exceeds competitor performance

---

## 2. User Stories

### US-1: Real-Time Text Display
**As a** chatbot user
**I want to** see the AI's response appearing word-by-word in real-time
**So that** I get instant feedback and don't have to wait for the complete response

**Acceptance Criteria**:
- Text appears progressively as it's generated
- Animation is smooth and natural (not choppy)
- User can read as text streams in
- First words appear within 500ms of sending message
- Complete response appears within 2-3 seconds

### US-2: Progressive Audio Playback
**As a** chatbot user with TTS enabled
**I want to** hear audio playing while text is still streaming
**So that** I can start listening immediately without waiting

**Acceptance Criteria**:
- First audio chunk plays within 1.5s of sending message
- Audio plays smoothly without gaps
- Audio matches the text being displayed
- User can pause/resume audio playback
- Audio continues even if text streaming completes first

### US-3: Loading States
**As a** chatbot user
**I want to** see clear indicators of what's happening during streaming
**So that** I know the system is working and what to expect

**Acceptance Criteria**:
- Loading indicator shows immediately on message send
- "Thinking..." or typing indicator before first token
- Smooth transition from loading to streaming text
- Audio loading indicator if TTS is enabled
- Clear completion state when done

### US-4: Error Handling
**As a** chatbot user
**I want to** see clear error messages if streaming fails
**So that** I know what went wrong and can retry

**Acceptance Criteria**:
- Specific error messages for different failure types
- Retry button for recoverable errors
- Partial response preserved if stream fails mid-way
- Graceful fallback to non-streaming if SSE unavailable
- Error logged for debugging

### US-5: Mobile Compatibility
**As a** mobile chatbot user
**I want** streaming to work smoothly on my phone
**So that** I get the same great experience on any device

**Acceptance Criteria**:
- Streaming works on iOS Safari, Chrome, Firefox
- Streaming works on Android Chrome, Firefox
- Touch interactions work properly
- Network interruptions handled gracefully
- Battery usage is reasonable

### US-6: Accessibility
**As a** user with accessibility needs
**I want** streaming responses to be accessible
**So that** I can use the chatbot effectively

**Acceptance Criteria**:
- Screen readers announce new text as it arrives
- Keyboard navigation works during streaming
- Visual indicators for audio playback state
- Ability to pause/slow down streaming if needed
- WCAG 2.1 Level AA compliance

---

## 3. Technical Requirements

### 3.1 Core Streaming Implementation

#### TR-1: SSE Client
**Priority**: P0 (Must Have)

**Requirements**:
- Implement SSE client using native `EventSource` API or `fetch` with `ReadableStream`
- Handle SSE event parsing (event type, data payload)
- Support POST requests with JSON body (Note: `EventSource` doesn't support POST, use `fetch`)
- Maintain connection state (connecting, open, closed, error)
- Automatic reconnection on connection loss (max 3 attempts)

**Implementation Options**:

**Option A: Fetch API with ReadableStream** (Recommended)
```javascript
const response = await fetch('/api/chat/query/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ chatbotId, query, sessionId, enableTTS })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const events = parseSSE(chunk);
  // Handle events...
}
```

**Option B: EventSource Polyfill**
Use a library like `eventsource-polyfill` or `@microsoft/fetch-event-source` that supports POST

**Decision**: Use Fetch API with ReadableStream for maximum flexibility

#### TR-2: Event Handling
**Priority**: P0 (Must Have)

**Requirements**:
- Parse SSE events: `text`, `audio`, `done`, `error`
- Handle malformed events gracefully
- Buffer incomplete events until complete
- Maintain event order
- Track event metrics (count, timestamps)

**Event Handlers**:
```typescript
interface EventHandlers {
  onText: (token: string) => void;
  onAudio: (audioContent: string, index: number) => void;
  onDone: (data: DoneData) => void;
  onError: (error: ErrorData) => void;
  onConnectionError: (error: Error) => void;
}

interface DoneData {
  success: boolean;
  fullAnswer: string;
  metrics: {
    duration: number;
    wordCount: number;
    firstTokenLatency?: number;
    firstAudioLatency?: number;
    audioChunks?: number;
  };
  conversationId?: string;
}

interface ErrorData {
  message: string;
  code: string;
  details?: any;
}
```

#### TR-3: Text Accumulation & Display
**Priority**: P0 (Must Have)

**Requirements**:
- Accumulate text tokens as they arrive
- Update UI after each token (with debouncing if needed)
- Maintain cursor position if user scrolls
- Auto-scroll to bottom as new text arrives (unless user scrolled up)
- Preserve whitespace and formatting

**Implementation**:
```javascript
let fullResponse = '';
let lastUpdateTime = 0;
const UPDATE_THROTTLE = 16; // ~60fps

function handleTextToken(token) {
  fullResponse += token;

  // Throttle UI updates for performance
  const now = Date.now();
  if (now - lastUpdateTime > UPDATE_THROTTLE) {
    updateUI(fullResponse);
    lastUpdateTime = now;
  }
}
```

#### TR-4: Audio Playback
**Priority**: P0 (Must Have)

**Requirements**:
- Decode base64 audio chunks to Blob
- Queue audio chunks for sequential playback
- Play audio automatically as chunks arrive
- Handle audio playback errors gracefully
- Provide play/pause controls
- Show audio loading/playing/paused states

**Implementation**:
```javascript
class AudioPlayer {
  constructor() {
    this.audioQueue = [];
    this.isPlaying = false;
    this.currentAudio = null;
  }

  addChunk(base64Audio) {
    const audioBlob = this.base64ToBlob(base64Audio, 'audio/mp3');
    const audioUrl = URL.createObjectURL(audioBlob);
    this.audioQueue.push(audioUrl);

    if (!this.isPlaying) {
      this.playNext();
    }
  }

  playNext() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const audioUrl = this.audioQueue.shift();

    this.currentAudio = new Audio(audioUrl);
    this.currentAudio.addEventListener('ended', () => {
      URL.revokeObjectURL(audioUrl); // Clean up
      this.playNext();
    });
    this.currentAudio.addEventListener('error', (err) => {
      console.error('Audio playback error:', err);
      this.playNext(); // Skip to next
    });

    this.currentAudio.play();
  }

  pause() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.isPlaying = false;
    }
  }

  resume() {
    if (this.currentAudio) {
      this.currentAudio.play();
      this.isPlaying = true;
    }
  }

  base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteArrays = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArrays[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([byteArrays], { type: mimeType });
  }
}
```

### 3.2 React/Vue Integration

#### TR-5: React Hook (if using React)
**Priority**: P0 (Must Have)

**Requirements**:
- Create reusable `useStreamingChat` hook
- Manage streaming state (idle, connecting, streaming, complete, error)
- Expose control methods (start, stop, retry)
- Handle cleanup on unmount
- TypeScript support

**Example Hook**:
```typescript
interface UseStreamingChatOptions {
  chatbotId: string;
  sessionId: string;
  enableTTS?: boolean;
  onComplete?: (data: DoneData) => void;
  onError?: (error: ErrorData) => void;
}

interface UseStreamingChatResult {
  response: string;
  isStreaming: boolean;
  error: string | null;
  audioPlaying: boolean;
  sendMessage: (query: string) => void;
  stopStreaming: () => void;
  retry: () => void;
}

function useStreamingChat(options: UseStreamingChatOptions): UseStreamingChatResult {
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioPlayerRef = useRef(new AudioPlayer());
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = async (query: string) => {
    setIsStreaming(true);
    setResponse('');
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat/query/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          chatbotId: options.chatbotId,
          query,
          sessionId: options.sessionId,
          enableTTS: options.enableTTS
        }),
        signal: abortControllerRef.current.signal
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
            audioPlayerRef.current.addChunk(event.data.audioContent);
            setAudioPlaying(true);
          } else if (event.type === 'done') {
            setIsStreaming(false);
            options.onComplete?.(event.data);
          } else if (event.type === 'error') {
            setError(event.data.message);
            setIsStreaming(false);
            options.onError?.(event.data);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setIsStreaming(false);
      }
    }
  };

  const stopStreaming = () => {
    abortControllerRef.current?.abort();
    audioPlayerRef.current.pause();
    setIsStreaming(false);
    setAudioPlaying(false);
  };

  const retry = () => {
    // Retry last query
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      abortControllerRef.current?.abort();
      audioPlayerRef.current.pause();
    };
  }, []);

  return {
    response,
    isStreaming,
    error,
    audioPlaying,
    sendMessage,
    stopStreaming,
    retry
  };
}
```

#### TR-6: Component Structure
**Priority**: P0 (Must Have)

**Requirements**:
- `ChatMessage` component for individual messages
- `StreamingMessage` component for active streaming message
- `ChatInput` component with send button
- `AudioControls` component for play/pause
- `ErrorDisplay` component for error messages

**Component Hierarchy**:
```
<ChatContainer>
  <ChatMessages>
    <ChatMessage type="user" />
    <ChatMessage type="bot" />
    <StreamingMessage isStreaming={true} />
  </ChatMessages>
  <AudioControls playing={audioPlaying} onPause={...} onResume={...} />
  <ErrorDisplay error={error} onRetry={...} />
  <ChatInput onSend={sendMessage} disabled={isStreaming} />
</ChatContainer>
```

### 3.3 State Management

#### TR-7: Conversation State
**Priority**: P0 (Must Have)

**Requirements**:
- Track conversation history locally
- Sync with backend conversation IDs
- Handle message states (sending, streaming, complete, failed)
- Persist conversation across page reloads (optional)

**State Shape**:
```typescript
interface ConversationState {
  sessionId: string;
  messages: Message[];
  isStreaming: boolean;
  currentStreamingMessage: StreamingMessage | null;
}

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  status: 'sending' | 'complete' | 'failed';
  conversationId?: string;
  metrics?: {
    duration: number;
    wordCount: number;
  };
}

interface StreamingMessage extends Message {
  status: 'streaming';
  currentContent: string;
  hasAudio: boolean;
  audioPlaying: boolean;
}
```

---

## 4. UI/UX Requirements

### 4.1 Visual Design

#### UX-1: Typing Animation
**Priority**: P0 (Must Have)

**Requirements**:
- Text appears smoothly character-by-character
- Cursor/caret indicator at the end of streaming text
- Smooth animation (no flickering or jumping)
- Consistent with chat app design language

**Implementation**:
```css
.streaming-text {
  animation: fadeIn 0.1s ease-in;
}

.streaming-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background-color: currentColor;
  animation: blink 1s infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
```

#### UX-2: Loading States
**Priority**: P0 (Must Have)

**Requirements**:
- **Pre-Stream**: Typing indicator (3 dots animation) while waiting for first token
- **Streaming**: Blinking cursor at end of text
- **Audio Loading**: Audio icon with loading spinner
- **Complete**: Remove all loading indicators

**States Timeline**:
```
User sends message → [Typing indicator] → First token arrives → [Cursor + Text] →
Audio chunk arrives → [Audio icon + playing animation] → Complete → [Static message]
```

#### UX-3: Message Bubbles
**Priority**: P0 (Must Have)

**Requirements**:
- User messages: Right-aligned, primary color background
- Bot messages: Left-aligned, secondary color background
- Streaming message: Same as bot message with cursor
- Avatar/icon for bot messages
- Timestamp on hover or after complete

#### UX-4: Auto-Scroll
**Priority**: P0 (Must Have)

**Requirements**:
- Auto-scroll to bottom as new text arrives
- Detect user scroll-up and pause auto-scroll
- Show "New message" indicator when user scrolled up
- Resume auto-scroll when user scrolls near bottom

**Implementation**:
```javascript
function shouldAutoScroll(container) {
  const threshold = 100; // pixels from bottom
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distanceFromBottom < threshold;
}

function handleNewContent(container) {
  if (shouldAutoScroll(container)) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  } else {
    showNewMessageIndicator();
  }
}
```

### 4.2 Audio UI

#### UX-5: Audio Controls
**Priority**: P0 (Must Have)

**Requirements**:
- Play/Pause button
- Audio playback progress indicator
- Volume control (optional for P0, recommended for P1)
- Visual indicator of audio playing state
- Mute/Unmute option

**Design**:
```
[🔊 Playing] [⏸️ Pause] [━━━━━━━●──] 75%
```

#### UX-6: Audio Visual Feedback
**Priority**: P1 (Should Have)

**Requirements**:
- Pulsing audio icon when playing
- Waveform animation (optional)
- Highlight text as corresponding audio plays (advanced)

### 4.3 Error States

#### UX-7: Error Messages
**Priority**: P0 (Must Have)

**Requirements**:
- Clear, user-friendly error messages
- Different messages for different error types:
  - Network error: "Connection lost. Please check your internet."
  - Rate limit: "Too many requests. Please wait a moment."
  - Server error: "Something went wrong. Please try again."
  - Timeout: "Request timed out. Please try again."
- Retry button for recoverable errors
- Contact support link for persistent errors

#### UX-8: Partial Response Handling
**Priority**: P0 (Must Have)

**Requirements**:
- If stream fails mid-response, preserve partial text
- Show error message below partial response
- Allow user to retry or continue conversation
- Mark partial message clearly (e.g., "Response incomplete")

---

## 5. API Specification

### 5.1 Streaming Endpoint

**Endpoint**: `POST /api/chat/query/stream`

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

**Request Body**:
```json
{
  "chatbotId": "60f7b3b3e6b6f40015e6b6f4",
  "query": "What are your business hours?",
  "sessionId": "session-abc123",
  "enableTTS": true,
  "userLanguageCode": "en-US"
}
```

**Response Type**: `text/event-stream`

**Response Events**:

1. **Text Event**:
```
event: text
data: {"token":"Hello"}

```

2. **Audio Event**:
```
event: audio
data: {"audioContent":"SGVsbG8gd29ybGQ=","index":0}

```

3. **Done Event**:
```
event: done
data: {"success":true,"fullAnswer":"Hello, how can I help?","metrics":{"duration":2500,"wordCount":5},"conversationId":"..."}

```

4. **Error Event**:
```
event: error
data: {"message":"OpenAI API error","code":"OPENAI_ERROR"}

```

### 5.2 Error Codes

| Code | Description | User Action |
|------|-------------|-------------|
| `OPENAI_ERROR` | OpenAI API failure | Retry |
| `TTS_ERROR` | Text-to-speech failure | Continue without audio |
| `KB_ERROR` | Knowledge base error | Retry |
| `VALIDATION_ERROR` | Invalid request | Fix input |
| `RATE_LIMIT_ERROR` | Too many requests | Wait and retry |
| `NETWORK_ERROR` | Network issue | Check connection |
| `UNKNOWN_ERROR` | Unexpected error | Contact support |

### 5.3 Fallback Endpoint (Non-Streaming)

For browsers that don't support SSE or as a fallback:

**Endpoint**: `POST /api/chat/query`

**Request**: Same as streaming endpoint

**Response**: Traditional JSON response with complete answer

```json
{
  "success": true,
  "answer": "Hello, how can I help you today?",
  "conversationId": "...",
  "audioUrl": "https://..."  // If TTS enabled
}
```

---

## 6. Implementation Plan

### Phase 1: Core Streaming (Week 1-2)
**Goal**: Basic streaming text display working

**Tasks**:
1. Implement SSE client with Fetch API
2. Parse SSE events (text, done, error)
3. Display streaming text in UI
4. Handle connection errors
5. Basic loading states
6. Manual testing with backend

**Deliverable**: Streaming text messages display in real-time

### Phase 2: Audio Support (Week 2-3)
**Goal**: TTS audio playback working

**Tasks**:
1. Implement AudioPlayer class
2. Handle audio events from SSE
3. Base64 to Blob conversion
4. Sequential audio playback
5. Play/pause controls
6. Audio loading/playing indicators

**Deliverable**: Audio plays progressively during streaming

### Phase 3: Polish & UX (Week 3-4)
**Goal**: Production-ready UX

**Tasks**:
1. Smooth animations and transitions
2. Auto-scroll logic
3. Enhanced error messages
4. Retry functionality
5. Accessibility improvements
6. Mobile optimization

**Deliverable**: Polished, production-ready UI

### Phase 4: Testing & Optimization (Week 4-5)
**Goal**: Stable, tested, optimized

**Tasks**:
1. Unit tests for streaming logic
2. Integration tests with mock SSE
3. Cross-browser testing
4. Performance optimization
5. Memory leak testing
6. Load testing

**Deliverable**: Test coverage > 80%, no known bugs

### Phase 5: Rollout (Week 5-6)
**Goal**: Gradual production rollout

**Tasks**:
1. Deploy to staging
2. Internal testing
3. Beta testing with select users
4. Monitor metrics
5. Gradual rollout (1% → 10% → 50% → 100%)
6. Documentation

**Deliverable**: Streaming live for all users

---

## 7. Testing Requirements

### 7.1 Unit Tests

**UT-1: SSE Parser**
- Test parsing valid SSE events
- Test handling malformed events
- Test incomplete event buffering
- Test event type detection

**UT-2: Audio Player**
- Test base64 to blob conversion
- Test audio queue management
- Test play/pause/resume
- Test cleanup on complete

**UT-3: Text Accumulation**
- Test token concatenation
- Test whitespace preservation
- Test special characters
- Test emoji handling

### 7.2 Integration Tests

**IT-1: End-to-End Streaming**
- Test complete message flow
- Test with mock SSE server
- Test error scenarios
- Test reconnection logic

**IT-2: Audio Playback**
- Test audio playback with mock audio chunks
- Test audio error handling
- Test pause/resume during streaming

### 7.3 Browser Compatibility Tests

**BC-1: Browser Support**
Test on:
- Chrome (latest, previous)
- Firefox (latest, previous)
- Safari (latest, previous)
- Edge (latest)
- Mobile Safari (iOS 15+)
- Mobile Chrome (Android 10+)

**BC-2: Network Conditions**
- Test on fast connection (fiber)
- Test on slow connection (3G)
- Test on intermittent connection
- Test connection loss during streaming

### 7.4 Accessibility Tests

**AT-1: Screen Readers**
- Test with NVDA (Windows)
- Test with JAWS (Windows)
- Test with VoiceOver (Mac/iOS)
- Test with TalkBack (Android)

**AT-2: Keyboard Navigation**
- Test tab navigation
- Test enter to send message
- Test escape to cancel streaming

**AT-3: Visual**
- Test with high contrast mode
- Test with zoom (200%)
- Test with reduced motion

### 7.5 Performance Tests

**PT-1: Memory**
- Test memory usage during streaming
- Test memory cleanup after complete
- Test memory with long conversations
- Target: < 50MB per conversation

**PT-2: Rendering**
- Test frame rate during streaming
- Test with long responses (2000+ chars)
- Target: 60fps, no jank

**PT-3: Network**
- Test data usage with TTS
- Test with slow network
- Target: < 1MB per message with TTS

---

## 8. Performance Requirements

### 8.1 Latency Targets

| Metric | Target | Acceptable | Poor |
|--------|--------|------------|------|
| Time to First Token Visible | < 500ms | 500-1000ms | > 1000ms |
| Audio Playback Start | < 1500ms | 1500-2500ms | > 2500ms |
| UI Update Rate | 60fps | 30fps | < 30fps |
| Message Send to Response Start | < 600ms | 600-1200ms | > 1200ms |

### 8.2 Resource Usage

**Memory**:
- Idle: < 20MB
- Active conversation: < 50MB
- Long conversation (50+ messages): < 100MB

**CPU**:
- Idle: < 1%
- Streaming: < 10%
- Audio playback: < 5%

**Network**:
- Text only: ~1-5 KB/message
- With TTS: ~20-100 KB/message
- Overhead: < 10% of payload

### 8.3 Battery Usage (Mobile)

- Streaming should not significantly impact battery
- Target: < 2% battery per 10 minutes of active use
- Audio playback: < 5% battery per 10 minutes

---

## 9. Security Requirements

### 9.1 Authentication

**SEC-1: Token Management**
- Use JWT tokens for authentication
- Refresh tokens before expiry
- Clear tokens on logout
- Don't store tokens in localStorage (use httpOnly cookies if possible)

### 9.2 Input Validation

**SEC-2: Client-Side Validation**
- Validate message length (max 1000 chars)
- Sanitize input before sending
- Validate chatbotId format
- Validate sessionId format

### 9.3 Content Security

**SEC-3: XSS Prevention**
- Sanitize all text content before rendering
- Use React's built-in XSS protection (or equivalent)
- Don't use `dangerouslySetInnerHTML` unless necessary
- Validate audio data before playback

### 9.4 Rate Limiting

**SEC-4: Client-Side Rate Limiting**
- Prevent spam clicking send button
- Debounce send action (500ms)
- Show error if too many requests
- Disable input during streaming

---

## 10. Rollout Plan

### 10.1 Phased Rollout

**Stage 1: Internal Testing (Week 5)**
- Deploy to staging environment
- Internal team testing
- Fix critical bugs
- Performance validation

**Stage 2: Beta Testing (Week 5-6)**
- Enable for 1% of users (via feature flag)
- Monitor metrics closely
- Gather user feedback
- Fix any issues

**Stage 3: Gradual Rollout (Week 6)**
- 5% of users (Day 1)
- 10% of users (Day 2)
- 25% of users (Day 3)
- 50% of users (Day 4)
- 75% of users (Day 5)
- 100% of users (Day 6)

**Decision Criteria** (for proceeding to next stage):
- Error rate < 1%
- Success rate > 95%
- User feedback positive
- No critical bugs
- Performance within targets

**Rollback Criteria** (immediate rollback if):
- Error rate > 5%
- Success rate < 90%
- Critical bug discovered
- Severe performance degradation
- Security issue identified

### 10.2 Monitoring

**Metrics to Track**:
- Streaming success rate
- Time to first token (p50, p95, p99)
- Time to first audio (p50, p95, p99)
- Error rate by type
- User engagement (time in chat)
- Browser/device breakdown
- Network error rate

**Dashboards**:
- Real-time metrics dashboard
- Error tracking (Sentry/similar)
- User feedback collection
- A/B test results (streaming vs non-streaming)

### 10.3 Rollback Plan

**If issues occur**:

1. **Immediate**: Disable via feature flag (all users back to non-streaming)
2. **Quick**: Deploy hotfix if issue is minor
3. **Full**: Revert to previous version if critical

**Rollback Command**:
```bash
# Disable streaming for all users
curl -X POST https://api.example.com/admin/feature-flags \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"feature":"streaming","enabled":false}'
```

---

## 11. Dependencies

### 11.1 Backend Dependencies

**Required**:
- Streaming endpoints deployed and stable
- Feature flag system operational
- Metrics endpoints available
- Health check endpoint working

**Version Requirements**:
- Backend API version: v1.2.0+
- Streaming API: v1.0.0+

### 11.2 Frontend Dependencies

**Libraries** (recommendations):

1. **SSE/Fetch**: Native browser APIs (no library needed)
   - Alternatively: `@microsoft/fetch-event-source` for better POST support

2. **Audio**: Native Web Audio API
   - Alternatively: `howler.js` for advanced features

3. **State Management**:
   - React: Context API or Zustand
   - Vue: Vuex or Pinia

4. **TypeScript**: >= 4.5 (recommended, not required)

**No Heavy Dependencies**: Avoid adding large libraries just for streaming

### 11.3 Infrastructure

**CDN**: Ensure CDN supports SSE (doesn't buffer responses)

**HTTPS**: Required for modern SSE features

**CORS**: Configure CORS for streaming endpoints

---

## 12. Open Questions

### Q1: Should we support non-SSE fallback?
**Context**: Some corporate networks block SSE
**Options**:
- A: Graceful fallback to polling (complex)
- B: Fallback to non-streaming endpoint (simple)
- C: No fallback (show error)

**Recommendation**: Option B (fallback to non-streaming)

### Q2: How to handle very long responses (5000+ words)?
**Context**: Long responses could cause performance issues
**Options**:
- A: Truncate at 2000 chars (backend does this)
- B: Paginate response
- C: No limit (risk performance issues)

**Recommendation**: Option A (backend truncates, already implemented)

### Q3: Should audio playback be automatic or manual?
**Context**: Auto-play might be unexpected
**Options**:
- A: Auto-play (current design)
- B: Manual play button
- C: User preference setting

**Recommendation**: Option C (user preference, default auto-play)

### Q4: How to handle multiple concurrent chat sessions?
**Context**: User might have multiple tabs/windows open
**Options**:
- A: Allow multiple sessions (independent)
- B: Sync across tabs (complex)
- C: Warn user about multiple tabs

**Recommendation**: Option A (independent sessions)

### Q5: Should we persist streaming state across page reloads?
**Context**: User might accidentally reload during streaming
**Options**:
- A: Yes, persist to localStorage
- B: No, show warning before reload
- C: No, lose streaming state

**Recommendation**: Option B (show warning) for P0, Option A for P1

---

## Appendix A: Code Examples

### Full React Component Example

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { useStreamingChat } from './hooks/useStreamingChat';
import { AudioPlayer } from './utils/AudioPlayer';

interface ChatStreamingProps {
  chatbotId: string;
  sessionId: string;
  enableTTS?: boolean;
}

export function ChatStreaming({ chatbotId, sessionId, enableTTS = true }: ChatStreamingProps) {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    response,
    isStreaming,
    error,
    audioPlaying,
    sendMessage,
    stopStreaming,
    retry
  } = useStreamingChat({
    chatbotId,
    sessionId,
    enableTTS,
    onComplete: (data) => {
      // Add completed message to history
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'bot',
          content: data.fullAnswer,
          timestamp: new Date(),
          status: 'complete',
          metrics: data.metrics
        }
      ]);
    }
  });

  const handleSend = () => {
    if (!inputValue.trim() || isStreaming) return;

    // Add user message
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        type: 'user',
        content: inputValue,
        timestamp: new Date(),
        status: 'complete'
      }
    ]);

    // Send to backend
    sendMessage(inputValue);
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, response]);

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isStreaming && (
          <div className="streaming-message">
            <div className="message-content">
              {response}
              <span className="streaming-cursor">|</span>
            </div>
            {enableTTS && audioPlaying && (
              <div className="audio-indicator">
                🔊 Playing audio...
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={retry}>Retry</button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={isStreaming}
          rows={3}
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !inputValue.trim()}
        >
          {isStreaming ? 'Sending...' : 'Send'}
        </button>
        {isStreaming && (
          <button onClick={stopStreaming} className="stop-button">
            Stop
          </button>
        )}
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  return (
    <div className={`message message-${message.type}`}>
      <div className="message-content">{message.content}</div>
      <div className="message-timestamp">
        {message.timestamp.toLocaleTimeString()}
      </div>
    </div>
  );
}
```

---

## Appendix B: API Testing

### Manual Testing with Curl

```bash
# Test streaming endpoint
curl -N -X POST http://localhost:5000/api/chat/query/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "chatbotId": "60f7b3b3e6b6f40015e6b6f4",
    "query": "Hello, how are you?",
    "sessionId": "test-session-123",
    "enableTTS": false
  }'

# Note: -N flag disables buffering to see streaming output
```

### Testing with JavaScript (Browser Console)

```javascript
async function testStreaming() {
  const response = await fetch('http://localhost:5000/api/chat/query/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${YOUR_TOKEN}`
    },
    body: JSON.stringify({
      chatbotId: '60f7b3b3e6b6f40015e6b6f4',
      query: 'Hello',
      sessionId: 'test-' + Date.now(),
      enableTTS: false
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    console.log('Received chunk:', chunk);

    // Parse SSE events
    const events = parseSSE(chunk);
    events.forEach(event => {
      console.log('Event:', event.type, event.data);
    });
  }
}

function parseSSE(text) {
  const events = [];
  const lines = text.split('\n');
  let currentEvent = {};

  for (const line of lines) {
    if (line.startsWith('event:')) {
      currentEvent.type = line.substring(7).trim();
    } else if (line.startsWith('data:')) {
      try {
        currentEvent.data = JSON.parse(line.substring(6).trim());
      } catch (e) {
        currentEvent.data = line.substring(6).trim();
      }
    } else if (line === '' && currentEvent.type) {
      events.push(currentEvent);
      currentEvent = {};
    }
  }

  return events;
}

// Run test
testStreaming();
```

---

## Appendix C: Performance Checklist

- [ ] Text rendering at 60fps during streaming
- [ ] No memory leaks after 50+ messages
- [ ] Audio plays without gaps
- [ ] First token visible in < 500ms
- [ ] Auto-scroll smooth and responsive
- [ ] Works on 3G connection
- [ ] Mobile performance acceptable
- [ ] No layout shift during streaming
- [ ] Handles 2000+ character responses
- [ ] CPU usage < 10% during streaming

---

## Appendix D: Accessibility Checklist

- [ ] Screen readers announce new messages
- [ ] Keyboard navigation works (tab, enter, escape)
- [ ] Focus management correct
- [ ] ARIA labels on all interactive elements
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Works with reduced motion preference
- [ ] Works with high contrast mode
- [ ] Works at 200% zoom
- [ ] Audio has text alternative
- [ ] Error messages are announced

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-11 | Backend Team | Initial PRD |

---

## Approval

**Product Manager**: ________________ Date: ________

**Engineering Lead**: ________________ Date: ________

**Design Lead**: ________________ Date: ________
