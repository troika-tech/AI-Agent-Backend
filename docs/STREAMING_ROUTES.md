# 🚀 **STREAMING ROUTES DOCUMENTATION**

## **OVERVIEW**
This document describes the streaming (Server-Sent Events) versions of API routes that provide real-time progress updates and enhanced user experience.

---

## **🔄 AVAILABLE STREAMING ROUTES**

### **1. CHAT STREAMING**
- **Endpoint**: `POST /api/chat/query/stream`
- **Purpose**: Real-time chat responses with text and audio streaming
- **Features**: 
  - Streaming text tokens
  - Audio chunks (TTS)
  - Progress updates
  - Suggestions
  - Error handling

### **2. TROIKA INTELLIGENT CHAT STREAMING**
- **Endpoint**: `POST /api/troika/intelligent-chat/stream`
- **Purpose**: AI-powered sales agent with streaming responses
- **Features**:
  - Intent analysis
  - Market intelligence
  - Streaming text and audio
  - Context awareness

### **3. PRODUCT SEARCH STREAMING**
- **Endpoint**: `GET /api/products/search/stream`
- **Purpose**: Real-time product search with progress updates
- **Features**:
  - Text search progress
  - Vector search progress
  - Filter application
  - Real-time results

### **4. AZA PRODUCT SEARCH STREAMING**
- **Endpoint**: `POST /aza/search/stream`
- **Purpose**: Aza-specific product search with streaming
- **Features**:
  - Text search fallback
  - Semantic search
  - Cosine similarity scoring
  - Real-time results

### **5. CONTEXT FILE UPLOAD STREAMING**
- **Endpoint**: `POST /api/context/upload-file/stream`
- **Purpose**: File upload with processing progress
- **Features**:
  - Upload validation
  - Processing progress
  - Chunk creation
  - Token counting

---

## **📡 SSE EVENT TYPES**

### **Connection Events**
```javascript
// Initial connection
{
  event: "connected",
  data: {
    message: "Stream started",
    // ... additional context
  }
}

// Connection closed
{
  event: "close",
  data: {
    message: "Stream ended"
  }
}
```

### **Progress Events**
```javascript
// Progress update
{
  event: "progress",
  data: {
    step: "text_search",
    message: "Performing text search...",
    count: 5,
    // ... additional progress data
  }
}
```

### **Data Events**
```javascript
// Results data
{
  event: "results",
  data: {
    type: "product_cards",
    products: [...],
    total: 10,
    // ... result data
  }
}

// Text streaming
{
  event: "text",
  data: {
    token: "Hello",
    fullText: "Hello world",
    // ... text data
  }
}

// Audio streaming
{
  event: "audio",
  data: {
    chunk: "base64_encoded_audio",
    format: "mp3",
    // ... audio data
  }
}
```

### **Completion Events**
```javascript
// Stream complete
{
  event: "complete",
  data: {
    total: 10,
    duration: 1500,
    // ... completion data
  }
}
```

### **Error Events**
```javascript
// Error occurred
{
  event: "error",
  data: {
    message: "Search failed",
    error: "Database connection error",
    // ... error details
  }
}
```

---

## **🔧 USAGE EXAMPLES**

### **1. Product Search Streaming**
```javascript
// Frontend JavaScript
const eventSource = new EventSource('/api/products/search/stream?q=lehenga&limit=5');

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  
  switch(event.type) {
    case 'connected':
      console.log('Search started:', data.message);
      break;
      
    case 'progress':
      console.log(`Step: ${data.step} - ${data.message}`);
      updateProgressBar(data.step, data.count);
      break;
      
    case 'results':
      displayProducts(data.products);
      break;
      
    case 'complete':
      console.log(`Search complete: ${data.total} results`);
      eventSource.close();
      break;
      
    case 'error':
      console.error('Search error:', data.message);
      eventSource.close();
      break;
  }
};
```

### **2. Chat Streaming**
```javascript
// Frontend JavaScript
const eventSource = new EventSource('/api/chat/query/stream', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: "Tell me about your products",
    chatbotId: "chatbot123",
    sessionId: "session456",
    enableTTS: true
  })
});

eventSource.onmessage = function(event) {
  const data = JSON.parse(event.data);
  
  switch(event.type) {
    case 'text':
      appendToChat(data.token);
      break;
      
    case 'audio':
      playAudioChunk(data.chunk);
      break;
      
    case 'suggestions':
      showSuggestions(data.suggestions);
      break;
      
    case 'complete':
      console.log('Chat complete');
      eventSource.close();
      break;
  }
};
```

