# Streaming Architecture Implementation Plan
## Complete Roadmap for Real-Time Chat Streaming

---

**Document Version:** 1.0
**Date:** January 2025
**Owner:** Development Team
**Estimated Timeline:** 4 weeks (28 days)
**Status:** Planning Phase

---

## 📋 Executive Summary

### Objective
Transform both chat systems (Troika Intelligent Chat + User Chatbots) from blocking responses (8-11s latency) to streaming responses (~800ms first content, 2-3s complete response).

### Approach
Build shared streaming infrastructure using:
- **OpenAI Streaming API** for text generation
- **Google Cloud Chirp HD Streaming API** for audio generation
- **Server-Sent Events (SSE)** for client communication
- **Sentence-level chunking** for low-latency audio

### Expected Impact
- **10x perceived performance improvement** (8-11s → 800ms first content)
- **Zero cost increase** (same APIs, better caching)
- **Better user experience** (progressive loading, instant feedback)

### Risk Level
**Medium** - New infrastructure, but backward compatible with fallback to existing REST endpoints.

---

## 🎯 Success Criteria

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Time to first text token | 8-11s | <500ms | SSE event timestamp |
| Time to first audio chunk | 8-11s | <1.5s | SSE event timestamp |
| Complete response time | 8-11s | <3s | End-to-end duration |
| Error rate | <1% | <1% | Failed streams / total |
| Success rate | >99% | >99% | Successful completions |
| Audio cache hit rate | 0% | >20% | Redis cache metrics |
| User satisfaction | Baseline | >4/5 | Post-interaction rating |
| Cost increase | - | ≤5% | Monthly API costs |

---

## 🏗️ Architecture Overview

### High-Level Components

```
┌─────────────────────────────────────────────────────┐
│               CLIENT APPLICATIONS                    │
│   (Troika Chat Frontend + User Chatbot Widgets)     │
└──────────────────┬──────────────────────────────────┘
                   │ SSE Connection
                   ▼
┌─────────────────────────────────────────────────────┐
│              STREAMING CONTROLLERS                   │
│  • troikaIntelligentChatController (streaming)      │
│  • messageController (streaming)                     │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│         STREAMING RESPONSE SERVICE                   │
│         (Shared Orchestrator)                        │
│  • Coordinates OpenAI + TTS streaming               │
│  • Manages SSE connection lifecycle                 │
│  • Handles sentence detection & chunking            │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ OpenAI   │ │ Google   │ │ Sentence │
│ Stream   │ │ TTS      │ │ Detector │
│          │ │ Stream   │ │          │
└──────────┘ └──────────┘ └──────────┘
```

### Data Flow

```
User Query → SSE Init → OpenAI Stream → Sentence Detection
                              ↓              ↓
                         Text Chunks    TTS Stream
                              ↓              ↓
                         Client Display  Audio Queue
                              ↓              ↓
                         Suggestions    Audio Playback
                              ↓
                         Complete Event
```

---

## 📅 Implementation Phases

### Phase 1: Foundation & Infrastructure (Days 1-5)
**Goal:** Build core streaming components

#### Tasks
1. **StreamingVoiceService** (Days 1-2)
   - Wrap Google Cloud Chirp HD Streaming API
   - Handle voice selection (14+ languages)
   - Implement audio format conversion (LINEAR16 → base64)
   - Error handling and retry logic

2. **SentenceDetector Utility** (Day 2)
   - Multi-language boundary detection (English, Hindi, Hinglish)
   - Edge case handling (prices ₹25,000., abbreviations, URLs)
   - Buffer management

3. **StreamingResponseService** (Days 3-4)
   - Core orchestrator for entire streaming pipeline
   - Coordinate OpenAI + TTS + SSE
   - Parallel processing (text + audio generation)
   - Suggestion extraction from stream

4. **SSEHelper Utility** (Day 4)
   - SSE connection initialization
   - Event formatting and transmission
   - Heartbeat mechanism (keep-alive)
   - Connection cleanup

5. **Service Integration** (Day 5)
   - Add streaming methods to IntelligentResponseService
   - Add streaming methods to ChatService
   - Maintain backward compatibility with existing methods

#### Deliverables
- ✅ 5 new service/utility files
- ✅ Unit tests (50+ test cases)
- ✅ Integration tests (10+ scenarios)
- ✅ Documentation for each component

---

### Phase 2: Troika Intelligent Chat Streaming (Days 6-10)
**Goal:** Implement streaming for `/api/troika/intelligent-chat` (internal testing ground)

