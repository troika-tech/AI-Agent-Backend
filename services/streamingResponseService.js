const openai = require('../config/openai');
const StreamingVoiceService = require('./streamingVoiceService');
const SentenceDetector = require('../utils/sentenceDetector');
const SSEHelper = require('../utils/sseHelper');
const { SSE_EVENTS } = require('../utils/sseEventTypes');
const logger = require('../utils/logger');

/**
 * StreamingResponseService
 *
 * Core orchestrator for streaming chat responses.
 * Coordinates OpenAI text streaming, TTS audio streaming, and SSE to client.
 */
class StreamingResponseService {
  constructor() {
    this.voiceService = new StreamingVoiceService();

    // Track active streams for memory management
    this.activeStreams = new Set();
    this.streamMetrics = {
      totalStreams: 0,
      activeCount: 0,
      completedCount: 0,
      errorCount: 0
    };
  }

  /**
   * Set Redis client for caching (optional)
   * @param {Object} redisClient - Redis client instance
   */
  setRedisClient(redisClient) {
    this.voiceService.setRedisClient(redisClient);
  }

  /**
   * ✨ Detect if user wants to book a meeting
   * @param {string} userQuery - User's original query
   * @param {string} aiResponse - AI's response text
   * @returns {boolean} True if booking intent detected
   */
  detectBookingIntent(userQuery, aiResponse) {
    const bookingKeywords = [
      'book a meeting',
      'book meeting',
      'schedule a call',
      'schedule call',
      'set up a meeting',
      'set up meeting',
      'want to meet',
      'like to meet',
      'talk to someone',
      'speak with team',
      'speak to team',
      'schedule time',
      'book appointment',
      'book an appointment',
      'calendar',
      'available times',
      'when are you available',
      'can we meet',
      'let\'s meet',
      'meeting with',
      'call with',
      'schedule a demo',
      'book a demo',
      'schedule demo',
      'talk to sales',
      'speak to sales'
    ];

    const queryLower = (userQuery || '').toLowerCase();
    const responseLower = (aiResponse || '').toLowerCase();
    // Only check user query for booking intent, not bot response
    const combinedText = queryLower;

    // Check if any booking keyword appears and log which one matched
    const matchedKeywords = bookingKeywords.filter(keyword => combinedText.includes(keyword));

    if (matchedKeywords.length > 0) {
      logger.info(`[BookingIntent] ✅ Matched keywords: ${matchedKeywords.join(', ')}`);
      return true;
    }

    logger.info(`[BookingIntent] ❌ No keywords matched`);
    return false;
  }

  /**
   * Get current stream statistics
   * @returns {Object} Stream statistics
   */
  getStats() {
    return {
      ...this.streamMetrics,
      activeStreams: this.activeStreams.size
    };
  }

