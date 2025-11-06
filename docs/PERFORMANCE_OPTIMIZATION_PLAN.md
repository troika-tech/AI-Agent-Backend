# Chatbot Performance Optimization Plan

## Overview
This document outlines a comprehensive plan to reduce chatbot response time from 11-15 seconds to 4-6 seconds through strategic optimizations.

## Current Performance Issues
- **Response Time**: 11-15 seconds
- **Main Bottlenecks**: Sequential API calls, database query inefficiencies, synchronous TTS processing
- **User Impact**: Poor user experience, high bounce rates

## Optimization Goals
- **Target Response Time**: 4-6 seconds (60-70% improvement)
- **Perceived Performance**: Immediate feedback through streaming
- **Scalability**: Handle increased concurrent users

---

## Phase 1: Parallelization (High Impact, Low Effort)
**Expected Improvement**: 3-5 seconds reduction

### 1.1 Current Sequential Flow
```javascript
// Current inefficient flow
const subscription = await Subscription.findOne({...});           // 100ms
const clientConfig = await getClientConfig(chatbotId);           // 200ms
const productSearchResult = await searchProducts(searchArgs);    // 1-2s
const chunks = await retrieveRelevantChunks(query, chatbotId);   // 1-2s
const { answer, tokens } = await generateAnswer(...);            // 3-5s
const audio = await generateTTS(answer);                         // 2-3s
```

### 1.2 Optimized Parallel Flow
```javascript
// Phase 1: Parallel independent operations
const [subscription, clientConfig, productSearchResult] = await Promise.all([
  Subscription.findOne({ chatbot_id: chatbotId, status: "active" }).populate("plan_id"),
  getClientConfig(chatbotId),
  productFeatureEnabled ? searchProducts(searchArgs) : null
]);

// Phase 2: Parallel context retrieval and message history
const [chunks, recentMessages] = await Promise.all([
  retrieveRelevantChunks(query, chatbotId),
  Message.find({ chatbot_id: chatbotId, session_id: sessionId })
    .sort({ timestamp: -1 })
    .limit(10)
    .lean()
]);

// Phase 3: Generate answer (this must be sequential)
const { answer, tokens } = await generateAnswer(query, chunks, clientConfig, historyContext, chatbotId, productContext, productFeatureEnabled);
```

### 1.3 Implementation Steps
1. **Modify `answerQuery` function** in `controllers/chatController.js`
2. **Group independent operations** into Promise.all() calls
3. **Maintain data dependencies** (some operations must be sequential)
4. **Add error handling** for parallel operations

---

## Phase 2: Database Index Optimization
**Expected Improvement**: 200-500ms reduction per query

### 2.1 Current Index Analysis
```javascript
// Current indexes in Message model
messageSchema.index({ chatbot_id: 1 });      // Single field
messageSchema.index({ session_id: 1 });      // Single field  
messageSchema.index({ sender: 1 });          // Single field
messageSchema.index({ timestamp: 1 });       // Single field
messageSchema.index({ is_guest: 1 });        // Single field
```

### 2.2 Required Compound Indexes
```javascript
// Add to models/Message.js
messageSchema.index({ chatbot_id: 1, session_id: 1, timestamp: -1 });  // For message history
messageSchema.index({ chatbot_id: 1, sender: 1, timestamp: -1 });      // For user/bot messages
messageSchema.index({ chatbot_id: 1, is_guest: 1, sender: 1 });        // For guest message counting
messageSchema.index({ session_id: 1, timestamp: -1 });                 // For session-based queries

// Add to models/Embedding.js (if not exists)
embeddingChunkSchema.index({ chatbot_id: 1, embedding: "cosmos" });    // For vector search filtering

// Add to models/Subscription.js
subscriptionSchema.index({ chatbot_id: 1, status: 1 });                // For subscription lookup
```

### 2.3 Vector Search Optimization
```javascript
// In services/queryService.js - reduce candidates for faster search
const results = await EmbeddingChunk.aggregate([
  {
    $vectorSearch: {
      index: "embedding_vectorIndex",
      path: "embedding",
      queryVector: queryEmbedding,
      numCandidates: 50,  // Reduced from 200
      limit: topK,
      filter: { chatbot_id: chatbotId }
    }
  }
]);
```

### 2.4 Implementation Steps
1. **Create migration script** to add indexes
2. **Test index performance** with explain plans
3. **Monitor query execution times**
4. **Update query patterns** to use new indexes