#### Tasks
1. **Streaming Controller** (Day 6)
   - New `streamIntelligentQuery` method
   - SSE connection management
   - Error handling with graceful degradation
   - Async database saves (non-blocking)

2. **Streaming Routes** (Day 7)
   - Add `/api/troika/intelligent-chat/stream` endpoint
   - SSE-specific middleware
   - Request validation
   - CORS configuration

3. **Comprehensive Testing** (Days 8-9)
   - Unit tests: Individual methods
   - Integration tests: Full streaming pipeline
   - Load tests: 100+ concurrent streams
   - Multi-language tests: English, Hindi, Hinglish
   - Edge cases: Long responses, network interruptions, TTS failures

4. **Documentation** (Day 10)
   - API documentation (endpoints, events, examples)
   - Integration guide (frontend EventSource setup)
   - Troubleshooting guide
   - Deployment checklist

#### Deliverables
- ✅ Troika streaming endpoint fully functional
- ✅ Test suite (100+ tests, >80% coverage)
- ✅ Complete documentation
- ✅ Performance benchmarks

---

### Phase 3: User Chatbot Streaming (Days 11-15)
**Goal:** Roll out streaming to `/api/chat/query` (client chatbots)

#### Tasks
1. **User Chatbot Controller** (Day 11)
   - New `streamQuery` method in messageController
   - Per-chatbot TTS settings (optional audio)
   - Similar to Troika but without market intelligence

2. **User Chatbot Routes** (Day 12)
   - Add `/api/chat/query/stream` endpoint
   - Backward compatible (keep existing `/query` endpoint)

3. **Widget Update** (Day 13)
   - Update chatbot widget JavaScript
   - SSE EventSource implementation
   - Audio queue and playback logic
   - Automatic fallback to REST if streaming fails
   - Feature flag: `enableStreaming` (default: true)

4. **Client Documentation** (Day 14)
   - Client integration guide
   - Migration checklist
   - Code examples (EventSource, audio playback)
   - FAQ for clients
   - Browser compatibility matrix

5. **Beta Testing** (Day 15)
   - Select 5-10 pilot clients
   - Enable streaming for pilot group
   - Monitor metrics closely
   - Collect feedback
   - Fix issues before wider rollout

#### Deliverables
- ✅ User chatbot streaming endpoint
- ✅ Updated widget code with fallback
- ✅ Client documentation
- ✅ Beta test results

---

### Phase 4: Optimization & Production Hardening (Days 16-20)
**Goal:** Optimize performance, add monitoring, handle edge cases

#### Tasks
1. **Caching Strategy** (Days 16-17)
   - **KB Context Caching:** Cache vector search results per session (Redis, 10min TTL)
   - **TTS Audio Caching:** Cache common phrases (Redis, 1hr TTL)
   - **Pre-generation:** Pre-generate audio for greetings at startup
   - **Connection Pooling:** Reuse TTS client connections

2. **Memory Management** (Day 17)
   - Stream cleanup (ensure all streams closed)
   - Memory leak detection (monitoring)
   - Proper event listener cleanup

3. **Monitoring & Alerting** (Day 18)
   - **MetricsService:** Track latency, error rate, cache hits, active connections
   - **Metrics Endpoint:** `/metrics/streaming` for dashboard
   - **Alerting Rules:** High error rate (>5%), high latency (>1s), low cache hit rate
   - **Structured Logging:** Client ID, stage, latency, error details

4. **Edge Case Handling** (Day 19)
   - Very long responses (>1000 words) → Limit and truncate
   - Network interruptions → Detect client disconnect early
   - Rate limiting → Per-client stream limits
   - Malformed input → Sanitization and validation
   - TTS failures → Graceful fallback to text-only
   - OpenAI failures → Retry with backoff, then error message

5. **Load Testing** (Day 20)
   - **Sustained Load:** 50 concurrent users, 10 req/s, 1000 requests
   - **Spike Test:** 200 concurrent users, sudden spike
   - **Endurance Test:** 20 concurrent users, 10 minutes continuous
   - **Performance Validation:** Verify all targets met

#### Deliverables
- ✅ Caching implemented (20-30% cache hit rate)
- ✅ Monitoring dashboard live
- ✅ Alerting configured (Slack/email)
- ✅ Edge cases handled gracefully
- ✅ Load test results (targets met)

---

### Phase 5: Production Deployment & Monitoring (Days 21-28)
**Goal:** Deploy to production with gradual rollout

#### Tasks
1. **Infrastructure Preparation** (Days 21-22)
   - **Nginx Configuration:** Disable buffering for SSE routes
   - **Environment Variables:** Production config
   - **Health Checks:** `/health/streaming` endpoint (test OpenAI, TTS, Redis)
   - **Deployment:** Zero-downtime restart with PM2

