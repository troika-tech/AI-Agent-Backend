# Production Readiness Checklist

Complete checklist for verifying streaming chatbot backend is production-ready.

## How to Use This Checklist

1. ✅ = Completed and verified
2. ⏳ = In progress
3. ❌ = Not started or failed
4. N/A = Not applicable

**Target**: All items should be ✅ before production deployment.

---

## 1. Code Quality & Testing

### Unit Tests
- [ ] All core services have unit tests
- [ ] StreamingResponseService tests pass
- [ ] StreamingVoiceService tests pass
- [ ] MetricsService tests pass
- [ ] Test coverage ≥ 70%

**Verification**:
```bash
npm test
npm run test:coverage
```

### Integration Tests
- [ ] End-to-end streaming test passes
- [ ] User chatbot streaming endpoint tested
- [ ] Troika intelligent chat streaming tested
- [ ] TTS integration tested
- [ ] Error handling scenarios tested

**Verification**:
```bash
node scripts/testUserChatbotStreaming.js <CHATBOT_ID> "Test query"
```

### Load Testing
- [ ] Load test completed with target concurrency
- [ ] Performance meets latency targets (p95 < 1000ms)
- [ ] No memory leaks detected
- [ ] System stable under sustained load

**Verification**:
```bash
node scripts/loadTestStreaming.js sustained
```

### Code Review
- [ ] All Phase 4 code reviewed
- [ ] All Phase 5 code reviewed
- [ ] Security review completed
- [ ] No critical linting errors

**Verification**:
```bash
npm run lint
```

---

## 2. Configuration & Environment

### Environment Variables
- [ ] All required environment variables documented
- [ ] Production .env file created and secured
- [ ] Sensitive variables (API keys) stored securely
- [ ] Environment variables validated

**Verification**:
```bash
# Review PRODUCTION_ENV.md
node scripts/validateEnv.js
```

**Required Variables** (minimum):
- [ ] `NODE_ENV=production`
- [ ] `PORT` configured
- [ ] `MONGODB_URI` (production database)
- [ ] `REDIS_URL` configured
- [ ] `OPENAI_API_KEY` configured
- [ ] `GOOGLE_CLOUD_CREDENTIALS` path set
- [ ] `JWT_SECRET` set
- [ ] `SESSION_SECRET` set

### Feature Flags
- [ ] Feature flag system implemented
- [ ] Streaming feature flag configured
- [ ] Initial rollout percentage set (recommend 1%)
- [ ] Rollout API endpoints secured

**Verification**:
```bash
curl -s http://localhost:5000/api/metrics/feature-flags | jq
```

### Rate Limiting
- [ ] Streaming-specific rate limits configured
- [ ] Rate limit thresholds appropriate for production
- [ ] IP whitelisting configured (if needed)
- [ ] Rate limit logging enabled

**Verification**: Check [app.js:streamingLimiter](../app.js)

---

## 3. Infrastructure & Dependencies

### Node.js & Dependencies
- [ ] Node.js 18.x or higher installed
- [ ] All production dependencies installed
- [ ] No security vulnerabilities (npm audit)
- [ ] Dependencies up to date

**Verification**:
```bash
node --version
npm ci --production
npm audit --production
```

### MongoDB
- [ ] Production MongoDB instance configured
- [ ] Database indexes verified
- [ ] Connection pooling configured
- [ ] Backup strategy in place

**Verification**:
```bash
node scripts/verifyIndexes.js
```

### Redis
- [ ] Redis 6.0+ installed and running
- [ ] Redis persistence configured (if needed)
- [ ] Connection pooling configured
- [ ] Redis maxmemory policy set (`allkeys-lru`)

**Verification**:
```bash
redis-cli ping
redis-cli CONFIG GET maxmemory-policy
```

### Nginx
- [ ] Nginx 1.18+ installed
- [ ] SSE-specific configuration applied
- [ ] `proxy_buffering off` for streaming routes
- [ ] Timeouts configured (300s)
- [ ] SSL/TLS certificate installed
- [ ] Configuration tested

**Verification**:
```bash
nginx -v
sudo nginx -t
curl -I https://your-domain.com/api/metrics/health/streaming
```

**Critical Nginx Settings**:
```nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 300s;
```

### PM2
- [ ] PM2 installed globally
- [ ] Ecosystem config file created
- [ ] Cluster mode configured
- [ ] Auto-restart enabled
- [ ] PM2 startup script configured
- [ ] Log rotation configured

**Verification**:
```bash
pm2 --version
pm2 startup
pm2 list
```

---

## 4. Security

