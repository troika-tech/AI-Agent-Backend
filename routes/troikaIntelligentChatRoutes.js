const express = require('express');
const router = express.Router();
const multer = require('multer');
const troikaIntelligentChatController = require('../controllers/troikaIntelligentChatController');
const { validate } = require('../middleware/validation');
const Joi = require('joi');

// Multer configuration for audio file uploads (STT)
const upload = multer({ dest: 'uploads/' });

// Validation schema for intelligent chat
const intelligentChatSchema = {
  body: Joi.object({
    query: Joi.string().required().min(1).max(1000).messages({
      'string.empty': 'Query cannot be empty',
      'string.min': 'Query must be at least 1 character',
      'string.max': 'Query cannot exceed 1000 characters',
      'any.required': 'Query is required'
    }),
    chatbotId: Joi.string().optional().messages({
      'string.base': 'Chatbot ID must be a string'
    }),
    sessionId: Joi.string().optional().messages({
      'string.base': 'Session ID must be a string'
    }),
    email: Joi.string().email().optional().allow('').messages({
      'string.email': 'Email must be valid'
    }),
    phone: Joi.string().optional().allow('').messages({
      'string.base': 'Phone must be a string'
    }),
    name: Joi.string().optional().allow('', null).messages({
      'string.base': 'Name must be a string'
    }),
    language: Joi.string().optional().messages({
      'string.base': 'Language must be a string'
    }),
    context: Joi.object({
      industry: Joi.string().optional(),
      services: Joi.array().items(Joi.string()).optional(),
      previousQuery: Joi.string().optional()
    }).optional()
  })
};

/**
 * POST /api/troika/intelligent-chat
 * Intelligent sales agent chat for Troika Tech (Text input)
 *
 * Request body:
 * {
 *   query: string (required) - User's question
 *   sessionId: string (optional) - Session ID for conversation context
 *   context: {
 *     industry: string (optional) - User's industry
 *     services: string[] (optional) - Services user is interested in
 *     previousQuery: string (optional) - Previous query for context
 *   },
 *   enableTTS: boolean (optional, default: false) - Return audio response
 * }
 */
router.post(
  '/intelligent-chat',
  validate(intelligentChatSchema),
  troikaIntelligentChatController.answerIntelligentQuery
);

/**
 * POST /api/troika/intelligent-chat/stream
 * Streaming version of intelligent chat (SSE)
 * Returns Server-Sent Events with text tokens and audio chunks
 *
 * Request body:
 * {
 *   query: string (required) - User's question
 *   sessionId: string (optional) - Session ID for conversation context
 *   chatbotId: string (optional) - Chatbot ID for message logging
 *   email: string (optional) - User email
 *   phone: string (optional) - User phone
 *   language: string (optional, default: 'en-IN') - Language code for TTS
 *   enableTTS: boolean (optional, default: true) - Enable audio streaming
 *   context: {
 *     industry: string (optional) - User's industry
 *     services: string[] (optional) - Services user is interested in
 *     previousQuery: string (optional) - Previous query for context
 *   }
 * }
 *
 * SSE Events:
 * - connected: Initial connection established
 * - metadata: Intent analysis and intelligence level
 * - text: Streaming text tokens
 * - audio: Audio chunks (base64 encoded)
 * - suggestions: Follow-up questions
 * - complete: Response complete with metrics
 * - error: Error occurred
 */
router.post(
  '/intelligent-chat/stream',
  validate(intelligentChatSchema),
  troikaIntelligentChatController.streamIntelligentQuery
);

/**
 * POST /api/troika/intelligent-chat/voice
 * Intelligent sales agent chat with voice input (STT -> Chat -> TTS)
 *
 * Multipart form data:
 * - audio: file (required) - Audio file (mp3, wav, webm, mp4, ogg)
 * - sessionId: string (optional) - Session ID for conversation context
 * - context: JSON string (optional) - { industry, services }
 * - enableTTS: boolean (optional, default: true) - Return audio response
 */
router.post(
  '/intelligent-chat/voice',
  upload.single('audio'),
  troikaIntelligentChatController.answerIntelligentQueryWithVoice
);

/**
 * GET /api/troika/intelligence/stats
 * Get statistics about market intelligence data
 */
router.get(
  '/intelligence/stats',
  troikaIntelligentChatController.getIntelligenceStats
);

/**
 * POST /api/troika/intelligence/search
 * Direct semantic search on market intelligence
 *
 * Request body:
 * {
 *   query: string (required)
 *   filters: {
 *     types: string[] (optional)
 *     services: string[] (optional)
 *     industries: string[] (optional)
 *     minRelevanceScore: number (optional)
 *     maxAgeDays: number (optional)
 *   }
 *   limit: number (optional, default: 10)
 * }
 */
router.post(
  '/intelligence/search',
  troikaIntelligentChatController.searchIntelligence
);

module.exports = router;
