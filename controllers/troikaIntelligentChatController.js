const fs = require('fs');
const logger = require('../utils/logger');
const IntelligentResponseService = require('../services/intelligentResponseService');
const MarketIntelligenceVectorSearch = require('../services/marketIntelligenceVectorSearch');
const EmbeddingService = require('../services/embeddingService');
const VoiceService = require('../services/voiceService');
const StreamingResponseService = require('../services/streamingResponseService');
const SSEHelper = require('../utils/sseHelper');
const MarketIntelligence = require('../models/MarketIntelligence');
const Message = require('../models/Message');
const mixpanel = require('../services/mixpanelService');

const intelligentResponseService = new IntelligentResponseService();
const vectorSearchService = new MarketIntelligenceVectorSearch();
const embeddingService = new EmbeddingService();
const voiceService = new VoiceService();
const streamingResponseService = new StreamingResponseService();
const metricsService = require('../services/metricsService');

/**
 * Answer intelligent query with market intelligence blended into response
 */
exports.answerIntelligentQuery = async (req, res) => {
  try {
    const { query, chatbotId, sessionId, email, phone, name, language, context } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    logger.info(`Intelligent query received: "${query}" (chatbot: ${chatbotId || 'none'}, session: ${sessionId || 'new'}, TTS: always enabled)`);

    // Generate intelligent response
    const response = await intelligentResponseService.generateResponse({
      query: query.trim(),
      chatbotId,
      sessionId,
      email,
      phone,
      name,
      context
    });

    // Always generate audio (TTS enabled by default)
    let audio = null;
    try {
      const languageCode = language || 'en-IN'; // Use provided language or default
      const ttsResult = await voiceService.textToSpeech(response.answer, languageCode);
      audio = ttsResult.audioDataUrl;
      logger.info('TTS audio generated successfully');
    } catch (ttsError) {
      logger.error('TTS generation failed:', ttsError);
      // Continue without audio, don't fail the request
      audio = null;
    }

    // Build response payload matching normal chat route format exactly
    const payload = {
      answer: response.answer,
      audio,
      sessionId: response.sessionId,
      link: null,
      tokens: 0, // We can calculate this later if needed
      requiresAuthNext: false,
      auth_method: 'email'
    };

    // Return suggestions in a separate response field (not embedded in answer text)
    // Note: The suggestions tag [SUGGESTIONS: ...] is already removed from the answer text
    // by intelligentResponseService._cleanAnswer()
    if (response.suggestions && response.suggestions.length > 0) {
      payload.suggestions = response.suggestions;
    }

    // Save messages to database (if chatbotId provided)
    if (chatbotId) {
      try {
        // Save user message
        await Message.create({
          chatbot_id: chatbotId,
          session_id: response.sessionId,
          email: email || null,
          phone: phone || null,
          name: name || null,
          sender: 'user',
          content: query.trim(),
          token_count: 0,
          is_guest: !email && !phone && !name
        });

        // Save bot message
        await Message.create({
          chatbot_id: chatbotId,
          session_id: response.sessionId,
          email: email || null,
          phone: phone || null,
          name: name || null,
          sender: 'bot',
          content: response.answer,
          token_count: response.tokens || 0,
          is_guest: !email && !phone && !name
        });

        logger.info(`Messages saved to database (session: ${response.sessionId})`);
      } catch (dbError) {
        logger.error('Failed to save messages to database:', dbError);
        // Don't fail the request if DB save fails
      }
    }

    res.status(200).json(payload);

  } catch (error) {
    logger.error('Error in answerIntelligentQuery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate intelligent response',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Answer intelligent query with voice input (STT -> Chat -> TTS)
 */
exports.answerIntelligentQueryWithVoice = async (req, res) => {
  let audioPath = null;

  try {
    // Check if audio file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No audio file uploaded'
      });
    }

    audioPath = req.file.path;
    logger.info(`Voice query received: ${req.file.originalname}`);

    // Step 1: Convert speech to text (STT)
    logger.info('Converting speech to text...');
    const sttResult = await voiceService.speechToText(audioPath, req.file.originalname);
    const query = sttResult.text;
    const detectedLanguage = sttResult.language;

    logger.info(`Transcribed: "${query}" (language: ${detectedLanguage})`);

    // Parse optional parameters from form data
    const chatbotId = req.body.chatbotId || null;
    const sessionId = req.body.sessionId || null;
    const email = req.body.email || null;
    const phone = req.body.phone || null;
    const name = req.body.name || null;
    const context = req.body.context ? JSON.parse(req.body.context) : {};
    const enableTTS = req.body.enableTTS !== 'false'; // Default true for voice endpoint

    // Step 2: Generate intelligent response
    logger.info('Generating intelligent response...');
    const response = await intelligentResponseService.generateResponse({
      query: query.trim(),
      chatbotId,
      sessionId,
      email,
      phone,
      name,
      context
    });

    // Add transcription info
    response.transcription = {
      text: query,
      language: detectedLanguage,
      confidence: sttResult.confidence
    };

    // Step 3: Convert response to speech (TTS) if enabled
    if (enableTTS) {
      try {
        logger.info('Converting response to speech...');

        // Map detected language to TTS language code
        const ttsLanguageMap = {
          'hi': 'hi-IN',
          'en': 'en-IN'
        };
        const ttsLanguageCode = ttsLanguageMap[detectedLanguage] || 'en-IN';

        const ttsResult = await voiceService.textToSpeech(response.answer, ttsLanguageCode);

        // Match original TTS route format
        response.audio = ttsResult.audioDataUrl;  // Just the data URL string
        response.processedText = ttsResult.processedText;

        logger.info('TTS audio generated successfully');
      } catch (ttsError) {
        logger.error('TTS generation failed:', ttsError);
        response.audio = null;
        response.ttsError = 'Audio generation failed';
      }
    }

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error('Error in answerIntelligentQueryWithVoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process voice query',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    // Cleanup uploaded audio file
    if (audioPath && fs.existsSync(audioPath)) {
      fs.unlinkSync(audioPath);
    }
  }
};

/**
 * Get statistics about market intelligence data
 */
exports.getIntelligenceStats = async (req, res) => {
  try {
    // Get counts by processing status
    const totalCount = await MarketIntelligence.countDocuments();
    const scrapedCount = await MarketIntelligence.countDocuments({ processingStatus: 'scraped' });
    const summarizedCount = await MarketIntelligence.countDocuments({ processingStatus: 'summarized' });
    const embeddedCount = await MarketIntelligence.countDocuments({ processingStatus: 'embedded' });

    // Get counts by type
    const competitorCount = await MarketIntelligence.countDocuments({ type: 'competitor' });
    const newsCount = await MarketIntelligence.countDocuments({ type: 'industry_news' });
    const techCount = await MarketIntelligence.countDocuments({ type: 'tech_update' });
    const trendCount = await MarketIntelligence.countDocuments({ type: 'market_trend' });

    // Get embedding service stats
    const embeddingStats = await embeddingService.getEmbeddingStats();

    // Get vector search index status
    const indexStatus = await vectorSearchService.checkIndexStatus();

    // Get latest intelligence items
    const latestItems = await MarketIntelligence.find()
      .select('type source title scrapedAt processingStatus relevanceScore')
      .sort({ scrapedAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          total: totalCount,
          scraped: scrapedCount,
          summarized: summarizedCount,
          embedded: embeddedCount
        },
        byType: {
          competitor: competitorCount,
          news: newsCount,
          tech: techCount,
          trend: trendCount
        },
        embedding: embeddingStats,
        vectorSearch: indexStatus,
        latest: latestItems
      }
    });

  } catch (error) {
    logger.error('Error in getIntelligenceStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get intelligence statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Direct semantic search on market intelligence
 */
exports.searchIntelligence = async (req, res) => {
  try {
    const { query, filters = {}, limit = 10 } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    logger.info(`Intelligence search: "${query}"`);

    // Perform hybrid search (vector + keyword)
    const searchResults = await vectorSearchService.hybridSearch(
      query.trim(),
      filters,
      limit
    );

    res.status(200).json({
      success: true,
      data: searchResults
    });

  } catch (error) {
    logger.error('Error in searchIntelligence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search intelligence',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Stream intelligent query response via Server-Sent Events
 * Streams text tokens and audio chunks in real-time
 */
exports.streamIntelligentQuery = async (req, res) => {
  const clientId = `troika-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    const { query, chatbotId, sessionId, email, phone, name, language, context, enableTTS = true } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    const languageCode = language || 'en-IN';
    const userId = sessionId || clientId; // Use sessionId for tracking, fallback to clientId

    logger.info(`[${clientId}] Streaming intelligent query: "${query}" (TTS: ${enableTTS}, language: ${languageCode})`);
    // Better logging: distinguish between undefined/null and empty string
    const logName = name === undefined || name === null ? 'UNDEFINED' : (typeof name === 'string' && name.trim() ? name.trim() : 'EMPTY_STRING');
    const logPhone = phone === undefined || phone === null ? 'UNDEFINED' : (typeof phone === 'string' && phone.trim() ? phone.trim() : 'EMPTY_STRING');
    const logEmail = email === undefined || email === null ? 'UNDEFINED' : (typeof email === 'string' && email.trim() ? email.trim() : 'EMPTY_STRING');
    logger.info(`[${clientId}] 🔍 Request body user data: name="${logName}", phone="${logPhone}", email="${logEmail}"`);

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

    // Create response generator that wraps intelligentResponseService.generateStreamingResponse
    const responseGenerator = () => intelligentResponseService.generateStreamingResponse({
      query: query.trim(),
      chatbotId,
      sessionId,
      email,
      phone,
      name,
      context
    });

    // Stream the response with TTS
    // Note: Booking intent detection and Calendly metadata sending happens inside streamResponse
    const result = await streamingResponseService.streamResponse({
      responseGenerator,
      sseConnection: res,
      enableTTS,
      languageCode,
      streamingContext: {
        clientId,
        query, // ✨ Query is passed for booking intent detection
        chatbotId,
        sessionId
      }
    });

    // Save messages to database asynchronously (fire-and-forget)
    if (chatbotId && result.fullText) {
      setImmediate(() => {
        Promise.all([
          Message.create({
            chatbot_id: chatbotId,
            session_id: sessionId || result.sessionId,
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
            session_id: sessionId || result.sessionId,
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

    // ✨ IMPORTANT: Add small delay before closing to ensure all SSE events are transmitted
    // This prevents metadata events from being lost when connection closes too quickly
    logger.info(`[${clientId}] Waiting 100ms before closing connection to ensure all events transmitted...`);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Close the SSE connection
    SSEHelper.closeConnection(res, clientId);

    const totalDuration = Date.now() - startTime;
    logger.info(`[${clientId}] Stream complete: ${totalDuration}ms, ${result.metrics?.wordCount || 0} words`);

    // Track streaming session completed
    mixpanel.trackStreamingCompleted({
      sessionId: userId,
      chatbotId: chatbotId,
      durationMs: totalDuration,
      wordCount: result.metrics?.wordCount || 0,
      audioChunks: result.metrics?.audioChunks || 0,
      intelligenceLevel: result.intelligence?.level || 'standard',
      intelligenceUsed: result.intelligence?.itemsUsed || 0,
      responseMode: result.responseMode || 'detailed',
      hasSuggestions: (result.suggestions && result.suggestions.length > 0) || false,
      firstTokenLatency: result.metrics?.firstTokenLatency,
      firstAudioLatency: result.metrics?.firstAudioLatency
    });

    // Record success metrics
    metricsService.recordSuccess({
      sessionId: sessionId || result.sessionId || clientId,
      firstTokenLatency: result.metrics?.firstTokenLatency,
      firstAudioLatency: result.metrics?.firstAudioLatency,
      duration: totalDuration,
      wordCount: result.metrics?.wordCount,
      audioChunks: result.metrics?.audioChunks || 0
    });

  } catch (error) {
    logger.error(`[${clientId}] Error in streamIntelligentQuery:`, error);

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
      errorType: error.name || 'UnknownError',
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
};