### API Security
- [ ] CORS configured appropriately
- [ ] Helmet.js security headers enabled
- [ ] Rate limiting enabled
- [ ] Input validation implemented
- [ ] SQL/NoSQL injection prevention
- [ ] XSS protection enabled

**Verification**: Review [middleware/security.js](../middleware/security.js)

### Authentication & Authorization
- [ ] JWT authentication configured
- [ ] Session management secure
- [ ] Admin endpoints protected
- [ ] Feature flag endpoints secured (production)

**Verification**: Test protected endpoints

### Sensitive Data
- [ ] API keys not committed to git
- [ ] .env file in .gitignore
- [ ] Database credentials secured
- [ ] Redis password set (if applicable)
- [ ] File permissions correct (600 for .env)

**Verification**:
```bash
git log --all --full-history -- .env
ls -la .env
```

### SSL/TLS
- [ ] Valid SSL certificate installed
- [ ] HTTPS enforced
- [ ] HTTP to HTTPS redirect configured
- [ ] TLS 1.2+ only
- [ ] Strong cipher suites configured

**Verification**:
```bash
curl -I https://your-domain.com
openssl s_client -connect your-domain.com:443 -tls1_2
```

---

## 5. Monitoring & Observability

### Metrics Endpoints
- [ ] Health check endpoint functional
- [ ] Streaming metrics endpoint functional
- [ ] Metrics summary endpoint functional
- [ ] Feature flags endpoint functional
- [ ] Endpoints return valid data

**Verification**:
```bash
curl -s http://localhost:5000/api/metrics/health/streaming | jq
curl -s http://localhost:5000/api/metrics/streaming/summary | jq
curl -s http://localhost:5000/api/metrics/feature-flags | jq
```

### Logging
- [ ] Structured logging implemented
- [ ] Log levels configured appropriately
- [ ] PM2 logs configured
- [ ] Nginx access/error logs configured
- [ ] Log rotation configured
- [ ] Sensitive data not logged

**Verification**:
```bash
pm2 logs chatbot-backend --lines 20
sudo tail /var/log/nginx/chatbot-backend-access.log
```

### Alerting
- [ ] Health check alerts configured
- [ ] Error rate alerts configured
- [ ] Latency alerts configured
- [ ] Resource usage alerts configured
- [ ] Alert destinations configured (email/Slack)
- [ ] Alert thresholds tested

**Verification**: Trigger test alert

### Dashboard
- [ ] Metrics dashboard accessible
- [ ] Key metrics visible (success rate, latency, errors)
- [ ] Real-time updates working
- [ ] Historical data available

**Verification**: Access dashboard URL

---

## 6. Performance & Optimization

### Caching
- [ ] KB context caching enabled (10min TTL)
- [ ] TTS audio caching enabled (1hr TTL)
- [ ] Redis connection verified
- [ ] Cache hit rates monitored

**Verification**:
```bash
curl -s http://localhost:5000/api/metrics/streaming | jq '.metrics.cache'
```

### Memory Management
- [ ] Active stream tracking implemented
- [ ] Proper cleanup in finally blocks
- [ ] Memory limits configured (PM2)
- [ ] No memory leaks detected in testing

**Verification**: Run load test and monitor memory

### Database Performance
- [ ] Indexes created for frequent queries
- [ ] Query performance optimized
- [ ] Connection pooling enabled
- [ ] No N+1 query issues

**Verification**: Check MongoDB slow query log

### Response Optimization
- [ ] Response length limiting enabled (2000 chars)
- [ ] Client disconnect detection implemented
- [ ] Sentence detection for TTS working
- [ ] Audio streaming chunking optimized

**Verification**: Review StreamingResponseService implementation

---

## 7. Error Handling & Resilience

### Error Handling
- [ ] Global error handler configured
- [ ] Streaming-specific error handling
- [ ] Graceful degradation (TTS optional)
- [ ] User-friendly error messages
- [ ] Error logging with context

**Verification**: Test error scenarios

### Circuit Breakers
- [ ] OpenAI API error handling
- [ ] Google Cloud TTS error handling
- [ ] MongoDB connection error handling
- [ ] Redis connection error handling

**Verification**: Test with service unavailable

### Fallback Strategies
- [ ] TTS failure doesn't block text streaming
- [ ] Cache miss doesn't fail request
- [ ] History retrieval failure handled gracefully

**Verification**: Test with Redis/MongoDB down

### Timeouts
- [ ] OpenAI streaming timeout configured
- [ ] TTS timeout configured
- [ ] Database query timeouts set
- [ ] HTTP request timeouts configured

**Verification**: Review timeout configurations

---

## 8. Deployment Preparation

