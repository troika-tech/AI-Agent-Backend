# Production Environment Variables

## Required Environment Variables for Streaming

### Core Application
```bash
# Node Environment
NODE_ENV=production

# Server Configuration
PORT=5000
HOST=0.0.0.0

# Application Name (for PM2)
APP_NAME=chatbot-backend
```

### Database
```bash
# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name?retryWrites=true&w=majority

# MongoDB Options
MONGODB_MAX_POOL_SIZE=50
MONGODB_MIN_POOL_SIZE=10
```

### Redis Cache
```bash
# Redis Configuration (CRITICAL for streaming caching)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password  # Optional
REDIS_DB=0

# Redis Cluster (if using)
# REDIS_CLUSTER=true
# REDIS_NODES=node1:6379,node2:6379,node3:6379
```

### OpenAI API
```bash
# OpenAI Configuration (CRITICAL for streaming)
OPENAI_API_KEY=sk-your-openai-api-key-here

# OpenAI Model Selection
OPENAI_MODEL=gpt-4o-mini  # or gpt-4, gpt-3.5-turbo
OPENAI_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=500  # Max tokens per response

# OpenAI Timeouts
CHAT_TIMEOUT_MS=20000  # 20 seconds
```

### Google Cloud TTS
```bash
# Google Cloud Configuration (CRITICAL for audio streaming)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# TTS Configuration
TTS_VOICE_LANGUAGE=en-IN
TTS_VOICE_NAME=en-IN-Neural2-D  # Chirp HD voice

# Alternative: Set credentials inline
# GOOGLE_CLOUD_PROJECT_ID=your-project-id
# GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
# GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

### Rate Limiting
```bash
# Rate Limiter Configuration
RATE_LIMIT_WINDOW_MS=60000  # 1 minute
RATE_LIMIT_MAX_REQUESTS=100  # per window

# Streaming-specific rate limits
STREAMING_RATE_LIMIT_MAX=30  # streams per minute per IP

# Speech-to-text rate limits
SPEECH_RATE_LIMIT_MAX=10  # per minute
```

### Logging
```bash
# Log Configuration
LOG_LEVEL=info  # production: info, debug: debug
LOG_DIR=./logs
LOG_MAX_SIZE=20m  # Max log file size
LOG_MAX_FILES=14d  # Keep logs for 14 days

# Structured Logging
LOG_FORMAT=json  # or 'simple'
```

### Security
```bash
# CORS Configuration
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Whitelisted IPs (comma-separated)
WHITELISTED_IPS=10.0.0.1,192.168.1.100

# Helmet Security
HELMET_ENABLED=true
```

### Performance & Optimization
```bash
# Vector Search Configuration
RETRIEVAL_TOP_K=16  # Number of KB chunks to retrieve
VECTOR_SEARCH_TIMEOUT=5000  # 5 seconds

# Cache TTLs
KB_CACHE_TTL=600  # 10 minutes (Phase 4 optimization)
TTS_CACHE_TTL=3600  # 1 hour (Phase 4 optimization)
LLM_CACHE_TTL=120  # 2 minutes

# Connection Pooling
HTTP_KEEP_ALIVE_TIMEOUT=65000  # 65 seconds
HTTP_HEADERS_TIMEOUT=66000  # 66 seconds
```

### Feature Flags
```bash
# Gradual Rollout Control (Phase 5)
STREAMING_ENABLED=true
STREAMING_ROLLOUT_PERCENTAGE=100  # 0-100, controls % of users getting streaming

# Feature-specific flags
TTS_ENABLED=true  # Enable/disable TTS globally
KB_SEARCH_ENABLED=true  # Enable/disable knowledge base
METRICS_ENABLED=true  # Enable/disable metrics collection

# A/B Testing
AB_TEST_STREAMING=false  # If true, 50% get streaming, 50% get REST
```

### Monitoring & Alerting
```bash
# Metrics Export
METRICS_ENABLED=true
METRICS_PORT=9090  # Prometheus metrics port (optional)

