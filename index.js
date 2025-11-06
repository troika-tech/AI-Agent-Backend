const dotenv = require("dotenv");
const logger = require("./utils/logger");
const connectDB = require("./db");
const app = require("./app");
const { init: initRedis } = require("./lib/redis");
const { getScheduler } = require("./services/schedulerService");
const { getModelInfo } = require("./services/llmAdapter");

dotenv.config();

// Global process-level error logging
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception thrown:", err);
  process.exit(1);
});

// Connect DB and start server
connectDB();
logger.info("Chatbot backend server is starting...");

// Initialize Redis early so caches are active
initRedis().catch(() => {});

// Initialize scheduler for intelligent agent scraping
const scheduler = getScheduler();
scheduler.startAll();

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  logger.info(`Intelligent Sales Agent scheduler initialized`);

  // Log current LLM model configuration
  const modelInfo = getModelInfo();
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`🤖 LLM Configuration:`);
  logger.info(`   Provider: ${modelInfo.provider.toUpperCase()}`);
  logger.info(`   Model: ${modelInfo.model}`);
  logger.info(`   Available Models:`);
  logger.info(`      - OpenAI: ${modelInfo.available.openai}`);
  logger.info(`      - Anthropic: ${modelInfo.available.anthropic}`);
  logger.info(`      - Grok: ${modelInfo.available.grok}`);
  logger.info(`   Context-Aware: ${process.env.ENABLE_CONTEXT_AWARE_PROMPTS === 'true' ? 'ENABLED ✓' : 'DISABLED'}`);
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
});

// CRITICAL: Configure timeouts for SSE (Server-Sent Events)
// Default Node.js timeout is 2 minutes - too short for streaming!
server.setTimeout(300000);        // 5 minutes (300,000 ms)
server.keepAliveTimeout = 305000; // Slightly longer than setTimeout
server.headersTimeout = 310000;   // Slightly longer than keepAliveTimeout

logger.info('Server timeouts configured for SSE: 5 minutes');