### Backups
- [ ] Database backup created
- [ ] Current code backed up
- [ ] Nginx config backed up
- [ ] Environment variables backed up (securely)
- [ ] Backup restoration tested

**Verification**:
```bash
mongodump --uri="$MONGODB_URI" --out=/backup/$(date +%Y%m%d)
tar -czf /backup/chatbot-backend-$(date +%Y%m%d).tar.gz /path/to/chatbot-backend
```

### Git Repository
- [ ] All changes committed
- [ ] Code pushed to remote repository
- [ ] Deployment tag created
- [ ] No uncommitted changes
- [ ] `.gitignore` properly configured

**Verification**:
```bash
git status
git tag backup-$(date +%Y%m%d-%H%M%S)
git push --tags
```

### Documentation
- [ ] DEPLOYMENT_GUIDE.md reviewed
- [ ] PRODUCTION_ENV.md complete
- [ ] MONITORING.md reviewed
- [ ] API documentation updated
- [ ] Runbooks created

**Verification**: Review all docs/ files

### Deployment Plan
- [ ] Deployment steps documented
- [ ] Rollback plan documented
- [ ] Zero-downtime strategy confirmed
- [ ] Deployment window scheduled
- [ ] Team notified of deployment

**Verification**: Review [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

## 9. Production Deployment

### Pre-Deployment
- [ ] All checklist items completed
- [ ] Stakeholders notified
- [ ] Deployment window confirmed
- [ ] On-call engineer assigned
- [ ] Rollback plan reviewed

### Initial Deployment
- [ ] Code deployed to production server
- [ ] Dependencies installed (`npm ci --production`)
- [ ] Environment variables configured
- [ ] Nginx configuration updated
- [ ] PM2 started/reloaded
- [ ] Application started successfully

**Verification**:
```bash
pm2 status chatbot-backend
curl -s http://localhost:5000/api/metrics/health/streaming
```

### Post-Deployment Verification
- [ ] Health check returns "healthy"
- [ ] Metrics endpoints accessible
- [ ] Logs show no errors
- [ ] PM2 processes running
- [ ] Feature flags set correctly (1% initial rollout)

**Verification Commands**:
```bash
# Health check
curl -s https://your-domain.com/api/metrics/health/streaming | jq -r '.status'

# Metrics
curl -s https://your-domain.com/api/metrics/streaming/summary | jq

# PM2 status
pm2 status

# Logs (no errors)
pm2 logs chatbot-backend --lines 50 --nostream

# Feature flags
curl -s https://your-domain.com/api/metrics/feature-flags | jq '.flags.streaming.rolloutPercentage'
```

### Smoke Tests
- [ ] Test streaming endpoint manually
- [ ] Test with real chatbot ID
- [ ] Test with/without TTS
- [ ] Test error scenarios
- [ ] Verify latency acceptable

**Verification**:
```bash
node scripts/testUserChatbotStreaming.js <PROD_CHATBOT_ID> "Hello, test query"
```

---

## 10. Gradual Rollout

### Phase 1: 1% (Day 1)
- [ ] Rollout set to 1%
- [ ] Monitor for 2-4 hours
- [ ] Error rate < 1%
- [ ] Latency within targets
- [ ] No critical errors in logs

**Verification**:
```bash
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":1}'

# Monitor
watch -n 60 'curl -s http://localhost:5000/api/metrics/streaming/summary | jq'
```

### Phase 2: 5% (Day 2 AM)
- [ ] Metrics from 1% look good
- [ ] Rollout increased to 5%
- [ ] Monitor for 4-8 hours
- [ ] Success rate > 95%

### Phase 3: 10% (Day 2 PM)
- [ ] Metrics from 5% look good
- [ ] Rollout increased to 10%
- [ ] Monitor for remainder of day

### Phase 4: 25% (Day 3 AM)
- [ ] Metrics from 10% look good
- [ ] Rollout increased to 25%
- [ ] Monitor closely

### Phase 5: 50% (Day 3 PM)
- [ ] Metrics from 25% look good
- [ ] Rollout increased to 50%
- [ ] Majority of traffic now on streaming

### Phase 6: 75% (Day 4)
- [ ] Metrics from 50% look good
- [ ] Rollout increased to 75%

### Phase 7: 90% (Day 5 AM)
- [ ] Metrics from 75% look good
- [ ] Rollout increased to 90%

### Phase 8: 100% (Day 5 PM)
- [ ] All metrics healthy throughout rollout
- [ ] Full rollout to 100%
- [ ] Monitor for 24 hours

**Decision Criteria** (for proceeding to next phase):
- ✅ Error rate < 1%
- ✅ Success rate > 95%
- ✅ Avg first token latency < 1000ms
- ✅ No critical errors in logs
- ✅ System resources within limits

**Rollback Criteria** (immediate rollback if):
- ❌ Error rate > 2%
- ❌ Success rate < 90%
- ❌ Avg first token latency > 2000ms
- ❌ Critical errors detected
- ❌ System overload

---

## 11. Post-Rollout

### Monitoring (Week 1)
- [ ] Daily health check reviews
- [ ] Daily metrics reviews
- [ ] Error logs reviewed daily
- [ ] Performance trends monitored
- [ ] No degradation detected

### Optimization Opportunities
- [ ] Identify slow queries
- [ ] Optimize cache TTLs if needed
- [ ] Adjust rate limits if needed
- [ ] Fine-tune feature flags
- [ ] Document lessons learned

### Documentation Updates
- [ ] Update deployment docs with actual experience
- [ ] Document any issues encountered
- [ ] Update runbooks based on incidents
- [ ] Share knowledge with team

### Stakeholder Communication
- [ ] Success metrics shared with stakeholders
- [ ] Performance improvements documented
- [ ] User feedback collected
- [ ] Next steps identified

---

## 12. Incident Response Readiness

### Runbooks
- [ ] Rollback procedure documented and tested
- [ ] Incident response playbook created
- [ ] Emergency contacts documented
- [ ] Escalation path defined

### Testing
- [ ] Rollback procedure tested in staging
- [ ] Feature flag disable tested
- [ ] Emergency stop procedure tested
- [ ] Monitoring alerts tested

### Team Readiness
- [ ] On-call rotation established
- [ ] Team trained on new monitoring
- [ ] Team trained on rollback procedures
- [ ] Communication channels established

---

## Sign-Off

### Technical Lead
- [ ] Code reviewed and approved
- [ ] Architecture reviewed
- [ ] Performance targets validated
- [ ] Security review passed

**Name**: ________________
**Date**: ________________
**Signature**: ________________

### DevOps Lead
- [ ] Infrastructure ready
- [ ] Monitoring configured
- [ ] Backups verified
- [ ] Deployment plan approved

**Name**: ________________
**Date**: ________________
**Signature**: ________________

### Product Owner
- [ ] Feature validated
- [ ] Rollout plan approved
- [ ] Success criteria agreed
- [ ] Go-live authorized

**Name**: ________________
**Date**: ________________
**Signature**: ________________

---

## Quick Pre-Deployment Verification Script

```bash
#!/bin/bash
# quick-check.sh - Run before deployment

echo "=== Production Readiness Quick Check ==="

# 1. Tests
echo "Running tests..."
npm test || { echo "❌ Tests failed"; exit 1; }
echo "✅ Tests passed"

# 2. Linting
echo "Running linter..."
npm run lint || { echo "❌ Linting failed"; exit 1; }
echo "✅ Linting passed"

# 3. Security audit
echo "Running security audit..."
npm audit --production --audit-level=high || { echo "❌ Security vulnerabilities found"; exit 1; }
echo "✅ No high/critical vulnerabilities"

# 4. Environment variables
echo "Checking environment variables..."
if [ ! -f .env ]; then
  echo "❌ .env file not found"
  exit 1
fi
echo "✅ .env file exists"

# 5. Git status
echo "Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  Uncommitted changes detected"
fi

# 6. Health check (if server running)
echo "Testing health check endpoint..."
HEALTH=$(curl -s http://localhost:5000/api/metrics/health/streaming | jq -r '.status' 2>/dev/null)
if [ "$HEALTH" = "healthy" ]; then
  echo "✅ Health check passed"
else
  echo "⚠️  Health check not available (server not running?)"
fi

echo ""
echo "=== Quick Check Complete ==="
echo "Review any warnings above before deploying."
```

**Usage**:
```bash
chmod +x scripts/quick-check.sh
./scripts/quick-check.sh
```

---

## Summary

**Total Checklist Items**: ~150+

**Critical Items** (must be completed):
- All tests passing
- Security vulnerabilities addressed
- Environment variables configured
- Backups created
- Monitoring configured
- Rollback plan tested
- Health checks passing

**Recommended Items** (should be completed):
- Load testing completed
- Documentation reviewed
- Team trained
- Alerts configured

**Optional Items** (nice to have):
- Advanced dashboards
- Additional monitoring
- Enhanced logging

---

## Notes

- This checklist is comprehensive but may not cover all edge cases specific to your environment
- Adjust thresholds and targets based on your specific requirements
- Schedule regular reviews of this checklist to keep it up to date
- Document any deviations from this checklist with justification

---

**Last Updated**: 2025-10-11
**Version**: 1.0
**Owner**: [Technical Lead Name]
