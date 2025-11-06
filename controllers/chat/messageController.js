// controllers/chat/messageController.js
const { catchAsync } = require("../../middleware/errorHandler");
const { processAnswerQuery } = require("../../services/chatbotService");
const { validateBody } = require("../../utils/validationHelpers");
const { generateStreamingAnswer } = require("../../services/chatService");
const StreamingResponseService = require("../../services/streamingResponseService");
const SSEHelper = require("../../utils/sseHelper");
const logger = require("../../utils/logger");
const { retrieveRelevantChunks } = require("../../services/queryService");
const Chatbot = require("../../models/Chatbot");
const Message = require("../../models/Message");
const metricsService = require("../../services/metricsService");
const mixpanel = require("../../services/mixpanelService");

const streamingResponseService = new StreamingResponseService();

exports.answerQuery = catchAsync(async (req, res) => {
  if (!validateBody(req, res)) return;

  const { query, chatbotId, sessionId, email, phone, name, language } = req.body;
  const result = await processAnswerQuery({ query, chatbotId, sessionId, email, phone, name, language });
  if (result.type === "NEED_AUTH") {
    return res.status(403).json(result.payload);
  }
  return res.status(200).json(result.payload);
});

/**
 * Stream chat query response via Server-Sent Events
 * Streams text tokens and optional audio chunks in real-time
 */
