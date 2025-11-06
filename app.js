const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const logger = require("./utils/logger");

const { globalErrorHandler } = require("./middleware/errorHandler");
const dynamicCors = require("./middleware/dynamicCors");
const timeMiddleware = require("./middleware/timeMiddleware");

dotenv.config();

const app = express();

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Static assets for chatbot loader
const staticPath = path.join(__dirname, "public/chatbot-loader");
app.use("/chatbot-loader", express.static(staticPath));

// Trust proxy for correct IP in rate limiting
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(cors(dynamicCors));

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// --- Rate Limit Whitelist Setup ---
const WHITELISTED_IPS = (process.env.RATE_LIMIT_IP_WHITELIST || "103.232.246.21")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);

function normalizeIp(ip) {
  if (!ip) return "";
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function getClientIp(req) {
  let ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  if (Array.isArray(ip)) ip = ip[0];
  ip = ip.split(',')[0].trim();
  return normalizeIp(ip);
}

function isWhitelisted(req) {
  // In test mode, only honor explicit X-Forwarded-For to make tests deterministic
  if (process.env.NODE_ENV === "test") {
    const xff = req.headers["x-forwarded-for"] || "";
    const first = Array.isArray(xff) ? xff[0] : String(xff);
    const ip = normalizeIp(first.split(",")[0]?.trim());
    if (!ip) return false; // no explicit header -> do not skip limiting
    return WHITELISTED_IPS.includes(ip);
  }

  const ip = normalizeIp(req.ip || "");
  return WHITELISTED_IPS.includes(ip);
}

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  // Use a lower threshold in tests to ensure deterministic behavior
  max: process.env.NODE_ENV === "test" ? 5 : 100,
  message: {
    status: 429,
    error:
      "Whoa! You're chatting a bit too fast. Please wait and try again in a few minutes. ⏳",
  },
  trustProxy: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => req.method === 'OPTIONS' || isWhitelisted(req),
  keyGenerator: (req) => getClientIp(req),
});

const speechLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: {
    status: 429,
    error:
      "Speech processing limit reached. Please wait a minute before trying again. 🎤",
  },
  trustProxy: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => req.method === 'OPTIONS' || isWhitelisted(req),
  keyGenerator: (req) => getClientIp(req),
});

// Streaming endpoint rate limiter (edge case: prevent abuse)
// Allow fewer concurrent streams per client to prevent resource exhaustion
const streamingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: process.env.NODE_ENV === "test" ? 10 : 30, // 30 streams per minute per IP
  message: {
    status: 429,
    error: "Streaming rate limit exceeded. Please wait before starting a new stream.",
  },
  trustProxy: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => req.method === 'OPTIONS' || isWhitelisted(req),
  keyGenerator: (req) => getClientIp(req),
});

// Apply limiters
app.use("/api", limiter);
app.use("/api/speech-to-text", speechLimiter);
app.use("/api/chat/query/stream", streamingLimiter);
app.use("/api/troika/intelligent-chat/stream", streamingLimiter);
app.use("/api/products/search/stream", streamingLimiter);
app.use("/aza/search/stream", streamingLimiter);
app.use("/api/context/upload-file/stream", streamingLimiter);

// Time middleware to measure request duration
app.use(timeMiddleware);

// Route map to allow selective enabling during tests
const ROUTE_MAP = {
  "/api/chat": () => require("./routes/chatRoutes"),
  "/api/context": () => require("./routes/contextRoutes"),
  "/api/chatbot": () => require("./routes/chatbotRoutes"),
  "/api/admin": () => require("./routes/adminRoutes"),
  "/api/user": () => require("./routes/userRoutes"),
  "/api/company": () => require("./routes/companyRoutes"),
  "/api/report": () => require("./routes/reportRoutes"),
  "/api/otp": () => require("./routes/otpRoutes"),
  "/api/plans": () => require("./routes/planRoutes"),
  "/api": () => require("./routes/whisper"),
  "/api/suggestions": () => require("./routes/suggestionRoutes"),
  "/api/subscriptions": () => require("./routes/subscriptionRoutes"),
  // TEMPORARILY DISABLED: TTS Service
  // "/api/text-to-speech": () => require("./routes/text-to-speech"),
  "/api/customizations": () => require("./routes/customizations"),
  "/api/products": () => require("./routes/azaRoutes"),
  "/aza": () => require("./routes/azaSearchRoute"),
  "/api/auth": () => require("./routes/authRoutes"),
  "/api/whatsapp-otp": () => require("./routes/whatsAppOtp"),
  "/api/whatsapp-appointment": () => require("./routes/whatsAppAppointment"),
  "/api/booking": () => require("./routes/bookingRoutes"),
  "/api/troika": () => require("./routes/troikaIntelligentChatRoutes"),
  "/api/metrics": () => require("./routes/metricsRoutes"),
  "/prometheus": () => require("./routes/prometheusMetrics"),
  "/api/interactive": () => require("./routes/interactiveRoutes"),
  "/api/conversation-transcript": () => require("./routes/conversationTranscriptRoutes"),
  "/api/proposal": () => require("./routes/proposalRoutes"),
  // WhatsApp Chatbot Webhook - Commented out (no longer offering WhatsApp chatbot)
  // "/webhook": () => require("./routes/whatsappWebhookRoutes"),
};

function mountRoutesAll() {
  for (const [prefix, loader] of Object.entries(ROUTE_MAP)) {
    try {
      const router = loader();
      app.use(prefix, router);
    } catch (err) {
      logger.warn(`Skipping route ${prefix} due to load error: ${err.message}`);
    }
  }
}

function mountRoutesSelective(allowList) {
  for (const prefix of allowList) {
    const loader = ROUTE_MAP[prefix];
    if (!loader) {
      logger.warn(`TEST_ROUTES includes unknown prefix: ${prefix}`);
      continue;
    }
    try {
      const router = loader();
      app.use(prefix, router);
    } catch (err) {
      logger.warn(`Failed to load test route ${prefix}: ${err.message}`);
    }
  }
}

const isTest = process.env.NODE_ENV === "test";
if (isTest) {
  const allowList = (process.env.TEST_ROUTES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowList.length > 0) {
    mountRoutesSelective(allowList);
  }
} else {
  mountRoutesAll();
}

// Health route for tests and uptime checks

const { getClient } = require("./lib/redis");
const mongoose = require("mongoose");

app.get("/health", async (req, res) => {
  let redisOk = false;
  let mongoOk = false;
  try {
    const redis = getClient();
    if (redis) {
      const pong = await redis.ping();
      redisOk = pong === "PONG";
    } else {
      // If Redis is not configured, treat as healthy
      redisOk = true;
    }
  } catch (err) {
    redisOk = false;
  }
  try {
    mongoOk = mongoose.connection.readyState === 1;
  } catch (err) {
    mongoOk = false;
  }
  if (redisOk && mongoOk) {
    res.status(200).json({ status: "ok" });
  } else {
    res.status(503).json({ status: "unhealthy", redis: redisOk, mongo: mongoOk });
  }
});

// 404 handler for API routes
app.use((req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// Global error handler (last)
app.use((err, req, res, next) => {
  logger.error(err);
  res.status(500).json({ status: 'error', message: 'Internal Server Error' });
});

module.exports = app;
