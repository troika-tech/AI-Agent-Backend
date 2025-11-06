const express = require("express");
const router = express.Router();
const { answerQuery, streamQuery } = require("../controllers/chat/messageController");
const { validate } = require("../middleware/validation");
const { chat } = require("../schemas/chat");

// REST endpoint (existing)
router.post("/query", validate(chat.body ? { body: chat.body } : chat), answerQuery);

/**
 * POST /api/chat/query/stream
 * Streaming version of chat query endpoint (SSE)
 * Returns Server-Sent Events with text tokens and optional audio chunks
 *
 * TEMPORARILY DISABLED: TTS audio streaming is currently disabled
 *
 * Request body:
 * {
 *   query: string (required) - User's question
 *   chatbotId: string (required) - Chatbot ID
 *   sessionId: string (optional) - Session ID for conversation context
 *   email: string (optional) - User email
 *   phone: string (optional) - User phone
 *   language: string (optional, default: 'en-IN') - Language code for TTS
 *   enableTTS: boolean (optional, default: false) - Enable audio streaming [TEMPORARILY DISABLED]
 * }
 *
 * SSE Events:
 * - connected: Initial connection established
 * - text: Streaming text tokens
 * - audio: Audio chunks (base64 encoded) - [TEMPORARILY DISABLED]
 * - suggestions: Follow-up questions
 * - complete: Response complete with metrics
 * - error: Error occurred
 */
router.post("/query/stream", validate(chat.body ? { body: chat.body } : chat), streamQuery);

module.exports = router;