exports.streamQuery = catchAsync(async (req, res) => {
  const clientId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    if (!validateBody(req, res)) return;

    // TEMPORARILY DISABLED TTS
    const { query, chatbotId, sessionId, email, phone, name, language, enableTTS = false } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    if (!chatbotId) {
      return res.status(400).json({
        success: false,
        message: 'Chatbot ID is required'
      });
    }

    const languageCode = language || 'en-IN';
    const userId = sessionId || clientId; // Use sessionId for tracking

    // Structured logging with context
    logger.info(`[${clientId}] Streaming user chatbot query`, {
      clientId,
      chatbotId,
      query: query.substring(0, 100), // Truncate for logging
      enableTTS,
      languageCode,
      sessionId: sessionId || 'new',
      hasAuth: !!(email || phone)
    });

    // Track streaming session started
    mixpanel.trackStreamingStarted({
      sessionId: userId,
      chatbotId: chatbotId,
      query: query.trim(),
      enableTTS: enableTTS,
      language: languageCode,
      clientIp: req.ip,
      userAgent: req.get('user-agent')
    });

    // Initialize SSE connection
    SSEHelper.initializeSSE(res, clientId);

    // Get chatbot configuration
    const chatbot = await Chatbot.findById(chatbotId).lean();
    if (!chatbot) {
      SSEHelper.sendError(res, 'Chatbot not found');
      SSEHelper.closeConnection(res, clientId);
      return;
    }

    // Retrieve relevant context from knowledge base
    let contextChunks = [];
    try {
      // retrieveRelevantChunks(query, chatbotId, topK, minScore)
      // Note: languageCode is handled internally by vectorSearch, not passed here
      contextChunks = await retrieveRelevantChunks(query, chatbotId);
    } catch (contextError) {
      logger.error(`[${clientId}] Failed to retrieve context:`, contextError);
      // Continue without context
    }

    // Get chat history (only if sessionId provided)
    let historyContext = [];
    if (sessionId) {
      try {
        const history = await Message.find({
          chatbot_id: chatbotId,
          session_id: sessionId,
          sender: { $in: ['user', 'bot'] }
        })
          .sort({ createdAt: -1 })
          .limit(10)
          .lean();

        historyContext = history.reverse().map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));
      } catch (historyError) {
        logger.error(`[${clientId}] Failed to load history:`, historyError);
        // Continue without history
      }
    }

    // Create response generator
    // generateStreamingAnswer(query, contextChunks, clientConfig, historyContext, chatbotId, productContext, productFeatureEnabled, botDoc, sessionId, languageHint, userContext)
    const responseGenerator = () => generateStreamingAnswer(
      query,
      contextChunks,
      chatbot,           // clientConfig (chatbot config)
      historyContext,    // historyContext
      chatbotId,         // chatbotId
      null,              // productContext (not used for user chatbots)
      false,             // productFeatureEnabled (not used for user chatbots)
      chatbot,           // botDoc (chatbot document for persona)
      sessionId,         // sessionId
      languageCode,      // languageHint
      { name, email, phone } // userContext (name, phone, email)
    );

    // Stream the response
    // TEMPORARILY DISABLED TTS - forcing enableTTS to false
    const result = await streamingResponseService.streamResponse({
      responseGenerator,
      sseConnection: res,
      enableTTS: false, // Temporarily disabled
      languageCode,
      streamingContext: {
        clientId,
        query,
        chatbotId,
        sessionId
      }
    });

    // Save messages to database asynchronously (fire-and-forget)
    if (result.fullText) {
      setImmediate(() => {
        Promise.all([
          Message.create({
            chatbot_id: chatbotId,
            session_id: sessionId || `sess_${Date.now()}`,
            email: email || null,
            phone: phone || null,
            name: name || null,
            sender: 'user',
            content: query.trim(),
            token_count: 0,
            is_guest: !email && !phone && !name
          }),
          Message.create({
            chatbot_id: chatbotId,
            session_id: sessionId || `sess_${Date.now()}`,
            email: email || null,
            phone: phone || null,
            name: name || null,
            sender: 'bot',
            content: result.fullText,
            token_count: result.metrics?.wordCount || 0,
            is_guest: !email && !phone && !name
          })
        ])
          .then(() => logger.info(`[${clientId}] Messages saved to database`))
          .catch(err => logger.error(`[${clientId}] Failed to save messages:`, err));
      });
    }

    // Close the SSE connection
    SSEHelper.closeConnection(res, clientId);

    const totalDuration = Date.now() - startTime;

    // Structured logging with performance metrics
    logger.info(`[${clientId}] Stream complete`, {
      clientId,
      chatbotId,
      duration: totalDuration,
      wordCount: result.metrics?.wordCount || 0,
      firstTokenLatency: result.metrics?.firstTokenLatency,
      firstAudioLatency: result.metrics?.firstAudioLatency,
      audioChunks: result.metrics?.audioChunks || 0,
      enableTTS
    });

    // Track streaming session completed
    mixpanel.trackStreamingCompleted({
      sessionId: userId,
      chatbotId: chatbotId,
      durationMs: totalDuration,
      wordCount: result.metrics?.wordCount || 0,
      audioChunks: result.metrics?.audioChunks || 0,
      intelligenceLevel: 'standard',
      intelligenceUsed: contextChunks?.length || 0,
      responseMode: 'detailed',
      hasSuggestions: false,
      firstTokenLatency: result.metrics?.firstTokenLatency,
      firstAudioLatency: result.metrics?.firstAudioLatency
    });

    // Record success metrics
    metricsService.recordSuccess({
      sessionId: sessionId || clientId,
      firstTokenLatency: result.metrics?.firstTokenLatency,
      firstAudioLatency: result.metrics?.firstAudioLatency,
      duration: totalDuration,
      wordCount: result.metrics?.wordCount,
      audioChunks: result.metrics?.audioChunks || 0
    });

  } catch (error) {
    logger.error(`[${clientId}] Error in streamQuery:`, error);

    const totalDuration = Date.now() - startTime;

    // Record error metrics
    const errorType = error.name === 'ValidationError' ? 'validation' :
                      error.message?.includes('OpenAI') ? 'openai' :
                      error.message?.includes('TTS') || error.message?.includes('audio') ? 'tts' :
                      error.message?.includes('network') || error.message?.includes('ECONNREFUSED') ? 'network' :
                      'other';

    metricsService.recordError(errorType, error);

    // Track streaming session failed
    mixpanel.trackStreamingFailed({
      sessionId: req.body.sessionId || clientId,
      chatbotId: req.body.chatbotId,
      errorType: errorType,
      errorMessage: error.message,
      durationMs: totalDuration
    });

    // Send error event if connection is still open
    try {
      SSEHelper.sendError(res, error.message || 'Failed to generate streaming response');
      SSEHelper.closeConnection(res, clientId);
    } catch (sseError) {
      // Connection might already be closed
      logger.error(`[${clientId}] Failed to send SSE error:`, sseError);
    }
  }
});