  /**
   * Main streaming orchestrator
   * @param {Object} config - Streaming configuration
   * @param {Function} config.responseGenerator - Async generator function that yields response data
   * @param {Response} config.sseConnection - Express response object for SSE
   * @param {boolean} config.enableTTS - Whether to generate audio
   * @param {string} config.languageCode - Target language code
   * @param {Object} config.streamingContext - Additional context (clientId, query, etc.)
   * @returns {Promise<Object>} Streaming result
   */
  async streamResponse(config) {
    const {
      responseGenerator,
      sseConnection,
      enableTTS = false,
      languageCode = 'en-IN',
      streamingContext = {}
    } = config;

    // Generate stream ID for tracking
    const streamId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Track this stream
    this.activeStreams.add(streamId);
    this.streamMetrics.totalStreams++;
    this.streamMetrics.activeCount = this.activeStreams.size;

    const startTime = Date.now();
    let ttsStream = null;
    let sentenceDetector = new SentenceDetector();
    let fullTextBuffer = '';
    let sentenceCount = 0;
    let audioSequence = 0;
    let firstTokenTime = null;
    let firstAudioTime = null;
    let insideSuggestionTag = false; // Track if we're inside [SUGGESTIONS: ... ]
    let suggestionsFromGenerator = null; // Store suggestions from generator
    let ttsStreamEnded = false;
    let handleTtsData = null;
    let handleTtsError = null;

    try {
      // Send initial status
      SSEHelper.sendStatus(sseConnection, 'Processing your request...');


      // TEMPORARILY DISABLED: Initialize TTS stream if enabled
      /* if (enableTTS) {
        try {
          ttsStream = this.voiceService.startStream(languageCode);

          // Handle TTS audio chunks
          handleTtsData = (response) => {
            if (response.audioContent) {
              if (!firstAudioTime) {
                firstAudioTime = Date.now() - startTime;
              }

              // Convert to base64 and stream to client
              const audioBase64 = response.audioContent.toString('base64');
              SSEHelper.sendAudioChunk(sseConnection, audioBase64, audioSequence++);

              // Cache audio for this sentence (if Redis available)
              // Note: We'll need to track which sentence this audio belongs to
            }
          };

          handleTtsError = (err) => {
            logger.error('TTS stream error:', err);
            SSEHelper.sendWarning(sseConnection, 'Audio generation temporarily unavailable');
            if (ttsStream) {
              ttsStream.removeListener('data', handleTtsData);
              ttsStream.removeListener('error', handleTtsError);
            }
            ttsStreamEnded = true;
            ttsStream = null;
          };

          ttsStream.on('data', handleTtsData);
          ttsStream.on('error', handleTtsError);

        } catch (error) {
          logger.error('Failed to initialize TTS:', error);
          SSEHelper.sendWarning(sseConnection, 'Audio generation unavailable');
          ttsStream = null;
        }
      } */

      // Process response generator
      for await (const chunk of responseGenerator()) {
        // Edge case: Check if client disconnected (network interruption)
        if (!SSEHelper.isConnectionAlive(sseConnection)) {
          logger.warn(`Client disconnected, stopping stream: ${streamId}`);
          break; // Stop processing
        }

        // Handle different chunk types from the generator
        if (chunk.type === 'metadata') {
          // Send metadata to client
          SSEHelper.sendMetadata(sseConnection, chunk.data);
          continue;
        }

        if (chunk.type === 'text') {
          const token = chunk.data || '';

          if (!token) continue;

          // Send text token to client
          SSEHelper.sendTextChunk(sseConnection, token);

          // Track first token time
          if (!firstTokenTime) {
            firstTokenTime = Date.now() - startTime;
          }

          // Always add token to buffer for suggestion extraction
          fullTextBuffer += token;

          // Check if token contains any part of SUGGESTIONS tag
          const hasSuggestionStart = token.includes('[SUGGESTIONS') || token.includes('[SUGGEST');
          const hasSuggestionContent = token.includes('SUGGESTIONS:');
          const hasSuggestionEnd = insideSuggestionTag && token.includes(']');

          // Log token if it contains suggestion-related content
          if (hasSuggestionStart || hasSuggestionContent || insideSuggestionTag) {
            logger.info(`[TTS] Token contains suggestion content: "${token}" (start: ${hasSuggestionStart}, content: ${hasSuggestionContent}, inside: ${insideSuggestionTag}, end: ${hasSuggestionEnd})`);
          }

          // Check if token contains complete SUGGESTIONS tag (single or multi-line)
          if (token.match(/\[SUGGESTIONS:[\s\S]*?\]/)) {
            logger.info(`[TTS] Skipping complete SUGGESTIONS tag in token: "${token}"`);
            continue;
          }

          // Start of suggestions tag
          if (hasSuggestionStart) {
            logger.info(`[TTS] Start of SUGGESTIONS tag detected, entering skip mode`);
            insideSuggestionTag = true;
            continue;
          }

          // End of suggestions tag
          if (hasSuggestionEnd) {
            logger.info(`[TTS] End of SUGGESTIONS tag detected, exiting skip mode`);
            insideSuggestionTag = false;
            continue;
          }

          // Inside suggestions tag
          if (insideSuggestionTag) {
            logger.info(`[TTS] Skipping token inside SUGGESTIONS tag: "${token}"`);
            continue;
          }

          // Add token to sentence detector (text already sent above)
          sentenceDetector.addToken(token);

          // TEMPORARILY DISABLED: Check for complete sentence
          /* if (sentenceDetector.hasCompleteSentence()) {
            let sentence = sentenceDetector.extractSentence();

            if (sentence && ttsStream) {
              // CRITICAL FIX: Clean suggestion tags from sentence BEFORE sending to TTS
              // The sentence detector may have captured the start of [SUGGESTIONS: tag
              const originalSentence = sentence;

              // Check if this sentence is part of suggestions (starts with pipe or contains SUGGESTIONS tag)
              const isSuggestionPart = originalSentence.includes('[SUGGESTIONS') ||
                                      originalSentence.includes('SUGGESTIONS:') ||
                                      originalSentence.trim().startsWith('|');

              if (isSuggestionPart) {
                logger.info(`[TTS] Skipped sentence that is part of suggestions: "${originalSentence}"`);
                continue; // Skip this entire sentence - it's part of the suggestions
              }

              // Clean any remaining suggestion tags
              sentence = this.cleanSuggestionTags(sentence);

              // Also remove partial suggestion tags (incomplete tags at sentence boundaries)
              sentence = sentence.replace(/\[SUGGESTIONS:[^\]]*$/gi, ''); // Remove incomplete tag at end
              sentence = sentence.trim();

              // Skip if sentence is now empty or just contains suggestion fragments
              if (!sentence || sentence.length < 2) {
                logger.info(`[TTS] Skipped empty sentence after cleaning: "${originalSentence}"`);
                continue;
              }

              sentenceCount++;

              // Log the sentence being sent to TTS
              logger.info(`[TTS] Generating audio for sentence #${sentenceCount}: "${sentence.substring(0, 100)}${sentence.length > 100 ? '...' : ''}"`);

              if (originalSentence !== sentence) {
                logger.warn(`[TTS] ⚠️ Cleaned sentence before TTS. Original: "${originalSentence.substring(0, 100)}", Cleaned: "${sentence.substring(0, 100)}"`);
              }

              // Generate TTS for this sentence
              const ttsResult = await this.voiceService.writeTextChunk(ttsStream, sentence, languageCode);
              if (ttsResult?.fromCache && ttsResult.audio) {
                if (!firstAudioTime) {
                  firstAudioTime = Date.now() - startTime;
                }
                const cachedAudioBase64 = ttsResult.audio.toString('base64');
                SSEHelper.sendAudioChunk(sseConnection, cachedAudioBase64, audioSequence++);
                logger.info(`[TTS] Audio chunk #${audioSequence - 1} sent (${ttsResult.fromCache ? 'from cache' : 'newly generated'})`);
              }
            }
          } */
        }

        if (chunk.type === 'productContext') {
          // Send product context to client
          SSEHelper.sendEvent(sseConnection, 'productContext', {
            context: chunk.context,
            productFeatureEnabled: chunk.productFeatureEnabled
          });
          continue;
        }

        if (chunk.type === 'suggestions') {
          // Capture suggestions from generator
          suggestionsFromGenerator = chunk.data;
          continue;
        }

        if (chunk.type === 'complete') {
          // Handle completion metadata
          break;
        }
      }

      // Handle any remaining text in buffer
      const remainingText = sentenceDetector.getRemainingBuffer();
      logger.info(`[TTS] Remaining buffer length: ${remainingText ? remainingText.length : 0} chars`);
      if (remainingText) {
        logger.info(`[TTS] Remaining buffer before cleaning: "${remainingText}"`);
      }

      // TEMPORARILY DISABLED: Handle remaining text for TTS
      /* if (remainingText && ttsStream) {
        // IMPORTANT: Clean suggestions tag from remaining text before sending to TTS
        // We don't want to generate audio for suggestion questions
        let cleanedRemaining = this.cleanSuggestionTags(remainingText);

        // Also remove any leftover closing brackets from suggestions tag
        cleanedRemaining = cleanedRemaining.replace(/^\s*\]\s*$/g, '').trim();

        logger.info(`[TTS] Remaining buffer after cleaning: "${cleanedRemaining}"`);

        if (remainingText !== cleanedRemaining) {
          logger.warn(`[TTS] ⚠️ CLEANED SUGGESTIONS FROM REMAINING BUFFER!`);
          logger.warn(`[TTS] Original length: ${remainingText.length}, Cleaned length: ${cleanedRemaining.length}`);
          logger.warn(`[TTS] Removed: "${remainingText.replace(cleanedRemaining, '')}"`);
        }

        if (cleanedRemaining && cleanedRemaining.trim().length > 0) {
          logger.info(`[TTS] Generating audio for remaining text: "${cleanedRemaining}"`);
          const finalChunkResult = await this.voiceService.writeTextChunk(ttsStream, cleanedRemaining, languageCode);
          if (finalChunkResult?.fromCache && finalChunkResult.audio) {
            if (!firstAudioTime) {
              firstAudioTime = Date.now() - startTime;
            }
            const cachedAudioBase64 = finalChunkResult.audio.toString('base64');
            SSEHelper.sendAudioChunk(sseConnection, cachedAudioBase64, audioSequence++);
            logger.info(`[TTS] Final audio chunk #${audioSequence - 1} sent`);
          }
        } else {
          logger.info(`[TTS] No remaining text to generate audio for (empty after cleaning)`);
        }
      }

      // End TTS stream
      if (ttsStream) {
        await this.voiceService.endStream(ttsStream);
        ttsStreamEnded = true;
      } */

      // Use suggestions from generator if available, otherwise try to extract from text
      let suggestions = suggestionsFromGenerator;

      logger.info(`[TTS] Suggestions from generator: ${suggestionsFromGenerator ? JSON.stringify(suggestionsFromGenerator) : 'none'}`);

      if (!suggestions || suggestions.length === 0) {
        // Fallback: Extract suggestions from full text (legacy support)
        logger.info(`[TTS] No suggestions from generator, extracting from text buffer (length: ${fullTextBuffer.length})`);
        suggestions = this.extractSuggestionsFromStream(fullTextBuffer);
        logger.info(`[TTS] Extracted suggestions: ${suggestions ? JSON.stringify(suggestions) : 'none'}`);
      }

      // Clean the suggestions tag from fullTextBuffer for storage
      const fullTextBeforeCleaning = fullTextBuffer;
      fullTextBuffer = this.cleanSuggestionTags(fullTextBuffer);

      if (fullTextBeforeCleaning !== fullTextBuffer) {
        logger.info(`[TTS] Cleaned suggestions from full text buffer. Before: ${fullTextBeforeCleaning.length} chars, After: ${fullTextBuffer.length} chars`);
      }

      // Send suggestions via SSE
      if (suggestions && suggestions.length > 0) {
        logger.info(`[TTS] Sending ${suggestions.length} suggestions to client: ${JSON.stringify(suggestions)}`);
        SSEHelper.sendSuggestions(sseConnection, suggestions);
      } else {
        logger.warn('[TTS] No suggestions to send to client');
      }

      // ✨ NEW: Check for booking intent and send Calendly metadata BEFORE completion
      const userQuery = streamingContext.query || '';
      const aiResponse = fullTextBuffer;

      logger.info(`[Stream] 🔍 Checking booking intent...`);
      logger.info(`[Stream] 📝 User query: "${userQuery.substring(0, 100)}"`);
      logger.info(`[Stream] 🤖 AI response: "${aiResponse.substring(0, 200)}..."`);

      const hasBookingIntent = this.detectBookingIntent(userQuery, aiResponse);
      logger.info(`[Stream] 🎯 Booking intent detected: ${hasBookingIntent}`);

      if (hasBookingIntent) {
        logger.info(`[Stream] 📅 SENDING CALENDLY METADATA EVENT`);
        const metadata = {
          action: 'show_calendly',
          calendly_url: 'https://calendly.com/troika-parvati/new-meeting'
        };
        logger.info(`[Stream] 📤 Metadata payload: ${JSON.stringify(metadata)}`);

        const sent = SSEHelper.sendEvent(sseConnection, 'metadata', metadata);
        logger.info(`[Stream] ✅ Metadata event sent successfully: ${sent}`);
      } else {
        logger.info(`[Stream] ❌ No booking intent detected, skipping Calendly widget`);
      }

      // Calculate final metrics
      const duration = Date.now() - startTime;
      const wordCount = fullTextBuffer.split(/\s+/).filter(Boolean).length;

      // Send completion event
      SSEHelper.sendComplete(sseConnection, {
        duration,
        wordCount,
        sentenceCount,
        audioChunks: audioSequence,
        firstTokenLatency: firstTokenTime,
        firstAudioLatency: firstAudioTime,
        language: languageCode
      });

      logger.info(`Stream complete: ${duration}ms, ${wordCount} words, ${sentenceCount} sentences`);

      // Update metrics
      this.streamMetrics.completedCount++;

      return {
        success: true,
        fullText: fullTextBuffer,
        suggestions,
        duration,
        metrics: {
          wordCount,
          sentenceCount,
          audioChunks: audioSequence,
          firstTokenLatency: firstTokenTime,
          firstAudioLatency: firstAudioTime
        }
      };

    } catch (error) {
      logger.error('Stream error:', error);

      // Update error metrics
      this.streamMetrics.errorCount++;

      // Send error to client
      SSEHelper.handleStreamError(sseConnection, error, 'streaming');

      throw error;

    } finally {
      // Memory management: Cleanup all resources to prevent memory leaks

      // 1. Remove from active streams tracking
      this.activeStreams.delete(streamId);
      this.streamMetrics.activeCount = this.activeStreams.size;

      // 2. Clean up TTS stream
      if (ttsStream) {
        try {
          if (handleTtsData) {
            ttsStream.removeListener('data', handleTtsData);
          }
          if (handleTtsError) {
            ttsStream.removeListener('error', handleTtsError);
          }
          if (!ttsStreamEnded) {
            await this.voiceService.endStream(ttsStream);
          }
        } catch (err) {
          logger.error('TTS cleanup error:', err);
        }
      }

      // 3. Clean up sentence detector buffer
      if (sentenceDetector) {
        try {
          sentenceDetector.clear(); // Clear internal buffers
        } catch (err) {
        }
      }

      // 4. Clear large text buffer to free memory
      fullTextBuffer = null;

      // 5. Force garbage collection hint (buffer cleanup)
      if (global.gc) {
        global.gc();
      }
    }
  }

