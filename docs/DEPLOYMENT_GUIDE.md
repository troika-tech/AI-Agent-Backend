# Production Deployment Guide

Complete guide for deploying the streaming chatbot backend to production with zero downtime.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Deployment Steps](#deployment-steps)
- [Post-Deployment Verification](#post-deployment-verification)
- [Gradual Rollout Strategy](#gradual-rollout-strategy)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring](#monitoring)

---

## Prerequisites

### Infrastructure Requirements
- **Node.js**: 18.x or higher
- **PM2**: Latest version (for process management)
- **Nginx**: 1.18+ (for reverse proxy with SSE support)
- **MongoDB**: 4.4+ (existing)
- **Redis**: 6.0+ (for caching)
- **SSL Certificate**: Valid SSL certificate for HTTPS

### Access Requirements
- SSH access to production server
- Database credentials
- API keys (OpenAI, Google Cloud)
- Redis connection details
- Domain DNS configured

---

## Pre-Deployment Checklist

### 1. Code Preparation
```bash
# Ensure all tests pass
npm test

# Run linter
npm run lint

# Build if necessary
npm run build  # If applicable

# Verify dependencies
npm ci  # Clean install

# Check for security vulnerabilities
npm audit
```

### 2. Environment Configuration
```bash
# Copy production environment template
cp .env.example .env.production

# Edit and verify all variables
nano .env.production

# Validate environment variables
node scripts/validateEnv.js
```

### 3. Database Migrations
```bash
# Run any pending migrations
npm run migrate  # If applicable

# Verify database indexes
node scripts/verifyIndexes.js
```

### 4. Backup Current System
```bash
# Backup database
mongodump --uri="mongodb+srv://..." --out=/backup/$(date +%Y%m%d)

# Backup current code
tar -czf /backup/chatbot-backend-$(date +%Y%m%d).tar.gz /path/to/chatbot-backend

# Backup Nginx config
cp /etc/nginx/sites-available/chatbot-backend /backup/nginx-$(date +%Y%m%d).conf
```

---

## Deployment Steps

### Step 1: Update Application Code

```bash
# Connect to production server
ssh user@production-server

# Navigate to application directory
cd /path/to/chatbot-backend

# Backup current version
git tag backup-$(date +%Y%m%d-%H%M%S)

# Pull latest code
git fetch origin
git checkout main
git pull origin main

# Install dependencies
npm ci --production

# Set up environment
cp /secure/location/.env.production .env
```

### Step 2: Configure Nginx for SSE

```bash
# Copy Nginx configuration
sudo cp docs/nginx-streaming.conf /etc/nginx/sites-available/chatbot-backend

# Update domain and paths in config
sudo nano /etc/nginx/sites-available/chatbot-backend

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

### Step 3: Set Up PM2 Ecosystem

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'chatbot-backend',
    script: './app.js',
    instances: 'max',  // Use all CPU cores
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production',
      // Load from .env file
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    // Graceful reload settings
    listen_timeout: 10000,
    kill_timeout: 5000,
    wait_ready: true
  }]
};
EOF
```

### Step 4: Zero-Downtime Deployment with PM2

```bash
# If first deployment
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # Follow instructions to enable auto-start

# For subsequent deployments (ZERO DOWNTIME)
pm2 reload ecosystem.config.js --env production

# Alternative: Graceful reload
pm2 gracefulReload chatbot-backend

# Monitor the reload process
pm2 logs chatbot-backend --lines 50
```

### Step 5: Verify Deployment

```bash
# Check PM2 status
pm2 status

# Monitor logs
pm2 logs chatbot-backend

# Test health endpoint
curl -s http://localhost:5000/api/metrics/health/streaming

# Test streaming endpoint
curl -N http://localhost:5000/api/chat/query/stream \
  -H "Content-Type: application/json" \
  -d '{"query":"Hello","chatbotId":"TEST_ID","sessionId":"test-uuid","enableTTS":false}'
```

---

## Post-Deployment Verification

### 1. Health Checks

```bash
# Check application health
curl -s https://your-domain.com/api/metrics/health/streaming | jq

# Expected: status = "healthy" or "degraded"
# Action if unhealthy: Check logs and rollback
```

### 2. Metrics Check

```bash
# Check streaming metrics
curl -s https://your-domain.com/api/metrics/streaming/summary | jq

# Monitor for:
# - Success rate > 95%
# - Avg latency < 1000ms
# - Error count = 0
```

### 3. Feature Flags Verification

```bash
# Check feature flags
curl -s https://your-domain.com/api/metrics/feature-flags | jq

# Start with low rollout percentage for safety
curl -X POST https://your-domain.com/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":1}'
```

### 4. End-to-End Testing

```bash
# Run production smoke tests
node scripts/testUserChatbotStreaming.js PROD_CHATBOT_ID "Test query"

# Verify:
# - Response received
# - Latency acceptable
# - No errors in logs
```

---

## Gradual Rollout Strategy

### Phase 1: Initial Testing (1% - Day 1)
```bash
# Set rollout to 1%
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":1}'

# Monitor for 2-4 hours
pm2 logs chatbot-backend | grep -i error
curl -s http://localhost:5000/api/metrics/streaming/summary

# Check metrics:
# - Error rate < 1%
# - Latency within targets
# - No critical errors
```

### Phase 2: Early Adopters (5% - Day 2 AM)
```bash
# Increase to 5%
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":5}'

# Monitor for 4-8 hours
```

### Phase 3: Expanded Testing (10% - Day 2 PM)
```bash
# Increase to 10%
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":10}'
```

### Phase 4: Broader Rollout (25% - Day 3 AM)
```bash
# Increase to 25%
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":25}'
```

### Phase 5: Majority (50% - Day 3 PM)
```bash
# Increase to 50%
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":50}'
```

### Phase 6-8: Full Rollout (Day 4-5)
```bash
# Day 4: 75%
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":75}'

# Day 5 AM: 90%
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":90}'

# Day 5 PM: 100% (Full rollout)
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":100}'
```

### Rollout Decision Criteria

**Proceed to next phase if:**
- ✅ Error rate < 1%
- ✅ Success rate > 95%
- ✅ Avg first token latency < 1000ms
- ✅ No critical errors in logs
- ✅ System resources within limits

**Rollback if:**
- ❌ Error rate > 2%
- ❌ Success rate < 90%
- ❌ Avg first token latency > 2000ms
- ❌ Critical errors detected
- ❌ System overload

---

## Rollback Procedures

### Emergency Rollback (Immediate)

```bash
# Option 1: Disable streaming via feature flag (FASTEST)
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":0}'

# Option 2: Rollback code to previous version
cd /path/to/chatbot-backend
git checkout backup-TIMESTAMP
npm ci --production
pm2 reload chatbot-backend

# Option 3: Restore from backup
tar -xzf /backup/chatbot-backend-YYYYMMDD.tar.gz
pm2 reload chatbot-backend
```

### Post-Rollback Actions

```bash
# 1. Verify system is stable
curl -s http://localhost:5000/api/metrics/health/streaming

# 2. Check metrics
curl -s http://localhost:5000/api/metrics/streaming/summary

# 3. Investigate root cause
pm2 logs chatbot-backend --err --lines 1000 > rollback-investigation.log

# 4. Document incident
# Create incident report with:
# - Timestamp
# - Error rate / metrics
# - Root cause
# - Actions taken
```

---

## Monitoring

### Real-Time Monitoring

```bash
# Monitor PM2 processes
pm2 monit

# Watch application logs
pm2 logs chatbot-backend --lines 50 --timestamp

# Watch Nginx access logs
sudo tail -f /var/log/nginx/chatbot-backend-access.log

# Watch Nginx error logs
sudo tail -f /var/log/nginx/chatbot-backend-error.log
```

### Metrics Dashboard

Access metrics endpoints:
- **Summary**: `https://your-domain.com/api/metrics/streaming/summary`
- **Detailed**: `https://your-domain.com/api/metrics/streaming`
- **Health**: `https://your-domain.com/api/metrics/health/streaming`
- **Feature Flags**: `https://your-domain.com/api/metrics/feature-flags`

### Alerts Setup

Set up monitoring alerts for:
- Error rate > 2%
- Latency > 1500ms (p95)
- Memory usage > 80%
- CPU usage > 90%
- Active streams > threshold

### Automated Health Checks

```bash
# Add to crontab for periodic health checks
*/5 * * * * curl -s http://localhost:5000/api/metrics/health/streaming | jq -r '.status' | grep -v healthy && echo "ALERT: Unhealthy status" | mail -s "Health Check Alert" admin@example.com
```

---

## Troubleshooting

### Common Issues

#### Streaming not working
```bash
# Check Nginx buffering
sudo nginx -T | grep proxy_buffering

# Should see: proxy_buffering off;

# Restart Nginx if needed
sudo systemctl restart nginx
```

#### High memory usage
```bash
# Check for memory leaks
pm2 list
pm2 reload chatbot-backend

# Adjust max memory restart
pm2 delete chatbot-backend
# Edit ecosystem.config.js: max_memory_restart: '1G'
pm2 start ecosystem.config.js
```

#### OpenAI rate limits
```bash
# Check error logs for rate limit messages
pm2 logs chatbot-backend | grep -i "rate limit"

# Adjust concurrent requests or add retry logic
```

---

## Maintenance

### Daily
- Check metrics dashboard
- Review error logs
- Monitor success rates

### Weekly
- Review performance trends
- Update dependencies (security patches)
- Backup database

### Monthly
- Review and optimize
- Update documentation
- Security audit

---

## Support Contacts

- **Technical Lead**: [email]
- **DevOps Team**: [email]
- **On-Call**: [phone/slack]

---

## References

- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Nginx SSE Configuration](https://nginx.org/en/docs/)
- [Feature Flags Guide](./PRODUCTION_ENV.md#feature-flags)
- [Monitoring Setup](./MONITORING.md)