2. **Gradual Rollout** (Days 23-25)
   - **Feature Flag System:** Control rollout percentage dynamically
   - **Rollout Schedule:**
     - Day 23: 1% (initial production test)
     - Day 24 AM: 5% (early adopters)
     - Day 24 PM: 10% (expanded testing)
     - Day 25 AM: 25% (broader rollout)
     - Day 25 PM: 50% (majority)
   - **Monitoring:** Watch error rates, latency, resource usage
   - **Rollback Plan:** Instant rollback to 0% if error rate >2%

3. **Full Rollout** (Days 26-28)
   - Day 26: 75%
   - Day 27: 90%
   - Day 28: 100% (full deployment)
   - **Monitoring Dashboard:** Real-time metrics display
   - **User Feedback:** Post-interaction rating system
   - **Weekly Review:** Metrics, feedback, action items

#### Deliverables
- ✅ Production deployment complete
- ✅ 100% rollout achieved
- ✅ Monitoring and alerting live
- ✅ User feedback system active
- ✅ Performance targets met in production

---

## 🛠️ Technology Stack

### Core Technologies
- **Backend:** Node.js 18+, Express 5
- **Streaming:**
  - OpenAI API (text streaming)
  - Google Cloud Chirp HD (audio streaming)
  - Server-Sent Events (SSE)
- **Caching:** Redis
- **Database:** MongoDB (existing)
- **Testing:** Jest, Supertest
- **Load Testing:** Artillery or custom scripts

### New Dependencies
```json
{
  "@google-cloud/text-to-speech": "^latest",
  "openai": "^5.8.2" // (already installed, supports streaming)
}
```

### Infrastructure Requirements
- **Nginx:** SSE configuration (disable buffering)
- **Redis:** For caching (already have)
- **Load Balancer:** Must support long-lived connections
- **Monitoring:** CloudWatch/Grafana (optional)

---

## 📊 File Structure

### New Files to Create
```
services/
├── streamingVoiceService.js          # Chirp HD wrapper
├── streamingResponseService.js       # Core orchestrator
└── metricsService.js                 # Performance tracking

utils/
├── sentenceDetector.js               # Sentence boundary detection
└── sseHelper.js                      # SSE utilities

tests/
├── streamingVoiceService.test.js
├── streamingResponseService.test.js
├── sentenceDetector.test.js
└── load/
    └── streaming-load-test.js        # Load test scripts

docs/
├── STREAMING_IMPLEMENTATION_PLAN.md  # This document
├── STREAMING_API.md                  # API documentation
├── STREAMING_INTEGRATION.md          # Frontend guide
└── STREAMING_TROUBLESHOOTING.md      # Debug guide
```

### Files to Modify
```
controllers/
├── troikaIntelligentChatController.js  # Add streamIntelligentQuery()
└── chat/messageController.js           # Add streamQuery()

services/
├── intelligentResponseService.js       # Add generateStreamingResponse()
└── chatService.js                      # Add generateStreamingAnswer()

routes/
├── troikaIntelligentChatRoutes.js      # Add /stream endpoint
└── chatRoutes.js                       # Add /stream endpoint

public/chatbot-loader/
└── widget.js                           # Add SSE support
```

---

## 💰 Cost Analysis

### Development Costs
| Item | Estimate |
|------|----------|
| Senior Developer (4 weeks) | Internal resource |
| Testing & QA | Included in timeline |
| Infrastructure | Existing servers |
| **Total Dev Cost** | Internal |

### Operational Cost Impact

#### Current (Non-Streaming)
- OpenAI API: ~$30/month
- Google TTS API: ~$15/month
- Redis: $0 (already have)
- **Total: ~$45/month**

