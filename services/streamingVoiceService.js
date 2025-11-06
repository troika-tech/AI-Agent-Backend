const textToSpeech = require('@google-cloud/text-to-speech');
const {JWT, GoogleAuth} = require('google-auth-library');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * StreamingVoiceService
 *
 * Handles Google Cloud Text-to-Speech streaming with Chirp HD voices.
 * Supports sentence-level streaming for low-latency audio generation.
 */
class StreamingVoiceService {
  constructor() {
    // Lazy-load TTS client (initialized on first use)
    this._client = null;

    // Redis will be injected for caching (if available)
    this.redis = null;
  }

  /**
   * Get or initialize the TTS client (lazy loading)
   * @private
   */
  get client() {
    if (!this._client) {
      try {
        const clientOptions = this._buildClientOptions();

        // Initialize without grpc config to avoid internal logger issues
        this._client = new textToSpeech.TextToSpeechClient(clientOptions);
        logger.info('Google Cloud TTS client initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Google Cloud TTS client:', error);
        throw error;
      }
    }
    return this._client;
  }

  /**
   * Build Text-to-Speech client options using JWT auth when credentials are provided
   * @private
   * @returns {Object} Client options
   */
  _buildClientOptions() {
    // Parse Google Cloud credentials from environment
    if (!process.env.GOOGLE_CLOUD_CREDENTIALS) {
      return {};
    }

    try {
      const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
      const {client_email: email, private_key: key} = credentials;
      if (!email || !key) {
        logger.warn('Google Cloud credentials missing client_email or private_key; falling back to default auth');
        return {};
      }

      const jwtClient = new JWT({
        email,
        key,
        keyId: credentials.private_key_id,
        subject: credentials.subject,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        universeDomain: credentials.universe_domain
      });

      if (credentials.project_id) {
        jwtClient.projectId = credentials.project_id;
      }

      if (credentials.quota_project_id) {
        jwtClient.quotaProjectId = credentials.quota_project_id;
      }

      const auth = new GoogleAuth({
        authClient: jwtClient,
        projectId: credentials.project_id || undefined,
        clientOptions: credentials.universe_domain
          ? {universeDomain: credentials.universe_domain}
          : undefined
      });

      const options = {auth};

      if (credentials.project_id) {
        options.projectId = credentials.project_id;
      }

      if (credentials.universe_domain) {
        options.universeDomain = credentials.universe_domain;
      }

      return options;
    } catch (parseError) {
      logger.warn('Failed to parse GOOGLE_CLOUD_CREDENTIALS, trying without credentials', parseError);
      return {};
    }
  }

  /**
   * Set Redis client for audio caching
   */
  setRedisClient(redisClient) {
    this.redis = redisClient;
  }

  /**
   * Get appropriate Chirp HD voice for language and gender
   * @param {string} languageCode - Language code (e.g., 'en-IN', 'hi-IN')
   * @param {string} gender - Gender: 'D' (Male), 'F' (Female), 'O' (Neutral)
   * @returns {string} Voice name
   */
  getChirpHDVoice(languageCode, gender = 'D') {
    const normalizedLanguage = languageCode || 'en-US';
    const normalizedGender = (gender || 'D').toUpperCase();

    // Prefer explicit override from environment
    const envVoiceName =
      process.env.GOOGLE_TTS_VOICE_NAME ||
      process.env.GOOGLE_TTS_VOICE_OVERRIDE ||
      process.env.GOOGLE_TTS_VOICE;
    if (envVoiceName) {
      return envVoiceName;
    }

    // Preferred Chirp3 HD voices where available
    const chirp3VoiceOverrides = {
      'en-IN': {
        default: 'en-IN-Chirp3-HD-Leda'
      },
      'en-US': {
        default: 'en-US-Chirp3-HD-Leda'
      }
    };

    const overrideVoice =
      chirp3VoiceOverrides[normalizedLanguage]?.[normalizedGender] ??
      chirp3VoiceOverrides[normalizedLanguage]?.default;

    if (overrideVoice) {
      return overrideVoice;
    }

    // Fallback to Chirp HD voices
    const baseVoiceMap = {
      'en-US': 'en-US-Chirp-HD',
      'en-IN': 'en-IN-Chirp-HD',
      'en-GB': 'en-GB-Chirp-HD',
      'en-AU': 'en-AU-Chirp-HD',
      'hi-IN': 'hi-IN-Chirp-HD',
      'fr-FR': 'fr-FR-Chirp-HD',
      'de-DE': 'de-DE-Chirp-HD',
      'es-ES': 'es-ES-Chirp-HD',
      'ja-JP': 'ja-JP-Chirp-HD',
      'ko-KR': 'ko-KR-Chirp-HD'
    };

    const baseVoice = baseVoiceMap[normalizedLanguage] || 'en-US-Chirp-HD';
    return `${baseVoice}-${normalizedGender}`;
  }

