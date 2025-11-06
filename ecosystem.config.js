// PM2 Ecosystem Configuration for SSE Streaming
// Usage: pm2 start ecosystem.config.js
// Reload: pm2 reload ecosystem.config.js

module.exports = {
  apps: [{
    name: 'chatbot-backend',
    script: './app.js',

    // Instance Configuration
    instances: 1,  // For t3.micro: Use 1 instance only
    exec_mode: 'fork',  // Use 'cluster' only if you have 2+ vCPUs and proper session handling

    // Memory Management
    max_memory_restart: '500M',  // For t3.micro (adjust to 1500M for t3.small)

    // Node.js Configuration
    node_args: '--max-old-space-size=450',  // For t3.micro (adjust to 1400 for t3.small)

    // Environment Variables
    env: {
      NODE_ENV: 'production',
      PORT: 5000,

      // SSE Configuration
      MAX_CONCURRENT_STREAMS: 5,  // For t3.micro (20 for t3.small)
      ENABLE_TTS_DEFAULT: true,

      // Timeouts (important for SSE)
      CHAT_TIMEOUT_MS: 20000,

      // Rate Limiting
      RATE_LIMIT_MAX: 10,
      RATE_LIMIT_WINDOW_MS: 60000,
    },

    // Logging
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Process Behavior
    autorestart: true,
    watch: false,  // Don't use watch in production
    max_restarts: 10,
    min_uptime: '10s',

    // Graceful Shutdown (CRITICAL for SSE)
    kill_timeout: 5000,  // Wait 5 seconds before force kill
    listen_timeout: 3000,
    shutdown_with_message: true,

    // Graceful Reload (allows existing connections to finish)
    wait_ready: true,

    // Custom restart settings for SSE
    instance_var: 'INSTANCE_ID',

    // Source map support (helpful for debugging)
    source_map_support: true,
  }]
};