#### After Streaming
- OpenAI API: ~$30/month (same - streaming doesn't add cost)
- Google TTS API: ~$11/month (25% savings from caching)
- Redis: +$0 (already have)
- **Total: ~$41/month**

#### Net Impact
**Cost savings: ~$4/month** due to TTS caching

### ROI Calculation
- Development time: 4 weeks (one-time)
- User satisfaction increase: Expected +15-20%
- Perceived performance: 10x improvement
- Client retention: Improved (competitive advantage)
- **ROI: High** (better UX = better retention = more revenue)

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Google TTS quota exceeded** | High | Low | Monitor usage, implement rate limiting, fallback to text-only |
| **OpenAI API downtime** | High | Low | Retry with backoff, fallback to cached responses |
| **High memory usage from streams** | Medium | Medium | Proper stream cleanup, memory monitoring, alerts |
| **SSE not supported by client** | Low | Low | Automatic fallback to REST endpoint |
| **Network interruptions** | Medium | Medium | Detect client disconnect early, cleanup resources |
| **Load balancer buffering SSE** | Medium | Low | Configure nginx/LB to not buffer SSE routes |
| **Client widget breaks** | High | Low | Gradual rollout, feature flag, fallback to REST |
| **Audio playback issues** | Medium | Medium | Browser compatibility testing, error handling |

---

## 🧪 Testing Strategy

### Unit Tests (Days 1-5, 8, 11)
- Test each service method in isolation
- Mock external dependencies (OpenAI, Google TTS)
- Target: >80% code coverage

### Integration Tests (Days 8-9, 11-12)
- Test full streaming pipeline end-to-end
- Verify SSE event sequence
- Test error scenarios (TTS failure, network interruption)

### Load Tests (Day 20)
- **Sustained:** 50 concurrent, 1000 requests
- **Spike:** 200 concurrent, sudden load
- **Endurance:** 20 concurrent, 10 minutes

### Multi-Language Tests (Day 9, 14)
- English, Hindi, Hinglish
- Special characters (₹, %, etc.)
- Mixed language content

### Browser Compatibility (Day 13-14)
- Chrome, Firefox, Safari, Edge
- Mobile browsers (iOS Safari, Chrome Mobile)
- Fallback for IE11 (if needed)

---

## 📈 Monitoring & Metrics

### Key Performance Indicators (KPIs)

#### Latency Metrics
- Time to first text token (target: <500ms)
- Time to first audio chunk (target: <1.5s)
- Complete response time (target: <3s)
- 95th percentile latency
- 99th percentile latency

#### Reliability Metrics
- Success rate (target: >99%)
- Error rate (target: <1%)
- Fallback rate (streams falling back to REST)
- Active SSE connections (concurrent)

#### Efficiency Metrics
- KB context cache hit rate (target: >90% for follow-ups)
- TTS audio cache hit rate (target: >20%)
- Average sentences per response
- Average audio chunks per response

#### Cost Metrics
- OpenAI tokens used per day
- Google TTS characters per day
- Estimated daily cost
- Cost per 1000 requests

### Monitoring Tools
- **Application:** Custom MetricsService
- **Infrastructure:** PM2, CloudWatch, or Grafana
- **Alerts:** Slack, Email, PagerDuty
- **Dashboard:** `/dashboard/streaming` endpoint

---

## 📚 Documentation Deliverables

1. **API Documentation** (`STREAMING_API.md`)
   - Endpoint specifications
   - SSE event types
   - Request/response formats
   - Code examples (JavaScript, cURL)

2. **Integration Guide** (`STREAMING_INTEGRATION.md`)
   - Frontend EventSource setup
   - Audio queue implementation
   - Error handling and fallbacks
   - Best practices

3. **Troubleshooting Guide** (`STREAMING_TROUBLESHOOTING.md`)
   - Common issues and solutions
   - Debug checklist
   - Log analysis tips
   - Performance optimization

4. **Client Migration Guide** (`CLIENT_MIGRATION.md`)
   - For users integrating via API
   - Step-by-step migration
   - Before/after code examples
   - FAQ

5. **Deployment Runbook** (`DEPLOYMENT_RUNBOOK.md`)
   - Pre-deployment checklist
   - Deployment steps
   - Rollback procedures
   - Post-deployment validation

---

## 🚀 Rollout Strategy

### Phase 1: Internal Testing (Day 23)
- **Audience:** Internal team only
- **Rollout:** 1%
- **Duration:** 4-6 hours
- **Success Criteria:** No crashes, error rate <1%

### Phase 2: Pilot Clients (Days 24-25)
- **Audience:** 5-10 selected clients
- **Rollout:** 5% → 10% → 25% → 50%
- **Duration:** 2 days
- **Success Criteria:** Positive feedback, latency targets met

### Phase 3: Gradual Expansion (Days 26-27)
- **Audience:** All users
- **Rollout:** 75% → 90%
- **Duration:** 2 days
- **Success Criteria:** All metrics green at scale

### Phase 4: Full Deployment (Day 28)
- **Audience:** All users
- **Rollout:** 100%
- **Success Criteria:** Production-stable for 24 hours

### Rollback Triggers
- Error rate >2%
- Memory leak detected
- Critical bug reported
- OpenAI/TTS API issues

### Rollback Procedure
1. Set feature flag to 0% (instant)
2. Or disable globally: `STREAMING_ENABLED=false`
3. Restart backend: `pm2 restart chatbot-backend`
4. Investigate logs
5. Fix issue in staging
6. Resume rollout from lower percentage

---

## ✅ Pre-Implementation Checklist

### Technical Prerequisites
- [ ] Node.js 18+ installed
- [ ] Google Cloud credentials configured
- [ ] OpenAI API key active
- [ ] Redis server running
- [ ] MongoDB connection stable
- [ ] Nginx/load balancer supports long connections
- [ ] Dev/staging environment available

### Team Prerequisites
- [ ] Plan reviewed by technical lead
- [ ] Timeline approved by stakeholders
- [ ] Resources allocated (1 senior dev, 4 weeks)
- [ ] Testing environment prepared
- [ ] Monitoring tools configured

### Documentation Prerequisites
- [ ] Current API documentation reviewed
- [ ] Existing codebase understood
- [ ] Service architecture mapped
- [ ] Integration points identified

---

## 📞 Support & Communication

### Stakeholder Communication
- **Daily:** Quick status update (5 min)
- **Weekly:** Detailed progress report
- **Milestones:** Demo to stakeholders
- **Issues:** Immediate escalation if blocked

### Client Communication
- **Before rollout:** Announcement email (Day 22)
- **During beta:** Direct communication with pilot clients
- **During rollout:** Status page updates
- **After rollout:** Success announcement

### Team Communication
- **Daily standups:** Progress, blockers, plans
- **Slack channel:** #streaming-implementation
- **Documentation:** Keep docs updated as we build
- **Code reviews:** Required for all PRs

---

## 🎯 Definition of Done

### Phase 1 Complete When:
- [ ] All 5 services/utilities created
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] Code reviewed and merged
- [ ] Documentation written