  /**
   * Start a new TTS streaming session
   * @param {string} languageCode - Language code
   * @param {string} gender - Gender (D/F/O)
   * @returns {Stream} TTS stream
   */
  startStream(languageCode = 'en-IN', gender = 'D') {
    try {
      const voiceName = this.getChirpHDVoice(languageCode, gender);
      const ttsStream = this.client.streamingSynthesize();
      ttsStream.voiceName = voiceName;

      // Configure streaming with Chirp HD voice
      ttsStream.write({
        streamingConfig: {
          voice: {
            name: voiceName,
            languageCode: languageCode,
            ssmlGender: 'NEUTRAL'
          }
        }
      });

      logger.info(`TTS stream started: ${voiceName}`);
      return ttsStream;

    } catch (error) {
      logger.error('Failed to start TTS stream:', error);
      throw error;
    }
  }

  /**
   * Write text chunk to TTS stream
   * @param {Stream} ttsStream - Active TTS stream
   * @param {string} text - Text to convert to speech
   * @param {string} languageCode - Language for cache key
   * @returns {Promise<boolean>} Success status
   */
  async writeTextChunk(ttsStream, text, languageCode = 'en-IN') {
    if (!text || text.trim().length === 0) {
      return false;
    }

    try {
      // Clean text for TTS (remove emojis, markdown, etc.)
      const cleanedText = this._cleanTextForTTS(text);

      if (!cleanedText || cleanedText.trim().length === 0) {
        return false;
      }

      // Check cache first (if Redis available)
      const voiceName = ttsStream?.voiceName || this.getChirpHDVoice(languageCode);
      const cachedAudio = await this.getCachedAudio(cleanedText, languageCode, voiceName);
      if (cachedAudio) {
        return { fromCache: true, audio: cachedAudio };
      }

      // Write to stream for generation
      ttsStream.write({ input: { text: cleanedText.trim() } });
      return { fromCache: false };

    } catch (error) {
      logger.error('Failed to write text chunk:', error);
      return false;
    }
  }

  /**
   * End TTS stream
   * @param {Stream} ttsStream - Active TTS stream
   */
  async endStream(ttsStream) {
    if (!ttsStream) {
      return;
    }

    if (ttsStream.destroyed || (ttsStream.writableEnded && ttsStream.readableEnded)) {
      return;
    }

    await new Promise((resolve) => {
      const cleanup = () => {
        ttsStream.removeListener('end', onEnd);
        ttsStream.removeListener('close', onClose);
        ttsStream.removeListener('error', onError);
      };

      const onEnd = () => {
        cleanup();
        resolve();
      };

      const onClose = () => {
        cleanup();
        resolve();
      };

      const onError = (error) => {
        cleanup();
        logger.error('Error ending TTS stream:', error);
        resolve();
      };

      ttsStream.once('end', onEnd);
      ttsStream.once('close', onClose);
      ttsStream.once('error', onError);

      try {
        ttsStream.end();
      } catch (error) {
        cleanup();
        logger.error('Error ending TTS stream:', error);
        resolve();
      }
    });
  }

