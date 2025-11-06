const Mixpanel = require('mixpanel');
const logger = require('../utils/logger');

/**
 * Mixpanel Analytics Service
 *
 * Tracks user behavior, feature usage, and performance metrics
 * for product analytics and investor dashboards.
 *
 * Usage:
 * 1. Set MIXPANEL_TOKEN in .env
 * 2. Import this service: const mixpanel = require('./services/mixpanelService');
 * 3. Track events: mixpanel.track('Event Name', { userId, properties });
 */
class MixpanelService {
  constructor() {
    this.client = null;
    this.enabled = false;
    this.initialize();
  }

  /**
   * Initialize Mixpanel client
   * @private
   */
  initialize() {
    const token = process.env.MIXPANEL_TOKEN;

    if (!token) {
      logger.warn('⚠️  MIXPANEL_TOKEN not found in environment variables. Analytics disabled.');
      logger.warn('   Add MIXPANEL_TOKEN=your_token_here to .env to enable Mixpanel tracking');
      this.enabled = false;
      return;
    }

    try {
      // Initialize with EU data residency endpoint
      this.client = Mixpanel.init(token, {
        host: 'api-eu.mixpanel.com'
      });
      this.enabled = true;
      logger.info('✅ Mixpanel analytics initialized (EU endpoint)');
    } catch (error) {
      logger.error('Failed to initialize Mixpanel:', error);
      this.enabled = false;
    }
  }

  /**
   * Track an event
   * @param {string} eventName - Name of the event
   * @param {string} userId - User identifier (sessionId, email, or anonymous ID)
   * @param {Object} properties - Event properties
   */
  track(eventName, userId, properties = {}) {
    if (!this.enabled) return;

    try {
      this.client.track(eventName, {
        distinct_id: userId,
        ...properties,
        time: Math.floor(Date.now() / 1000), // Unix timestamp in seconds
        environment: process.env.NODE_ENV || 'development'
      }, (err) => {
        if (err) {
          logger.error(`Failed to track Mixpanel event "${eventName}":`, err);
        } else if (process.env.NODE_ENV === 'development') {
          logger.info(`📊 Mixpanel: ${eventName} sent`, { userId, properties });
        }
      });

      if (process.env.NODE_ENV === 'development') {
        logger.info(`📊 Mixpanel: ${eventName} queued`, { userId });
      }
    } catch (error) {
      logger.error(`Failed to track Mixpanel event "${eventName}":`, error);
    }
  }