### Phase 2 Complete When:
- [ ] Troika streaming endpoint live
- [ ] All tests passing (100+ tests)
- [ ] Performance benchmarks meet targets
- [ ] Documentation complete
- [ ] Stakeholder demo successful

### Phase 3 Complete When:
- [ ] User chatbot streaming endpoint live
- [ ] Widget updated with SSE support
- [ ] Client documentation published
- [ ] Beta testing successful (5-10 clients)
- [ ] Feedback collected and addressed

### Phase 4 Complete When:
- [ ] Caching implemented and working
- [ ] Monitoring dashboard live
- [ ] Alerting configured and tested
- [ ] Edge cases handled
- [ ] Load tests passing

### Phase 5 Complete When:
- [ ] Production deployment complete
- [ ] 100% rollout achieved
- [ ] All metrics green for 48 hours
- [ ] User feedback positive (>4/5 rating)
- [ ] Documentation complete and published

---

## 📝 Sign-off

### Approvals Required

**Technical Lead:** ____________________  Date: ________

**Product Owner:** ____________________  Date: ________

**DevOps Lead:** ____________________  Date: ________

---

## 🔄 Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2025 | Development Team | Initial implementation plan |

---

## 📎 Appendices

### Appendix A: SSE Event Types
```javascript
const SSE_EVENTS = {
  connected: 'Initial connection established',
  text: 'Text token streamed',
  audio: 'Audio chunk ready',
  suggestions: 'Follow-up questions',
  metadata: 'Response metadata',
  status: 'Processing status',
  warning: 'Non-fatal issues',
  error: 'Fatal errors',
  complete: 'Stream finished',
  close: 'Connection closing'
};
```

### Appendix B: Chirp HD Voice Names
```
English:
- en-US-Chirp-HD-D (Male)
- en-US-Chirp-HD-F (Female)
- en-US-Chirp-HD-O (Neutral)
- en-IN-Chirp-HD-D/F/O (Indian English)

Hindi:
- hi-IN-Chirp-HD-D (Male)
- hi-IN-Chirp-HD-F (Female)
- hi-IN-Chirp-HD-O (Neutral)
```

### Appendix C: Performance Targets Summary
| Metric | Target |
|--------|--------|
| First token latency | <500ms |
| First audio latency | <1.5s |
| Complete response | <3s |
| Error rate | <1% |
| Success rate | >99% |
| Cache hit rate | >20% |
| Concurrent connections | 500+ |

### Appendix D: Cost Breakdown
| Service | Current | After Streaming | Change |
|---------|---------|-----------------|--------|
| OpenAI | $30/mo | $30/mo | $0 |
| TTS | $15/mo | $11/mo | -$4 |
| Redis | $0 | $0 | $0 |
| **Total** | **$45/mo** | **$41/mo** | **-$4/mo** |

---

**END OF IMPLEMENTATION PLAN**