---

## Phase 3: Asynchronous TTS Processing
**Expected Improvement**: 2-3 seconds reduction

### 3.1 Current Synchronous TTS
```javascript
// Current blocking TTS
let audio = null;
try {
  const ttsResponse = await axios.post("https://api.0804.in/api/text-to-speech", {
    text: cleanedAnswer
  }, { responseType: "arraybuffer" });
  // Process audio...
} catch (ttsError) {
  console.error("TTS failed:", ttsError.message);
}
```

### 3.2 Asynchronous TTS Implementation
```javascript
// Option A: Background TTS (immediate response)
const generateTTSAsync = async (text, sessionId, chatbotId) => {
  try {
    const ttsResponse = await axios.post("https://api.0804.in/api/text-to-speech", {
      text: text
    }, { responseType: "arraybuffer" });
    
    // Store audio in database or cache
    await storeAudioForSession(sessionId, chatbotId, ttsResponse.data);
    
    // Notify frontend via WebSocket or polling
    notifyAudioReady(sessionId, ttsResponse.data);
  } catch (error) {
    console.error("Background TTS failed:", error);
  }
};

// In answerQuery function
res.status(200).json({
  answer: finalAnswer,
  link: matchedLink,
  tokens: tokens,
  sessionId: sessionId,
  requiresAuthNext: requiresAuthNext,
  auth_method: authMethod,
  audio: null, // Will be available later
  audioStatus: 'generating'
});

// Generate TTS in background
setImmediate(() => generateTTSAsync(cleanedAnswer, sessionId, chatbotId));
```

### 3.3 Alternative: Optional TTS
```javascript
// Option B: Make TTS optional based on client config
const generateTTSIfEnabled = async (text, clientConfig) => {
  if (clientConfig?.enable_tts === false) {
    return null;
  }
  
  try {
    const ttsResponse = await axios.post("https://api.0804.in/api/text-to-speech", {
      text: text
    }, { responseType: "arraybuffer" });
    return processAudioResponse(ttsResponse);
  } catch (error) {
    console.error("TTS failed:", error);
    return null;
  }
};
```

### 3.4 Implementation Steps
1. **Add TTS configuration** to ClientConfig model
2. **Implement background TTS** processing
3. **Add audio storage** mechanism
4. **Update frontend** to handle async audio
5. **Add WebSocket support** for real-time audio delivery

---

## Phase 4: Intelligent Caching
**Expected Improvement**: 100-300ms reduction per request

### 4.1 Cache Strategy
```javascript
// In-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedData = (key) => {
  const item = cache.get(key);
  if (item && Date.now() - item.timestamp < CACHE_TTL) {
    return item.data;
  }
  cache.delete(key);
  return null;
};

const setCachedData = (key, data) => {
  cache.set(key, {
    data: data,
    timestamp: Date.now()
  });
};
```

### 4.2 Cacheable Operations
```javascript
// 1. Client Configuration Caching
const getCachedClientConfig = async (chatbotId) => {
  const cacheKey = `client_config_${chatbotId}`;
  let config = getCachedData(cacheKey);
  
  if (!config) {
    config = await getClientConfig(chatbotId);
    setCachedData(cacheKey, config);
  }
  
  return config;
};

// 2. Chatbot Data Caching
const getCachedChatbot = async (chatbotId) => {
  const cacheKey = `chatbot_${chatbotId}`;
  let chatbot = getCachedData(cacheKey);
  
  if (!chatbot) {
    chatbot = await Chatbot.findById(chatbotId).lean();
    setCachedData(cacheKey, chatbot);
  }
  
  return chatbot;
};

// 3. Subscription Caching
const getCachedSubscription = async (chatbotId) => {
  const cacheKey = `subscription_${chatbotId}`;
  let subscription = getCachedData(cacheKey);
  
  if (!subscription) {
    subscription = await Subscription.findOne({
      chatbot_id: chatbotId,
      status: "active"
    }).populate("plan_id");
    setCachedData(cacheKey, subscription);
  }
  
  return subscription;
};
```

### 4.3 Cache Invalidation
```javascript
// Invalidate cache when data changes
const invalidateCache = (pattern) => {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
};

// Example: Invalidate when chatbot is updated
exports.updateChatbot = catchAsync(async (req, res) => {
  const updated = await Chatbot.findByIdAndUpdate(id, { name }, { new: true });
  invalidateCache(`chatbot_${id}`);
  return sendSuccessResponse(res, updated, "Chatbot updated successfully");
});
```

