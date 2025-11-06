// improved-tts-route.js
const express = require("express");
const { TextToSpeechClient } = require("@google-cloud/text-to-speech");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const { validateBody } = require("../utils/validationHelpers");
const { getClient: getRedisClient } = require("../lib/redis");
const logger = require("../utils/logger");
dotenv.config();

// Safely initialize TTS client with proper error handling
let ttsClient;
try {
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
    ttsClient = new TextToSpeechClient({ credentials });
    logger.info("Google Cloud TTS client initialized with credentials");
  } else {
    // Try without credentials (uses default auth)
    ttsClient = new TextToSpeechClient();
    logger.warn("Google Cloud TTS client initialized without explicit credentials");
  }
} catch (error) {
  logger.error(`Failed to initialize TTS client: ${error.message}`);
  // Initialize without credentials as fallback
  ttsClient = new TextToSpeechClient();
}

const ttsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: "Too many text-to-speech requests. Please try again later.",
  skip: (req) => req.method === 'OPTIONS', // Skip rate limiting for preflight requests
  trustProxy: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    // Custom error handler that returns proper JSON with CORS headers
    res.status(429).json({
      status: 429,
      error: "Too many text-to-speech requests. Please try again later.",
    });
  },
});

/* ---------------- Voice map (unchanged) ---------------- */
const femaleVoices = {
  "en-IN": "en-IN-Chirp3-HD-Leda",
  "en-US": "en-US-Chirp3-HD-Leda",
  "hi-IN": "hi-IN-Chirp3-HD-Leda",
  // ... other voices
};

/* ---------------- Utility helpers ---------------- */

function logPrefix(reqId, ip) {
  return `[TTS][${reqId}][${ip}]`;
}