  /**
   * Extract suggestions from streaming response
   * @param {string} textBuffer - Full text buffer
   * @returns {Array<string>} Array of suggestions (up to 3)
   */
  extractSuggestionsFromStream(textBuffer) {
    if (!textBuffer) return [];

    // Look for [SUGGESTIONS: q1 | q2 | q3] tag
    const suggestionsRegex = /\[SUGGESTIONS:\s*([^\]]+)\]/i;
    const match = textBuffer.match(suggestionsRegex);

    if (match) {
      try {
        const suggestionsStr = match[1].trim();
        const suggestions = suggestionsStr
          .split(/\||;/)
          .map(s => s.trim())
          .filter(s => s.length > 0 && s.length <= 150)
          .slice(0, 3);

        return suggestions;
      } catch (err) {
        logger.warn('Failed to parse suggestions:', err);
      }
    }

    return [];
  }

  /**
   * Clean suggestion tags from text
   * @param {string} text - Text with potential suggestion tags
   * @returns {string} Cleaned text
   */
  cleanSuggestionTags(text) {
    if (!text) return '';
    return text.replace(/\[SUGGESTIONS:\s*[^\]]+\]/gi, '').trim();
  }

  /**
   * Stream text-only response (no audio)
   * @param {Object} config - Configuration
   * @returns {Promise<Object>} Result
   */
  async streamTextOnly(config) {
    return this.streamResponse({
      ...config,
      enableTTS: false
    });
  }

  /**
   * Get service statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      voiceService: this.voiceService.getStats(),
      features: {
        textStreaming: true,
        audioStreaming: true,
        suggestionExtraction: true,
        multiLanguage: true
      }
    };
  }
}

module.exports = StreamingResponseService;