### 4.4 Implementation Steps
1. **Create cache utility** module
2. **Implement cacheable functions** for frequent queries
3. **Add cache invalidation** on data updates
4. **Monitor cache hit rates** and memory usage
5. **Consider Redis** for production scaling

---

## Phase 5: Additional Optimizations

### 5.1 Reduce IP Geolocation Timeout
```javascript
// In controllers/chatController.js
const response = await axios.get(`https://ipapi.co/${ipAddress}/json/`, {
  timeout: 2000  // Reduced from 5000ms
});
```


### 5.3 Database Connection Optimization
```javascript
// In db.js
await mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 50,              // Increased from 20
  minPoolSize: 5,               // New
  maxIdleTimeMS: 30000,         // New
  serverSelectionTimeoutMS: 5000, // Reduced from 10000
  socketTimeoutMS: 45000,
  bufferMaxEntries: 0,          // New
  bufferCommands: false         // New
});
```

---

## Implementation Timeline

### Week 1: Parallelization
- [ ] Implement parallel operations in `answerQuery`
- [ ] Add comprehensive error handling
- [ ] Test performance improvements
- [ ] Deploy and monitor

### Week 2: Database Optimization
- [ ] Create and run index migration script
- [ ] Optimize vector search parameters
- [ ] Test query performance
- [ ] Monitor database metrics

### Week 3: Asynchronous TTS
- [ ] Implement background TTS processing
- [ ] Add audio storage mechanism
- [ ] Update frontend for async audio
- [ ] Test TTS reliability

### Week 4: Caching Implementation
- [ ] Create cache utility module
- [ ] Implement cacheable functions
- [ ] Add cache invalidation
- [ ] Monitor cache performance

---

## Monitoring and Metrics

### Key Performance Indicators
- **Response Time**: Target < 6 seconds
- **Database Query Time**: Target < 500ms per query
- **Cache Hit Rate**: Target > 80%
- **TTS Success Rate**: Target > 95%
- **Error Rate**: Target < 1%

### Monitoring Tools
```javascript
// Add performance monitoring
const performanceMonitor = {
  startTime: Date.now(),
  
  logTiming: (operation, duration) => {
    console.log(`⏱️  ${operation}: ${duration}ms`);
  },
  
  logTotalTime: () => {
    const totalTime = Date.now() - this.startTime;
    console.log(`🚀 Total response time: ${totalTime}ms`);
    return totalTime;
  }
};
```

---

## Expected Results

### Before Optimization
- **Response Time**: 11-15 seconds
- **User Experience**: Poor (long wait times)
- **Scalability**: Limited concurrent users

### After Optimization
- **Response Time**: 4-6 seconds (60-70% improvement)
- **User Experience**: Good (immediate feedback)
- **Scalability**: 3-5x more concurrent users
- **Resource Usage**: More efficient database queries

### Performance Breakdown
- **Parallelization**: -3 to -5 seconds
- **Database Indexes**: -200 to -500ms
- **Async TTS**: -2 to -3 seconds
- **Caching**: -100 to -300ms
- **Additional Optimizations**: -500ms to -1s

**Total Expected Improvement**: 6-9 seconds reduction

---

## Risk Mitigation

### Potential Issues
1. **Memory Usage**: Caching increases memory consumption
2. **Cache Consistency**: Stale data if not properly invalidated
3. **TTS Reliability**: Background processing may fail silently
4. **Database Load**: More concurrent queries during parallelization

### Mitigation Strategies
1. **Memory Monitoring**: Set cache size limits and TTL
2. **Cache Validation**: Implement cache versioning
3. **TTS Fallback**: Graceful degradation if TTS fails
4. **Connection Pooling**: Optimize database connections

---

## Next Steps

1. **Review and approve** this implementation plan
2. **Set up monitoring** infrastructure
3. **Create feature branches** for each phase
4. **Implement Phase 1** (Parallelization)
5. **Measure and validate** improvements
6. **Proceed to Phase 2** based on results

---

## Contact and Support

For questions or issues during implementation:
- **Technical Lead**: [Your Name]
- **Performance Monitoring**: [Monitoring Dashboard URL]
- **Documentation**: [Internal Wiki Link]

---

*Last Updated: [Current Date]*
*Version: 1.0*
