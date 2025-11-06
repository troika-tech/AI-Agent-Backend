const StreamingVoiceService = require('../services/streamingVoiceService');
const redis = require('redis');
const logger = require('../utils/logger');

// Mock dependencies
jest.mock('redis');
jest.mock('../utils/logger');
jest.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: jest.fn(() => ({
    streamingSynthesize: jest.fn()
  }))
}));

describe('StreamingVoiceService', () => {
  let service;
  let mockRedisClient;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Redis client
    mockRedisClient = {
      get: jest.fn(),
      setEx: jest.fn(),
      quit: jest.fn()
    };
    redis.createClient.mockReturnValue(mockRedisClient);

    service = new StreamingVoiceService();
  });

  afterEach(async () => {
    if (service.redisClient) {
      await service.disconnect();
    }
  });

  describe('getChirpHDVoice', () => {
    it('returns correct Chirp HD voice for English (India)', () => {
      const voice = service.getChirpHDVoice('en-IN', 'D');
      expect(voice).toBe('en-IN-Chirp-HD-D');
    });

    it('returns correct Chirp HD voice for Hindi', () => {
      const voice = service.getChirpHDVoice('hi-IN', 'C');
      expect(voice).toBe('hi-IN-Chirp-HD-C');
    });

    it('defaults to gender D when not specified', () => {
      const voice = service.getChirpHDVoice('en-IN');
      expect(voice).toBe('en-IN-Chirp-HD-D');
    });

    it('falls back to en-IN-Chirp-HD-D for unsupported language', () => {
      const voice = service.getChirpHDVoice('xx-XX', 'D');
      expect(voice).toBe('en-IN-Chirp-HD-D');
    });

    it('supports all documented languages', () => {
      const supportedLanguages = [
        'en-IN', 'hi-IN', 'bn-IN', 'ta-IN', 'te-IN',
        'mr-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'pa-IN',
        'en-US', 'es-ES', 'fr-FR', 'de-DE'
      ];

      supportedLanguages.forEach(lang => {
        const voice = service.getChirpHDVoice(lang, 'D');
        expect(voice).toBe(`${lang}-Chirp-HD-D`);
      });
    });
  });

  describe('startStream', () => {
    it('creates TTS stream with correct configuration', () => {
      const mockStream = {
        write: jest.fn(),
        on: jest.fn()
      };
      service.client.streamingSynthesize.mockReturnValue(mockStream);

      const stream = service.startStream('en-IN', 'D');

      expect(service.client.streamingSynthesize).toHaveBeenCalled();
      expect(mockStream.write).toHaveBeenCalledWith({
        streamingConfig: {
          voice: {
            name: 'en-IN-Chirp-HD-D',
            languageCode: 'en-IN'
          }
        }
      });
      expect(stream).toBe(mockStream);
    });

    it('defaults to en-IN language when not specified', () => {
      const mockStream = {
        write: jest.fn(),
        on: jest.fn()
      };
      service.client.streamingSynthesize.mockReturnValue(mockStream);

      service.startStream();

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.objectContaining({
          streamingConfig: expect.objectContaining({
            voice: expect.objectContaining({
              languageCode: 'en-IN'
            })
          })
        })
      );
    });

    it('uses specified gender for voice', () => {
      const mockStream = {
        write: jest.fn(),
        on: jest.fn()
      };
      service.client.streamingSynthesize.mockReturnValue(mockStream);

      service.startStream('hi-IN', 'C');

      expect(mockStream.write).toHaveBeenCalledWith(
        expect.objectContaining({
          streamingConfig: expect.objectContaining({
            voice: expect.objectContaining({
              name: 'hi-IN-Chirp-HD-C'
            })
          })
        })
      );
    });
  });

  describe('getCachedAudio', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('returns cached audio when available', async () => {
      const cachedData = 'base64audiodata';
      mockRedisClient.get.mockResolvedValue(cachedData);

      const result = await service.getCachedAudio('Hello world', 'en-IN');

      expect(result).toBe(cachedData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('tts:en-IN:Hello world');
    });

    it('returns null when cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.getCachedAudio('Hello world', 'en-IN');

      expect(result).toBeNull();
    });

    it('returns null when Redis is not connected', async () => {
      service.redisClient = null;

      const result = await service.getCachedAudio('Hello world', 'en-IN');

      expect(result).toBeNull();
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('handles Redis errors gracefully', async () => {
      const error = new Error('Redis connection failed');
      mockRedisClient.get.mockRejectedValue(error);

      const result = await service.getCachedAudio('Hello world', 'en-IN');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Redis cache read error:', error);
    });
  });

  describe('cacheAudio', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('caches audio with correct TTL', async () => {
      const audioData = 'base64audiodata';
      mockRedisClient.setEx.mockResolvedValue('OK');

      await service.cacheAudio('Hello world', 'en-IN', audioData);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'tts:en-IN:Hello world',
        86400, // 24 hours
        audioData
      );
    });

    it('does nothing when Redis is not connected', async () => {
      service.redisClient = null;

      await service.cacheAudio('Hello world', 'en-IN', 'audiodata');

      expect(mockRedisClient.setEx).not.toHaveBeenCalled();
    });

    it('handles Redis errors gracefully', async () => {
      const error = new Error('Redis write failed');
      mockRedisClient.setEx.mockRejectedValue(error);

      await service.cacheAudio('Hello world', 'en-IN', 'audiodata');

      expect(logger.error).toHaveBeenCalledWith('Redis cache write error:', error);
    });
  });

  describe('writeTextChunk', () => {
    let mockStream;

    beforeEach(async () => {
      await service.connect();
      mockStream = {
        write: jest.fn()
      };
    });

    it('uses cached audio when available', async () => {
      const cachedAudio = 'cached-base64-audio';
      mockRedisClient.get.mockResolvedValue(cachedAudio);

      const result = await service.writeTextChunk(mockStream, 'Hello world', 'en-IN');

      expect(result).toEqual({ wasCached: true, audio: cachedAudio });
      expect(mockStream.write).not.toHaveBeenCalled();
    });

    it('writes text to stream when not cached', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.writeTextChunk(mockStream, 'Hello world', 'en-IN');

      expect(result).toEqual({ wasCached: false, audio: null });
      expect(mockStream.write).toHaveBeenCalledWith({
        input: { text: 'Hello world' }
      });
    });

    it('handles empty text gracefully', async () => {
      const result = await service.writeTextChunk(mockStream, '', 'en-IN');

      expect(result).toEqual({ wasCached: false, audio: null });
      expect(mockStream.write).not.toHaveBeenCalled();
    });

    it('trims whitespace from text before processing', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      await service.writeTextChunk(mockStream, '  Hello world  ', 'en-IN');

      expect(mockRedisClient.get).toHaveBeenCalledWith('tts:en-IN:Hello world');
      expect(mockStream.write).toHaveBeenCalledWith({
        input: { text: 'Hello world' }
      });
    });

    it('logs cache hit correctly', async () => {
      mockRedisClient.get.mockResolvedValue('cached-audio');

      await service.writeTextChunk(mockStream, 'Hello world', 'en-IN');

    });
  });

  describe('preGenerateAudio', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('generates audio for multiple sentences', async () => {
      const sentences = ['Hello world', 'How are you?', 'Goodbye'];
      mockRedisClient.get.mockResolvedValue(null); // All cache misses

      // Mock TTS client
      const mockSynthesizeSpeech = jest.fn()
        .mockResolvedValueOnce([{ audioContent: Buffer.from('audio1') }])
        .mockResolvedValueOnce([{ audioContent: Buffer.from('audio2') }])
        .mockResolvedValueOnce([{ audioContent: Buffer.from('audio3') }]);

      service.client.synthesizeSpeech = mockSynthesizeSpeech;
      mockRedisClient.setEx.mockResolvedValue('OK');

      const results = await service.preGenerateAudio(sentences, 'en-IN');

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty('text', 'Hello world');
      expect(results[0]).toHaveProperty('success', true);
      expect(mockSynthesizeSpeech).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.setEx).toHaveBeenCalledTimes(3);
    });

    it('skips sentences that are already cached', async () => {
      const sentences = ['Cached sentence', 'New sentence'];
      mockRedisClient.get
        .mockResolvedValueOnce('cached-audio') // First is cached
        .mockResolvedValueOnce(null); // Second is not

      const mockSynthesizeSpeech = jest.fn()
        .mockResolvedValue([{ audioContent: Buffer.from('new-audio') }]);
      service.client.synthesizeSpeech = mockSynthesizeSpeech;

      const results = await service.preGenerateAudio(sentences, 'en-IN');

      expect(results[0]).toHaveProperty('cached', true);
      expect(results[1]).toHaveProperty('cached', false);
      expect(mockSynthesizeSpeech).toHaveBeenCalledTimes(1); // Only called for non-cached
    });

    it('handles TTS errors gracefully', async () => {
      const sentences = ['Hello world'];
      mockRedisClient.get.mockResolvedValue(null);

      const error = new Error('TTS failed');
      service.client.synthesizeSpeech = jest.fn().mockRejectedValue(error);

      const results = await service.preGenerateAudio(sentences, 'en-IN');

      expect(results[0]).toHaveProperty('success', false);
      expect(results[0]).toHaveProperty('error', 'TTS failed');
      expect(logger.error).toHaveBeenCalled();
    });

    it('returns empty array for empty input', async () => {
      const results = await service.preGenerateAudio([], 'en-IN');
      expect(results).toEqual([]);
    });
  });

  describe('disconnect', () => {
    it('disconnects Redis client when connected', async () => {
      await service.connect();
      mockRedisClient.quit.mockResolvedValue('OK');

      await service.disconnect();

      expect(mockRedisClient.quit).toHaveBeenCalled();
      expect(service.redisClient).toBeNull();
    });

    it('handles disconnect when not connected', async () => {
      service.redisClient = null;

      await service.disconnect();

      expect(mockRedisClient.quit).not.toHaveBeenCalled();
    });

    it('handles Redis disconnect errors', async () => {
      await service.connect();
      const error = new Error('Disconnect failed');
      mockRedisClient.quit.mockRejectedValue(error);

      await service.disconnect();

      expect(logger.error).toHaveBeenCalledWith('Error disconnecting Redis:', error);
      expect(service.redisClient).toBeNull();
    });
  });
});