# Health Check
HEALTH_CHECK_ENABLED=true

# Alerting (if integrated)
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
# ALERT_EMAIL=alerts@your-company.com
# ERROR_THRESHOLD=5  # Alert if error rate > 5%
```

### Third-Party Integrations
```bash
# WhatsApp (if used)
WHATSAPP_API_KEY=your_whatsapp_api_key
WHATSAPP_PHONE_NUMBER=+1234567890

# Twilio (if used)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Payment Gateway (if used)
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

### Testing
```bash
# Test Environment (for staging)
TEST_ROUTES=  # Empty for all routes, or specific routes for testing
TEST_CHATBOT_ID=68ea0b4d28fb01da88e59697  # Default test chatbot
```

## Environment-Specific Files

### Development (.env.development)
```bash
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chatbot_dev
REDIS_HOST=localhost
LOG_LEVEL=debug
STREAMING_ROLLOUT_PERCENTAGE=100
```

### Staging (.env.staging)
```bash
NODE_ENV=staging
PORT=5000
MONGODB_URI=mongodb+srv://staging-cluster.mongodb.net/chatbot_staging
REDIS_HOST=staging-redis.example.com
LOG_LEVEL=info
STREAMING_ROLLOUT_PERCENTAGE=50  # Test with 50% rollout
```

### Production (.env.production)
```bash
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://prod-cluster.mongodb.net/chatbot_production
REDIS_HOST=prod-redis.example.com
LOG_LEVEL=info
STREAMING_ROLLOUT_PERCENTAGE=100  # Full rollout after testing
```

## Setting Up Environment Variables

### Option 1: .env File (Recommended for Development)
```bash
# Copy example file
cp .env.example .env

# Edit with your values
nano .env
```

### Option 2: PM2 Ecosystem File (Recommended for Production)
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'chatbot-backend',
    script: './app.js',
    instances: 4,  // CPU cores
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      // ... all other env vars
    }
  }]
};
```

### Option 3: System Environment Variables
```bash
# Add to /etc/environment or ~/.bashrc
export NODE_ENV=production
export PORT=5000
export MONGODB_URI="mongodb+srv://..."
```

### Option 4: Docker Environment
```yaml
# docker-compose.yml
services:
  chatbot-backend:
    env_file:
      - .env.production
    environment:
      - NODE_ENV=production
      - PORT=5000
```

## Security Best Practices

1. **Never commit .env files to git**
   ```bash
   # .gitignore
   .env
   .env.*
   !.env.example
   ```

2. **Use secrets management** (AWS Secrets Manager, Azure Key Vault, etc.)

3. **Rotate API keys** regularly

4. **Encrypt sensitive values** in transit and at rest

5. **Use different credentials** for each environment

## Validation

Check that all required variables are set:
```bash
# Run validation script
node scripts/validateEnv.js
```

## Troubleshooting

### Streaming not working
- ✅ Check `OPENAI_API_KEY` is valid
- ✅ Verify `REDIS_HOST` is accessible
- ✅ Ensure `STREAMING_ENABLED=true`
- ✅ Check Nginx buffering is disabled

### TTS not working
- ✅ Verify `GOOGLE_APPLICATION_CREDENTIALS` path exists
- ✅ Check service account has TTS API enabled
- ✅ Ensure `TTS_ENABLED=true`

### Cache not working
- ✅ Verify Redis connection: `redis-cli ping`
- ✅ Check `REDIS_HOST` and `REDIS_PORT`
- ✅ Verify Redis password if set

### Rate limiting issues
- ✅ Check if IP is in `WHITELISTED_IPS`
- ✅ Adjust rate limits if needed
- ✅ Consider using Redis-backed rate limiter for distributed setup

## References

- [Node.js Environment Variables Best Practices](https://nodejs.org/en/learn/command-line/how-to-read-environment-variables-from-nodejs)
- [PM2 Environment Variables](https://pm2.keymetrics.io/docs/usage/environment/)
- [Docker Environment Variables](https://docs.docker.com/compose/environment-variables/)