function genReqId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function normalizeUnicodeSpaces(s) {
  if (!s || typeof s !== "string") return s || "";
  return s
    .replace(/\uFEFF/g, "")
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F]/g, " ")
    .replace(/\u200C|\u200D/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(text) {
  if (!text || typeof text !== "string") return text || "";
  return text.replace(/<\/?[^>]+(>|$)/g, " ");
}

// ===================================================================
// == NEW FUNCTION TO STRIP MARKDOWN (like **bold**, ##, etc.) ==
// ===================================================================
function stripMarkdown(text) {
    if (!text || typeof text !== "string") return text || "";
    // Remove markdown headers (##, ###, etc.)
    text = text.replace(/^#{1,6}\s+/gm, '');
    // Remove bold/italic markers (**, __, *, _, etc.)
    text = text.replace(/([_*~`]){1,3}/g, ' ');
    // Remove strikethrough
    text = text.replace(/~~(.*?)~~/g, '$1');
    // Remove inline code markers
    text = text.replace(/`([^`]+)`/g, '$1');
    // Clean up extra spaces
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}


function removeEmojis(text) {
  if (!text || typeof text !== "string") return text || "";
  // Remove emojis but preserve currency symbols (₹, $, €, £, ¥, etc.)
  return text.replace(
    /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu,
    ''
  ).replace(/\s+/g, ' ').trim();
}

// ===================================================================
// == UPDATED FUNCTION with more flexible regex (\s* instead of \s+) ==
// ===================================================================
function removeListMarkers(text) {
  if (!text || typeof text !== "string") return text || "";
  // Use \s* to match even if there's no space after the dot (e.g., "1.<b>Hi</b>")
  const pattern = /\b\d+\.\s*|^[-*•‣⁃·•]\s*/g;
  return text.replace(pattern, "").trim();
}


function fixAcronyms(text, acronyms = ["AI", "SEO"]) {
  if (!text || typeof text !== "string") return text;
  // Build a regex like: \b(?:AI|SEO)\b with case-insensitive flag
  const pattern = new RegExp("\\b(?:" + acronyms.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b", "gi");
  return text.replace(pattern, (match) => {
    // produce spaced uppercase letters: "Ai" or "ai" -> "A I"
    return match.toUpperCase().split("").join(" ");
  });
}

async function detectLanguage(text) {
  const { franc } = await import("franc-min");
  const langCode = franc(text);
  if (langCode === "und") return "en-IN";
  const map = { eng: "en-IN", hin: "hi-IN" /* ...other languages */ };
  return map[langCode] || "en-IN";
}

async function generateSpeech(text, languageCode = "en-IN") {
  const voiceName = femaleVoices[languageCode] || "en-IN-Neural2-A";
  const request = {
    input: { text },
    voice: { languageCode, name: voiceName },
    audioConfig: { audioEncoding: "MP3", speakingRate: 1 },
  };
  const [response] = await ttsClient.synthesizeSpeech(request);
  return { audioContent: response.audioContent, voiceName };
}

/* ---------------- Route with HEAVY DEBUG LOGGING ---------------- */

// Handle OPTIONS preflight requests
router.options("/", (req, res) => {
  res.status(200).end();
});

router.post("/", ttsLimiter, async (req, res) => {
  const reqId = genReqId();
  const ip = req.ip || (req.headers["x-forwarded-for"] || req.connection?.remoteAddress) || "unknown";
  const prefix = logPrefix(reqId, ip);

  if (!validateBody(req, res)) return;

  const { text } = req.body;
  if (!text) {
    console.log(`${prefix} bad request - no text provided`);
    return res.status(400).send("No text provided");
  }
  try {
    // ===================================================================
    // == DETAILED LOGGING PIPELINE ==
    // ===================================================================
    const VERBOSE = process.env.TTS_DEBUG === 'true';
    if (VERBOSE) {
      console.log(`\n\n${prefix} ----------------- NEW REQUEST -----------------`);
      console.log(`${prefix} [0] RAW INPUT:\n`, JSON.stringify(text));
    }

    // Step 1: Strip HTML tags
  let processedText = stripHtml(text);
  if (VERBOSE) console.log(`${prefix} [1] After stripHtml:\n`, JSON.stringify(processedText));

    // Step 2: Strip Markdown tags
  processedText = stripMarkdown(processedText);
  if (VERBOSE) console.log(`${prefix} [2] After stripMarkdown:\n`, JSON.stringify(processedText));
    
    // Step 3: Normalize all spaces
  processedText = normalizeUnicodeSpaces(processedText);
  if (VERBOSE) console.log(`${prefix} [3] After normalizeUnicodeSpaces:\n`, JSON.stringify(processedText));

    // Step 4: Remove Emojis
  processedText = removeEmojis(processedText);
  if (VERBOSE) console.log(`${prefix} [4] After removeEmojis:\n`, JSON.stringify(processedText));
    
    // Step 5: Remove list numbers and bullets
  processedText = removeListMarkers(processedText);
  if (VERBOSE) console.log(`${prefix} [5] After removeListMarkers:\n`, JSON.stringify(processedText));

    // Step 6: Fix Acronyms
  processedText = fixAcronyms(processedText, ["AI", "SEO"]);
  if (VERBOSE) console.log(`${prefix} [6] After fixAcronyms:\n`, JSON.stringify(processedText));

    // Final check for empty text
    if (!processedText || !processedText.trim()) {
      console.log(`${prefix} No text left after all processing.`);
      return res.status(400).send("No processable text content found");
    }

    if (VERBOSE) {
      console.log(`${prefix} [FINAL] Text sent to Google TTS:\n`, JSON.stringify(processedText));
      console.log(`${prefix} --------------------------------------------------`);
    }

    const detectedLanguage = await detectLanguage(processedText);
    const { audioContent, voiceName: usedVoice } = await generateSpeech(processedText, detectedLanguage);
    
    const base64Audio = audioContent.toString("base64");
    const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

    res.json({ reqId, processedText, audio: audioDataUrl });

  } catch (error) {
    console.error(`${prefix} TTS error:`, error.message || error);
    res.status(500).send("Text-to-Speech conversion failed");
  }
});

// Add simple polling endpoint to fetch completed TTS by job id
router.options("/:jobId", (req, res) => {
  res.status(200).end();
});

router.get("/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId) return res.status(400).json({ error: "Missing jobId" });
    const redis = getRedisClient && getRedisClient();
    if (!redis) return res.status(503).json({ error: "TTS cache unavailable" });
    const raw = await redis.get(`tts:job:${jobId}`);
    if (!raw) return res.status(202).json({ status: "pending" });
    const payload = JSON.parse(raw);
    return res.status(200).json({ status: "ready", ...payload });
  } catch (err) {
    console.error("TTS job fetch error:", err.message);
    return res.status(500).json({ error: "Failed to fetch TTS job" });
  }
});

module.exports = router;