  /**
   * Get cached audio for text
   * @param {string} text - Text to check
   * @param {string} languageCode - Language code
   * @returns {Promise<Buffer|null>} Cached audio or null
   */
  async getCachedAudio(text, languageCode, voiceName = this.getChirpHDVoice(languageCode)) {
    if (!this.redis) return null;

    try {
      const cacheKey = this._generateCacheKey(text, languageCode, voiceName);
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return Buffer.from(cached, 'base64');
      }

      return null;
    } catch (error) {
      logger.warn('Cache retrieval failed:', error);
      return null;
    }
  }

  /**
   * Cache audio for future use
   * @param {string} text - Original text
   * @param {string} languageCode - Language code
   * @param {Buffer} audioBuffer - Audio data
   * @param {number} ttl - Cache TTL in seconds (default: 1 hour)
   */
  async cacheAudio(text, languageCode, audioBuffer, ttl = 3600, voiceName = this.getChirpHDVoice(languageCode)) {
    if (!this.redis) return;

    try {
      const cacheKey = this._generateCacheKey(text, languageCode, voiceName);
      const base64Audio = audioBuffer.toString('base64');
      await this.redis.setex(cacheKey, ttl, base64Audio);
    } catch (error) {
      logger.warn('Cache save failed:', error);
    }
  }

  /**
   * Generate cache key from text and language
   * @private
   */
  _generateCacheKey(text, languageCode, voiceName = this.getChirpHDVoice(languageCode)) {
    const hash = crypto.createHash('md5')
      .update(text.trim().toLowerCase())
      .digest('hex');
    const voiceHash = crypto.createHash('md5').update(voiceName || 'default').digest('hex');
    return `tts_audio:${languageCode}:${voiceHash}:${hash}`;
  }

  /**
   * Convert LINEAR16 audio to base64 data URL
   * @param {Buffer} audioBuffer - Raw LINEAR16 audio
   * @returns {string} Base64 data URL
   */
  convertToDataURL(audioBuffer) {
    const base64Audio = audioBuffer.toString('base64');
    return `data:audio/wav;base64,${base64Audio}`;
  }

  /**
   * Create WAV header for LINEAR16 audio
   * @param {number} sampleRate - Sample rate (default: 24000)
   * @param {number} numChannels - Number of channels (default: 1 for mono)
   * @param {number} dataSize - Size of audio data
   * @returns {Buffer} WAV header
   */
  createWavHeader(sampleRate = 24000, numChannels = 1, dataSize = 0) {
    const header = Buffer.alloc(44);
    const byteRate = sampleRate * numChannels * 2; // 16-bit = 2 bytes
    const blockAlign = numChannels * 2;

    // RIFF chunk descriptor
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);

    // fmt sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(16, 34); // BitsPerSample

    // data sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return header;
  }

  /**
   * Handle TTS stream errors with retry logic
   * @param {Error} error - Error object
   * @param {number} retryCount - Current retry attempt
   * @returns {boolean} Whether to retry
   */
  shouldRetry(error, retryCount = 0) {
    const maxRetries = 3;
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'RATE_LIMIT_EXCEEDED'
    ];

    if (retryCount >= maxRetries) {
      return false;
    }

    return retryableErrors.some(code =>
      error.code === code || error.message.includes(code)
    );
  }

  /**
   * Get exponential backoff delay
   * @param {number} retryCount - Current retry attempt
   * @returns {number} Delay in milliseconds
   */
  getBackoffDelay(retryCount) {
    return Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10s
  }

  /**
   * Pre-generate and cache common phrases
   * @param {Array<string>} phrases - Array of common phrases
   * @param {string} languageCode - Language code
   */
  async preGenerateCache(phrases, languageCode = 'en-IN') {
    if (!this.redis) {
      logger.warn('Redis not available, skipping cache pre-generation');
      return;
    }

    logger.info(`Pre-generating TTS cache for ${phrases.length} phrases...`);

    for (const phrase of phrases) {
      try {
        // Check if already cached
        const plannedVoiceName = this.getChirpHDVoice(languageCode);
        const cached = await this.getCachedAudio(phrase, languageCode, plannedVoiceName);
        if (cached) {
          continue;
        }

        // Generate audio
        const ttsStream = this.startStream(languageCode);
        const activeVoiceName = ttsStream.voiceName;
        let audioChunks = [];

        ttsStream.on('data', (response) => {
          if (response.audioContent) {
            audioChunks.push(response.audioContent);
          }
        });

        ttsStream.on('end', async () => {
          const fullAudio = Buffer.concat(audioChunks);
          await this.cacheAudio(phrase, languageCode, fullAudio, 86400, activeVoiceName); // 24hr cache
        });

        await this.writeTextChunk(ttsStream, phrase, languageCode);
        await this.endStream(ttsStream);

        // Wait a bit to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        logger.error(`Failed to pre-generate: ${phrase.substring(0, 30)}...`, error);
      }
    }

    logger.info('TTS cache pre-generation complete');
  }

  /**
   * Clean text for TTS (remove markdown, HTML, emojis, etc.)
   * @private
   * @param {String} text - Text to clean
   * @returns {String} - Cleaned text
   */
  _cleanTextForTTS(text) {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text;

    // Remove HTML tags
    cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, ' ');

    // Remove markdown headers (##, ###, etc.)
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

    // Remove markdown bold/italic markers (**, __, *, _)
    cleaned = cleaned.replace(/([_*~`]){1,3}/g, ' ');

    // Remove strikethrough
    cleaned = cleaned.replace(/~~(.*?)~~/g, '$1');

    // Remove inline code markers
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

    // Normalize Unicode spaces
    cleaned = cleaned
      .replace(/\uFEFF/g, '')
      .replace(/[\u00A0\u2000-\u200B\u202F\u205F]/g, ' ')
      .replace(/\u200C|\u200D/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove emojis but preserve currency symbols (₹ $, €, £, ¥, etc.)
    // Currency symbols are in ranges: \u0024 ($), \u00A2-\u00A5 (¢£¤¥), \u20A0-\u20CF (₠-₯ including ₹)
    cleaned = cleaned.replace(
      /[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]/gu,
      ''
    );

    // Remove emoji-range symbols but preserve currency symbols
    // Exclude currency ranges: 0024 ($), 00A2-00A5, 20A0-20CF
    cleaned = cleaned.replace(/[\u{1F000}-\u{1F02F}\u{1F030}-\u{1F9FF}]/gu, '');

    // Remove miscellaneous symbols but keep currency
    cleaned = cleaned.replace(/[\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    // Remove list markers (1., 2., -, *, •)
    cleaned = cleaned.replace(/\b\d+\.\s*|^[-*•‣⁃·•]\s*/gm, '');

    // Fix acronyms (AI -> A I, SEO -> S E O)
    const acronyms = ['AI', 'SEO', 'API', 'CRM', 'TTS', 'STT'];
    const pattern = new RegExp('\\b(?:' + acronyms.join('|') + ')\\b', 'gi');
    cleaned = cleaned.replace(pattern, (match) => {
      return match.toUpperCase().split('').join(' ');
    });

    // Final cleanup
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  /**
   * Get service statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      cacheEnabled: !!this.redis,
      voicesSupported: 10, // Approximate number of Chirp HD voices
      defaultVoice: this.getChirpHDVoice('en-IN', 'D')
    };
  }
}

module.exports = StreamingVoiceService;
