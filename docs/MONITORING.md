# Monitoring & Alerting Guide

Complete guide for monitoring the streaming chatbot backend in production.

## Table of Contents
- [Metrics Overview](#metrics-overview)
- [Monitoring Endpoints](#monitoring-endpoints)
- [Alert Configuration](#alert-configuration)
- [Dashboard Setup](#dashboard-setup)
- [Log Management](#log-management)
- [Performance Baselines](#performance-baselines)
- [Incident Response](#incident-response)

---

## Metrics Overview

### Key Performance Indicators (KPIs)

#### Latency Metrics
- **First Token Latency**: Time from request to first response token
  - Target: ≤ 500ms (p95)
  - Warning: > 1000ms
  - Critical: > 2000ms

- **First Audio Latency**: Time from request to first audio chunk
  - Target: ≤ 1500ms (p95)
  - Warning: > 2000ms
  - Critical: > 3000ms

- **Complete Response Latency**: Total time for full response
  - Target: ≤ 3000ms (p95)
  - Warning: > 5000ms
  - Critical: > 8000ms

#### Availability Metrics
- **Success Rate**: Percentage of successful streaming requests
  - Target: ≥ 99%
  - Warning: < 98%
  - Critical: < 95%

- **Error Rate**: Percentage of failed requests
  - Target: ≤ 1%
  - Warning: > 2%
  - Critical: > 5%

#### Cache Performance
- **KB Cache Hit Rate**: Knowledge base context cache efficiency
  - Target: ≥ 60%
  - Warning: < 40%
  - Critical: < 20%

- **TTS Cache Hit Rate**: Text-to-speech audio cache efficiency
  - Target: ≥ 50%
  - Warning: < 30%
  - Critical: < 10%

#### System Health
- **Active Streams**: Number of concurrent streaming connections
  - Target: < 100
  - Warning: > 200
  - Critical: > 500

- **Memory Usage**: Application memory consumption
  - Target: < 70% of allocated
  - Warning: > 80%
  - Critical: > 90%

- **CPU Usage**: Processor utilization
  - Target: < 70%
  - Warning: > 80%
  - Critical: > 90%

---

## Monitoring Endpoints

### Health Check Endpoint

```bash
GET /api/metrics/health/streaming
```

**Purpose**: Primary endpoint for monitoring system health

**Response Format**:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-10-11T10:30:00.000Z",
  "checks": {
    "errorRate": {
      "status": "pass",
      "value": "0.5%",
      "threshold": "≤5%"
    },
    "latency": {
      "status": "pass",
      "value": "450ms",
      "threshold": "≤1000ms"
    },
    "redis": {
      "status": "pass",
      "value": "connected"
    },
    "activeStreams": {
      "status": "pass",
      "value": 12
    }
  },
  "issues": []
}
```

**Status Values**:
- `healthy`: All systems operational
- `degraded`: Non-critical issues detected
- `unhealthy`: Critical issues requiring attention

**Usage**:
```bash
# Check health status
curl -s https://your-domain.com/api/metrics/health/streaming | jq

# Extract status only
curl -s https://your-domain.com/api/metrics/health/streaming | jq -r '.status'

# Alert if not healthy
STATUS=$(curl -s http://localhost:5000/api/metrics/health/streaming | jq -r '.status')
if [ "$STATUS" != "healthy" ]; then
  echo "ALERT: System status is $STATUS" | mail -s "Health Alert" admin@example.com
fi
```

### Metrics Summary Endpoint

```bash
GET /api/metrics/streaming/summary
```

**Purpose**: Quick overview for dashboards

**Response Format**:
```json
{
  "success": true,
  "timestamp": "2025-10-11T10:30:00.000Z",
  "summary": {
    "uptime": "5d 12h 30m",
    "totalRequests": 15234,
    "successRate": "99.2%",
    "activeStreams": 12,
    "avgFirstTokenLatency": 485,
    "avgCompleteLatency": 2834,
    "cacheHitRate": {
      "kb": "65.4%",
      "tts": "58.2%"
    },
    "errorCount": 42
  }
}
```

### Detailed Metrics Endpoint

```bash
GET /api/metrics/streaming
```

**Purpose**: Comprehensive metrics with percentiles and breakdowns

**Response Format**:
```json
{
  "success": true,
  "timestamp": "2025-10-11T10:30:00.000Z",
  "metrics": {
    "uptime": 475800,
    "uptimeFormatted": "5d 12h 30m",
    "requests": {
      "total": 15234,
      "successful": 15192,
      "failed": 42,
      "active": 12,
      "successRate": "99.72%"
    },
    "latency": {
      "firstToken": {
        "avg": 485,
        "p50": 420,
        "p95": 680,
        "p99": 920
      },
      "firstAudio": {
        "avg": 1245,
        "p50": 1180,
        "p95": 1520,
        "p99": 1890
      },
      "complete": {
        "avg": 2834,
        "p50": 2650,
        "p95": 3420,
        "p99": 4580
      }
    },
    "cache": {
      "kb": {
        "hits": 9876,
        "misses": 5234,
        "hitRate": "65.4%"
      },
      "tts": {
        "hits": 7845,
        "misses": 5623,
        "hitRate": "58.2%"
      }
    },
    "errors": {
      "openai": 12,
      "tts": 8,
      "network": 5,
      "validation": 15,
      "other": 2,
      "breakdown": {
        "openai": "28.6%",
        "tts": "19.0%",
        "network": "11.9%",
        "validation": "35.7%",
        "other": "4.8%"
      }
    },
    "streaming": {
      "totalStreams": 15234,
      "activeCount": 12,
      "completedCount": 15192,
      "errorCount": 42
    }
  }
}
```

### Recent Events Endpoint

```bash
GET /api/metrics/streaming/events?limit=50
```

**Purpose**: Audit trail of recent streaming events

**Response Format**:
```json
{
  "success": true,
  "timestamp": "2025-10-11T10:30:00.000Z",
  "events": [
    {
      "timestamp": "2025-10-11T10:29:45.123Z",
      "type": "stream_complete",
      "clientId": "chat-1760185530974-abc123",
      "chatbotId": "60f7b3b3e6b6f40015e6b6f4",
      "metrics": {
        "firstTokenLatency": 420,
        "duration": 2650,
        "wordCount": 145
      }
    }
  ],
  "count": 50
}
```

### Feature Flags Endpoint

```bash
GET /api/metrics/feature-flags
```

**Purpose**: Current feature flag configuration for rollout monitoring

---

## Alert Configuration

### Automated Health Checks

#### Cron-Based Health Check (Basic)

```bash
# Add to crontab: */5 * * * * (every 5 minutes)
*/5 * * * * /usr/local/bin/health-check.sh

# /usr/local/bin/health-check.sh
#!/bin/bash
ENDPOINT="http://localhost:5000/api/metrics/health/streaming"
STATUS=$(curl -s -m 10 "$ENDPOINT" | jq -r '.status')

if [ "$STATUS" != "healthy" ]; then
  MESSAGE="ALERT: Streaming service status is $STATUS at $(date)"
  echo "$MESSAGE" | mail -s "Streaming Health Alert" admin@example.com

  # Also send to Slack (optional)
  curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
    -H 'Content-Type: application/json' \
    -d "{\"text\":\"$MESSAGE\"}"
fi
```

#### Systemd Timer (Advanced)

```bash
# /etc/systemd/system/chatbot-health-check.service
[Unit]
Description=Chatbot Streaming Health Check
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/health-check.sh
User=chatbot
Group=chatbot

# /etc/systemd/system/chatbot-health-check.timer
[Unit]
Description=Run chatbot health check every 5 minutes
Requires=chatbot-health-check.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target

# Enable and start
sudo systemctl enable chatbot-health-check.timer
sudo systemctl start chatbot-health-check.timer
```

### Alert Rules

#### Error Rate Alert

**Trigger**: Error rate > 2% over 5-minute window

```bash
#!/bin/bash
# /usr/local/bin/check-error-rate.sh
METRICS=$(curl -s http://localhost:5000/api/metrics/streaming/summary)
ERROR_COUNT=$(echo "$METRICS" | jq -r '.summary.errorCount')
TOTAL_REQUESTS=$(echo "$METRICS" | jq -r '.summary.totalRequests')

if [ "$TOTAL_REQUESTS" -gt 0 ]; then
  ERROR_RATE=$(echo "scale=2; ($ERROR_COUNT / $TOTAL_REQUESTS) * 100" | bc)

  if (( $(echo "$ERROR_RATE > 2.0" | bc -l) )); then
    echo "CRITICAL: Error rate is ${ERROR_RATE}% (threshold: 2%)" \
      | mail -s "High Error Rate Alert" admin@example.com
  fi
fi
```

#### Latency Alert

**Trigger**: P95 latency > 1000ms

```bash
#!/bin/bash
# /usr/local/bin/check-latency.sh
P95_LATENCY=$(curl -s http://localhost:5000/api/metrics/streaming | jq -r '.metrics.latency.firstToken.p95')

if [ "$P95_LATENCY" -gt 1000 ]; then
  echo "WARNING: P95 first token latency is ${P95_LATENCY}ms (threshold: 1000ms)" \
    | mail -s "High Latency Alert" admin@example.com
fi
```

#### Cache Hit Rate Alert

**Trigger**: KB cache hit rate < 40%

```bash
#!/bin/bash
# /usr/local/bin/check-cache.sh
METRICS=$(curl -s http://localhost:5000/api/metrics/streaming)
KB_HIT_RATE=$(echo "$METRICS" | jq -r '.metrics.cache.kb.hitRate' | sed 's/%//')

if (( $(echo "$KB_HIT_RATE < 40.0" | bc -l) )); then
  echo "WARNING: KB cache hit rate is ${KB_HIT_RATE}% (threshold: 40%)" \
    | mail -s "Low Cache Hit Rate Alert" admin@example.com
fi
```

#### Active Streams Alert

**Trigger**: Active streams > 200

```bash
#!/bin/bash
# /usr/local/bin/check-active-streams.sh
ACTIVE=$(curl -s http://localhost:5000/api/metrics/streaming/summary | jq -r '.summary.activeStreams')

if [ "$ACTIVE" -gt 200 ]; then
  echo "WARNING: $ACTIVE active streams (threshold: 200)" \
    | mail -s "High Active Streams Alert" admin@example.com
fi
```

### PM2 Monitoring

#### PM2 Built-in Monitoring

```bash
# Real-time monitoring
pm2 monit

# Get JSON metrics
pm2 jlist

# Get process info
pm2 info chatbot-backend
```

#### PM2 Actions on Events

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'chatbot-backend',
    script: './app.js',
    // ... other config ...

    // Alert on high memory
    max_memory_restart: '1G',

    // Alert on restarts
    min_uptime: '10s',
    max_restarts: 10,
    autorestart: true,

    // Custom PM2 actions
    listen_timeout: 10000,
    kill_timeout: 5000
  }]
};
```

---

## Dashboard Setup

### Grafana Dashboard (Recommended)

#### Data Source: Prometheus

**Install Prometheus Node Exporter**:
```bash
# Install node_exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.6.1/node_exporter-1.6.1.linux-amd64.tar.gz
tar xvfz node_exporter-*.tar.gz
sudo cp node_exporter-*/node_exporter /usr/local/bin/
sudo useradd -rs /bin/false node_exporter

# Create systemd service
sudo nano /etc/systemd/system/node_exporter.service
```

**Create Metrics Exporter for App**:
```javascript
// scripts/metricsExporter.js
const express = require('express');
const metricsService = require('../services/metricsService');

const app = express();

app.get('/metrics', (req, res) => {
  const metrics = metricsService.getMetrics();

  // Convert to Prometheus format
  let prometheusMetrics = '';
  prometheusMetrics += `# HELP chatbot_requests_total Total number of requests\n`;
  prometheusMetrics += `# TYPE chatbot_requests_total counter\n`;
  prometheusMetrics += `chatbot_requests_total ${metrics.requests.total}\n\n`;

  prometheusMetrics += `# HELP chatbot_requests_success Successful requests\n`;
  prometheusMetrics += `# TYPE chatbot_requests_success counter\n`;
  prometheusMetrics += `chatbot_requests_success ${metrics.requests.successful}\n\n`;

  prometheusMetrics += `# HELP chatbot_latency_first_token_ms First token latency (ms)\n`;
  prometheusMetrics += `# TYPE chatbot_latency_first_token_ms gauge\n`;
  prometheusMetrics += `chatbot_latency_first_token_ms{quantile="0.5"} ${metrics.latency.firstToken.p50}\n`;
  prometheusMetrics += `chatbot_latency_first_token_ms{quantile="0.95"} ${metrics.latency.firstToken.p95}\n`;
  prometheusMetrics += `chatbot_latency_first_token_ms{quantile="0.99"} ${metrics.latency.firstToken.p99}\n\n`;

  // ... add more metrics ...

  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
});

app.listen(9090, () => console.log('Metrics exporter running on :9090'));
```

#### Grafana Panels

1. **Success Rate (Single Stat)**
   - Query: `(rate(chatbot_requests_success[5m]) / rate(chatbot_requests_total[5m])) * 100`
   - Threshold: Red < 95%, Yellow < 98%, Green ≥ 98%

2. **Latency (Graph)**
   - Query P50: `chatbot_latency_first_token_ms{quantile="0.5"}`
   - Query P95: `chatbot_latency_first_token_ms{quantile="0.95"}`
   - Query P99: `chatbot_latency_first_token_ms{quantile="0.99"}`

3. **Active Streams (Graph)**
   - Query: `chatbot_active_streams`

4. **Cache Hit Rates (Bar Gauge)**
   - Query KB: `(chatbot_cache_kb_hits / (chatbot_cache_kb_hits + chatbot_cache_kb_misses)) * 100`
   - Query TTS: `(chatbot_cache_tts_hits / (chatbot_cache_tts_hits + chatbot_cache_tts_misses)) * 100`

5. **Error Breakdown (Pie Chart)**
   - Query: `chatbot_errors_by_type`

### Simple HTML Dashboard

```html
<!-- public/dashboard.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Streaming Metrics Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: Arial; margin: 20px; }
    .metric { display: inline-block; margin: 10px; padding: 15px; border: 1px solid #ccc; border-radius: 5px; }
    .metric.healthy { border-color: #4caf50; }
    .metric.warning { border-color: #ff9800; }
    .metric.critical { border-color: #f44336; }
    .metric-value { font-size: 2em; font-weight: bold; }
    .metric-label { font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <h1>Streaming Chatbot Metrics</h1>
  <div id="metrics"></div>
  <canvas id="latencyChart" width="800" height="400"></canvas>

  <script>
    async function fetchMetrics() {
      const res = await fetch('/api/metrics/streaming/summary');
      const data = await res.json();
      return data.summary;
    }

    async function updateDashboard() {
      const metrics = await fetchMetrics();

      // Render metrics
      document.getElementById('metrics').innerHTML = `
        <div class="metric ${metrics.successRate >= 98 ? 'healthy' : 'warning'}">
          <div class="metric-value">${metrics.successRate}</div>
          <div class="metric-label">Success Rate</div>
        </div>
        <div class="metric ${metrics.avgFirstTokenLatency <= 1000 ? 'healthy' : 'warning'}">
          <div class="metric-value">${metrics.avgFirstTokenLatency}ms</div>
          <div class="metric-label">Avg First Token</div>
        </div>
        <div class="metric healthy">
          <div class="metric-value">${metrics.activeStreams}</div>
          <div class="metric-label">Active Streams</div>
        </div>
      `;
    }

    // Update every 5 seconds
    setInterval(updateDashboard, 5000);
    updateDashboard();
  </script>
</body>
</html>
```

---

## Log Management

### Log Levels

```javascript
// utils/logger.js configuration
const logLevels = {
  error: 0,   // Critical errors requiring immediate attention
  warn: 1,    // Warning conditions (degraded performance, rate limits)
  info: 2,    // Normal operational messages
  debug: 3    // Detailed debugging information (dev/staging only)
};
```

### Log Aggregation

#### PM2 Logs

```bash
# View logs
pm2 logs chatbot-backend

# Save logs to file
pm2 logs chatbot-backend --out /var/log/chatbot/app.log --err /var/log/chatbot/error.log

# Log rotation (ecosystem.config.js)
module.exports = {
  apps: [{
    name: 'chatbot-backend',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

#### Nginx Logs

```nginx
# /etc/nginx/sites-available/chatbot-backend
access_log /var/log/nginx/chatbot-backend-access.log;
error_log /var/log/nginx/chatbot-backend-error.log warn;

# Custom log format with timing
log_format streaming '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

access_log /var/log/nginx/chatbot-backend-access.log streaming;
```

#### Log Rotation

```bash
# /etc/logrotate.d/chatbot-backend
/var/log/chatbot/*.log {
  daily
  rotate 14
  compress
  delaycompress
  notifempty
  missingok
  create 0640 chatbot chatbot
  sharedscripts
  postrotate
    pm2 reloadLogs
  endscript
}
```

### Log Analysis

#### Search for Errors

```bash
# Recent errors
pm2 logs chatbot-backend --err --lines 100

# Errors with specific pattern
pm2 logs chatbot-backend --err | grep -i "openai"

# Count error types
pm2 logs chatbot-backend --err --lines 1000 | grep -oP '\[.*?\]' | sort | uniq -c | sort -rn
```

#### Performance Analysis

```bash
# Extract latency metrics from logs
grep "Stream complete" /var/log/chatbot/app.log | \
  jq -r '.firstTokenLatency' | \
  awk '{sum+=$1; count++} END {print "Avg:", sum/count}'

# Find slow requests (> 2000ms)
grep "Stream complete" /var/log/chatbot/app.log | \
  jq 'select(.firstTokenLatency > 2000)'
```

---

## Performance Baselines

### Expected Performance

Based on load testing and initial deployment:

| Metric | p50 | p95 | p99 | Target |
|--------|-----|-----|-----|--------|
| First Token Latency | 400-500ms | 600-800ms | 800-1000ms | < 1000ms (p95) |
| First Audio Latency | 1100-1300ms | 1400-1600ms | 1700-2000ms | < 2000ms (p95) |
| Complete Response | 2500-3000ms | 3500-4000ms | 4500-5000ms | < 5000ms (p95) |

### Cache Performance Baselines

| Cache Type | Expected Hit Rate | Warning Threshold |
|------------|-------------------|-------------------|
| KB Context | 60-70% | < 40% |
| TTS Audio | 50-60% | < 30% |

### System Resource Baselines

| Resource | Normal | Warning | Critical |
|----------|--------|---------|----------|
| Memory | 40-60% | > 80% | > 90% |
| CPU | 30-50% | > 80% | > 90% |
| Active Streams | 10-50 | > 200 | > 500 |

---

## Incident Response

### Incident Severity Levels

#### P1 - Critical (Immediate Response)
- Service completely down
- Error rate > 10%
- All requests failing
- Security breach

**Response Time**: < 15 minutes
**Action**: Page on-call engineer immediately

#### P2 - High (Urgent)
- Error rate > 5%
- Latency > 2x baseline
- Cache completely unavailable
- Significant degradation

**Response Time**: < 1 hour
**Action**: Notify on-call team via Slack

#### P3 - Medium (Important)
- Error rate > 2%
- Latency > 1.5x baseline
- Cache hit rate < 30%
- Elevated resource usage

**Response Time**: < 4 hours
**Action**: Log ticket, investigate during business hours

#### P4 - Low (Monitoring)
- Minor performance degradation
- Informational alerts
- Capacity planning concerns

**Response Time**: < 24 hours
**Action**: Monitor, investigate when convenient

### Incident Response Playbook

#### Step 1: Assess Severity

```bash
# Quick health check
curl -s http://localhost:5000/api/metrics/health/streaming | jq

# Check error rate
curl -s http://localhost:5000/api/metrics/streaming/summary | jq '.summary | {successRate, errorCount, activeStreams}'

# Check PM2 status
pm2 status chatbot-backend
```

#### Step 2: Immediate Mitigation

**If error rate is high:**
```bash
# Option 1: Disable streaming via feature flag (fastest)
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":0}'

# Option 2: Restart application
pm2 reload chatbot-backend

# Option 3: Scale up instances
pm2 scale chatbot-backend +2
```

**If latency is high:**
```bash
# Check system resources
pm2 monit

# Check for memory leaks
pm2 list

# Force garbage collection (if enabled)
pm2 reload chatbot-backend
```

**If cache is unavailable:**
```bash
# Check Redis connection
redis-cli ping

# Restart Redis if needed
sudo systemctl restart redis
```

#### Step 3: Investigate Root Cause

```bash
# Check recent error logs
pm2 logs chatbot-backend --err --lines 200

# Check Nginx errors
sudo tail -100 /var/log/nginx/chatbot-backend-error.log

# Check system logs
sudo journalctl -u chatbot-backend -n 200

# Check recent events
curl -s http://localhost:5000/api/metrics/streaming/events?limit=100 | jq '.events[] | select(.type == "error")'
```

#### Step 4: Document Incident

Create incident report with:
- **Start Time**: When issue detected
- **End Time**: When resolved
- **Severity**: P1/P2/P3/P4
- **Impact**: Affected users, error rate, duration
- **Root Cause**: What caused the issue
- **Resolution**: How it was fixed
- **Prevention**: Steps to prevent recurrence

#### Step 5: Post-Incident Review

- Review metrics during incident
- Identify improvement opportunities
- Update runbooks if needed
- Implement preventive measures

---

## Quick Reference

### Health Check Commands

```bash
# Overall health
curl -s http://localhost:5000/api/metrics/health/streaming | jq -r '.status'

# Detailed metrics
curl -s http://localhost:5000/api/metrics/streaming | jq

# Summary only
curl -s http://localhost:5000/api/metrics/streaming/summary | jq '.summary'
```

### PM2 Commands

```bash
# Status
pm2 status

# Logs (live)
pm2 logs chatbot-backend

# Errors only
pm2 logs chatbot-backend --err

# Reload (zero downtime)
pm2 reload chatbot-backend

# Restart
pm2 restart chatbot-backend

# Scale
pm2 scale chatbot-backend 4
```

### Feature Flag Commands

```bash
# Check current rollout
curl -s http://localhost:5000/api/metrics/feature-flags | jq

# Set rollout percentage
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":50}'

# Disable streaming (emergency)
curl -X POST http://localhost:5000/api/metrics/feature-flags/rollout \
  -H "Content-Type: application/json" \
  -d '{"feature":"streaming","percentage":0}'
```

### Emergency Contacts

- **On-Call Engineer**: [Phone/Slack]
- **DevOps Team**: [Slack Channel]
- **Technical Lead**: [Email/Phone]

---

## References

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Deployment procedures
- [PRODUCTION_ENV.md](./PRODUCTION_ENV.md) - Environment variables
- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