---

## **⚡ PERFORMANCE BENEFITS**

### **1. Real-time Feedback**
- Users see progress immediately
- No waiting for complete responses
- Better perceived performance

### **2. Reduced Time to First Byte (TTFB)**
- First data arrives faster
- Streaming starts immediately
- Better user experience

### **3. Memory Efficiency**
- Data processed in chunks
- Lower memory usage
- Better scalability

### **4. Error Recovery**
- Partial results on errors
- Graceful degradation
- Better error handling

---

## **🛡️ RATE LIMITING**

### **Streaming Endpoints**
- **Rate Limit**: 30 requests per minute per IP
- **Window**: 1 minute
- **Whitelist**: Configured IPs bypass limits

### **Rate Limit Headers**
```http
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 1640995200
```

---

## **🔍 MONITORING & LOGGING**

### **Log Levels**
- **INFO**: Stream start/complete
- **ERROR**: Stream failures
- **DEBUG**: Detailed progress

### **Metrics Tracked**
- Stream duration
- Data chunks sent
- Error rates
- Client connections

### **Example Logs**
```javascript
// Stream start
[product-search-123] Starting streaming product search {
  query: "lehenga",
  filters: { size: "M", color: "red" },
  limit: 8
}

// Progress update
[product-search-123] Text search found 5 results

// Stream complete
[product-search-123] Product search stream complete {
  query: "lehenga",
  totalResults: 5,
  filters: { size: "M", color: "red" }
}
```

---

## **🚨 ERROR HANDLING**

### **Common Errors**
1. **Connection Timeout**: Client disconnected
2. **Rate Limit Exceeded**: Too many requests
3. **Invalid Parameters**: Missing required fields
4. **Database Error**: Query failed
5. **Processing Error**: Data processing failed

### **Error Response Format**
```javascript
{
  event: "error",
  data: {
    message: "Search failed",
    error: "Database connection error",
    code: "DB_CONNECTION_ERROR",
    timestamp: "2024-01-01T12:00:00Z"
  }
}
```

---

## **📊 COMPARISON: NORMAL vs STREAMING**

| Feature | Normal Routes | Streaming Routes |
|---------|---------------|------------------|
| **Response Time** | Wait for complete | Immediate start |
| **User Feedback** | None until complete | Real-time progress |
| **Memory Usage** | High (full response) | Low (chunked) |
| **Error Handling** | All-or-nothing | Partial results |
| **Scalability** | Limited | Better |
| **Complexity** | Simple | Moderate |

---

## **🔧 CONFIGURATION**

### **Environment Variables**
```bash
# Streaming configuration
STREAMING_ENABLED=true
STREAMING_TIMEOUT=30000
STREAMING_CHUNK_SIZE=1024

# Rate limiting
STREAMING_RATE_LIMIT=30
STREAMING_WINDOW_MS=60000
```

### **Middleware Configuration**
```javascript
// Rate limiting for streaming
const streamingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    status: 429,
    error: "Streaming rate limit exceeded"
  }
});
```

---

## **🎯 BEST PRACTICES**

### **1. Client Implementation**
- Always handle connection errors
- Implement reconnection logic
- Show progress indicators
- Handle partial results gracefully

### **2. Server Implementation**
- Use proper error handling
- Implement timeouts
- Log stream metrics
- Monitor resource usage

### **3. Performance**
- Use appropriate chunk sizes
- Implement backpressure
- Monitor memory usage
- Optimize database queries

---

## **🔮 FUTURE ENHANCEMENTS**

### **Planned Features**
1. **WebSocket Support**: Bidirectional communication
2. **Compression**: Gzip compression for SSE
3. **Caching**: Stream result caching
4. **Analytics**: Advanced stream analytics
5. **Load Balancing**: Stream-aware load balancing

### **Experimental Features**
1. **GraphQL Streaming**: GraphQL subscription support
2. **Real-time Collaboration**: Multi-user streaming
3. **AI Streaming**: Advanced AI response streaming
4. **Video Streaming**: Video content streaming

---

## **📞 SUPPORT**

For questions or issues with streaming routes:
- **Documentation**: Check this file
- **Logs**: Review server logs
- **Metrics**: Check monitoring dashboard
- **Issues**: Report via GitHub issues

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Author**: AI Assistant
