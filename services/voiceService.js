const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { OpenAI } = require('openai');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const logger = require('../utils/logger');

// Initialize clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let ttsClient;
try {
  if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
    ttsClient = new TextToSpeechClient({ credentials });
  }
} catch (error) {
  logger.warn('Google TTS not configured:', error.message);
}

class VoiceService {
  constructor() {
    this.femaleVoices = {
      'en-IN': 'en-IN-Chirp3-HD-Leda',
      'en-US': 'en-US-Chirp3-HD-Leda',
      'hi-IN': 'hi-IN-Chirp3-HD-Leda',
      'en-GB': 'en-GB-Neural2-A',
      'es-ES': 'es-ES-Neural2-A'
    };

    this.languageMap = {
      // Indian Languages
      'hindi': 'hi',
      'bengali': 'bn',
      'telugu': 'te',
      'marathi': 'mr',
      'tamil': 'ta',
      'gujarati': 'gu',
      'kannada': 'kn',
      'malayalam': 'ml',
      'punjabi': 'pa',
      'odia': 'or',
      'urdu': 'ur',

      // Major languages
      'english': 'en',
      'spanish': 'es',
      'french': 'fr',
      'german': 'de',
      'italian': 'it',
      'portuguese': 'pt',
      'russian': 'ru',
      'arabic': 'ar',
      'chinese': 'zh',
      'japanese': 'ja',
      'korean': 'ko'
    };
  }

  /**
   * Convert audio to MP3 format for Whisper API
   * @param {String} inputPath - Path to input audio file
   * @returns {Promise<String>} - Path to converted MP3 file
   */
  async convertToMp3(inputPath) {
    return new Promise((resolve, reject) => {
      const outputPath = inputPath.replace(/\.[^/.]+$/, '') + '.mp3';

      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioChannels(1) // Mono for better compatibility
        .audioFrequency(16000) // Standard for speech recognition
        .on('end', () => {
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Audio conversion failed:', err);
          reject(err);
        })
        .save(outputPath);
    });
  }

  /**
   * Transcribe audio to text using OpenAI Whisper
   * @param {String} audioPath - Path to audio file
   * @param {String} originalName - Original filename
   * @returns {Promise<Object>} - { text, language, confidence }
   */
  async speechToText(audioPath, originalName = '') {
    let convertedPath = null;

    try {
      // Check if conversion is needed
      const needsConversion =
        originalName.endsWith('.mp4') ||
        originalName.endsWith('.webm') ||
        originalName.endsWith('.ogg');

      let finalPath = audioPath;

      if (needsConversion) {
        logger.info('Converting audio to MP3...');
        convertedPath = await this.convertToMp3(audioPath);
        finalPath = convertedPath;
      }

      logger.info('Sending audio to Whisper API...');

      // Transcribe using Whisper with language detection
      const transcription = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file: fs.createReadStream(finalPath),
        response_format: 'verbose_json'
      });

      logger.info('Transcription successful:', transcription.text);

      // Map language code
      const detectedLang = this.languageMap[transcription.language?.toLowerCase()] || 'en';
      const confidence = transcription.segments?.[0]?.no_speech_prob < 0.5 ? 'high' : 'low';

      return {
        text: transcription.text,
        language: detectedLang,
        confidence
      };

    } finally {
      // Cleanup converted file if created
      if (convertedPath && fs.existsSync(convertedPath)) {
        fs.unlinkSync(convertedPath);
      }
    }
  }

  /**
   * Convert text to speech using Google TTS
   * @param {String} text - Text to convert
   * @param {String} languageCode - Language code (e.g., 'en-IN', 'hi-IN')
   * @returns {Promise<Object>} - { audioContent, audioDataUrl, voiceName }
   */
  async textToSpeech(text, languageCode = 'en-IN') {
    if (!ttsClient) {
      throw new Error('Google TTS client not configured');
    }

    try {
      // Clean text for TTS
      const cleanedText = this._cleanTextForTTS(text);

      if (!cleanedText || !cleanedText.trim()) {
        throw new Error('No processable text content for TTS');
      }

      // Get voice for language
      const voiceName = this.femaleVoices[languageCode] || 'en-IN-Neural2-A';

      logger.info(`Generating TTS with voice: ${voiceName}`);

      // Generate speech
      const request = {
        input: { text: cleanedText },
        voice: { languageCode, name: voiceName },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: 1.0
        }
      };

      const [response] = await ttsClient.synthesizeSpeech(request);

      // Convert to base64 data URL
      const base64Audio = response.audioContent.toString('base64');
      const audioDataUrl = `data:audio/mpeg;base64,${base64Audio}`;

      logger.info('TTS generation successful');

      return {
        audioContent: response.audioContent,
        audioDataUrl,
        voiceName,
        processedText: cleanedText
      };

    } catch (error) {
      logger.error('TTS generation failed:', error);
      throw error;
    }
  }

  /**
   * Detect language from text using franc
   * @param {String} text - Text to analyze
   * @returns {Promise<String>} - Language code (e.g., 'en-IN')
   */
  async detectLanguage(text) {
    try {
      const { franc } = await import('franc-min');
      const langCode = franc(text);

      if (langCode === 'und') return 'en-IN';

      const map = {
        eng: 'en-IN',
        hin: 'hi-IN',
        spa: 'es-ES',
        fra: 'fr-FR',
        deu: 'de-DE'
      };

      return map[langCode] || 'en-IN';
    } catch (error) {
      logger.warn('Language detection failed, defaulting to en-IN');
      return 'en-IN';
    }
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
}

module.exports = VoiceService;