  /**
   * Set user profile properties
   * @param {string} userId - User identifier
   * @param {Object} properties - User properties
   */
  setUserProfile(userId, properties) {
    if (!this.enabled) return;

    try {
      this.client.people.set(userId, {
        ...properties,
        $last_seen: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to set Mixpanel user profile:', error);
    }
  }

  /**
   * Increment a numeric property
   * @param {string} userId - User identifier
   * @param {string} property - Property name
   * @param {number} value - Value to increment by (default: 1)
   */
  incrementUserProperty(userId, property, value = 1) {
    if (!this.enabled) return;

    try {
      this.client.people.increment(userId, property, value);
    } catch (error) {
      logger.error('Failed to increment Mixpanel property:', error);
    }
  }

  /**
   * Track streaming session started
   */
  trackStreamingStarted({ sessionId, chatbotId, query, enableTTS, language, clientIp, userAgent }) {
    this.track('Streaming Started', sessionId, {
      chatbot_id: chatbotId,
      query_length: query?.length || 0,
      enable_tts: enableTTS,
      language: language,
      client_ip: clientIp,
      user_agent: userAgent,
      endpoint: 'intelligent_streaming'
    });
  }

  /**
   * Track streaming session completed successfully
   */
  trackStreamingCompleted({
    sessionId,
    chatbotId,
    durationMs,
    wordCount,
    audioChunks,
    intelligenceLevel,
    intelligenceUsed,
    responseMode,
    hasSuggestions,
    firstTokenLatency,
    firstAudioLatency
  }) {
    this.track('Streaming Completed', sessionId, {
      chatbot_id: chatbotId,
      duration_ms: durationMs,
      word_count: wordCount,
      audio_chunks: audioChunks || 0,
      intelligence_level: intelligenceLevel,
      intelligence_items_used: intelligenceUsed || 0,
      response_mode: responseMode, // 'brief' or 'detailed'
      has_suggestions: hasSuggestions,
      first_token_latency_ms: firstTokenLatency || 0,
      first_audio_latency_ms: firstAudioLatency || 0,
      success: true
    });

    // Increment user's total conversations
    this.incrementUserProperty(sessionId, 'total_conversations', 1);
  }

  /**
   * Track streaming session failed
   */
  trackStreamingFailed({ sessionId, chatbotId, errorType, errorMessage, durationMs }) {
    this.track('Streaming Failed', sessionId, {
      chatbot_id: chatbotId,
      error_type: errorType,
      error_message: errorMessage,
      duration_ms: durationMs,
      success: false
    });
  }

  /**
   * Track suggestion clicked (frontend will call this, but backend can track too)
   */
  trackSuggestionClicked({ sessionId, chatbotId, suggestionText, suggestionIndex }) {
    this.track('Suggestion Clicked', sessionId, {
      chatbot_id: chatbotId,
      suggestion_text: suggestionText,
      suggestion_index: suggestionIndex
    });
  }

  /**
   * Track voice features used
   */
  trackVoiceUsed({ sessionId, chatbotId, featureType, language }) {
    this.track('Voice Feature Used', sessionId, {
      chatbot_id: chatbotId,
      feature_type: featureType, // 'stt' or 'tts'
      language: language
    });
  }

  /**
   * Track TTS generation
   */
  trackTTSGenerated({ sessionId, chatbotId, textLength, audioSizeBytes, languageCode, durationMs }) {
    this.track('TTS Generated', sessionId, {
      chatbot_id: chatbotId,
      text_length: textLength,
      audio_size_bytes: audioSizeBytes,
      language_code: languageCode,
      generation_duration_ms: durationMs
    });
  }

  /**
   * Track STT transcription
   */
  trackSTTTranscribed({ sessionId, chatbotId, audioSizeBytes, transcribedText, confidence, detectedLanguage, durationMs }) {
    this.track('STT Transcribed', sessionId, {
      chatbot_id: chatbotId,
      audio_size_bytes: audioSizeBytes,
      transcribed_length: transcribedText?.length || 0,
      confidence: confidence,
      detected_language: detectedLanguage,
      transcription_duration_ms: durationMs
    });
  }

  /**
   * Track chatbot created
   */
  trackChatbotCreated({ userId, chatbotId, companyId, industry, features }) {
    this.track('Chatbot Created', userId, {
      chatbot_id: chatbotId,
      company_id: companyId,
      industry: industry,
      features: features || [],
      creation_date: new Date().toISOString()
    });

    // Set user profile
    this.setUserProfile(userId, {
      $email: userId.includes('@') ? userId : undefined,
      total_chatbots: 1,
      last_chatbot_created: new Date().toISOString()
    });

    // Increment chatbots created
    this.incrementUserProperty(userId, 'chatbots_created', 1);
  }

  /**
   * Track chatbot deployed
   */
  trackChatbotDeployed({ userId, chatbotId, deploymentMethod }) {
    this.track('Chatbot Deployed', userId, {
      chatbot_id: chatbotId,
      deployment_method: deploymentMethod, // 'embed', 'api', 'whatsapp'
      deployment_date: new Date().toISOString()
    });
  }

  /**
   * Track API error
   */
  trackAPIError({ endpoint, errorType, errorMessage, statusCode, userId, chatbotId }) {
    this.track('API Error', userId || 'anonymous', {
      endpoint: endpoint,
      error_type: errorType,
      error_message: errorMessage,
      status_code: statusCode,
      chatbot_id: chatbotId
    });
  }

  /**
   * Track cache performance
   */
  trackCacheHit({ sessionId, chatbotId, cacheType, hitOrMiss }) {
    this.track('Cache Performance', sessionId, {
      chatbot_id: chatbotId,
      cache_type: cacheType, // 'knowledge_base' or 'tts'
      result: hitOrMiss // 'hit' or 'miss'
    });
  }

  /**
   * Track session interaction (for engagement metrics)
   */
  trackSessionInteraction({ sessionId, chatbotId, interactionType, metadata }) {
    this.track('Session Interaction', sessionId, {
      chatbot_id: chatbotId,
      interaction_type: interactionType, // 'message_sent', 'audio_played', 'suggestion_viewed'
      ...metadata
    });
  }

  /**
   * Track feature flag usage
   */
  trackFeatureFlagUsed({ userId, featureName, enabled, context }) {
    this.track('Feature Flag Used', userId, {
      feature_name: featureName,
      enabled: enabled,
      context: context
    });
  }

  /**
   * Identify user (link anonymous to known user)
   */
  identifyUser(anonymousId, userId, userProperties = {}) {
    if (!this.enabled) return;

    try {
      // Create alias to link anonymous events to identified user
      this.client.alias(userId, anonymousId);

      // Set user properties
      this.setUserProfile(userId, {
        ...userProperties,
        signup_date: new Date().toISOString()
      });

      logger.info(`✅ Mixpanel: User identified - ${anonymousId} → ${userId}`);
    } catch (error) {
      logger.error('Failed to identify user in Mixpanel:', error);
    }
  }

  /**
   * Flush events (for testing or before shutdown)
   */
  flush() {
    if (!this.enabled) return Promise.resolve();

    return new Promise((resolve, reject) => {
      this.client.track('Flush', () => {
        resolve();
      });
    });
  }
}

// Export singleton instance
module.exports = new MixpanelService();
