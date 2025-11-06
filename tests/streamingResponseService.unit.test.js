const StreamingResponseService = require('../services/streamingResponseService');
const StreamingVoiceService = require('../services/streamingVoiceService');
const SentenceDetector = require('../utils/sentenceDetector');
const SSEHelper = require('../utils/sseHelper');
const logger = require('../utils/logger');

// Mock dependencies
jest.mock('../services/streamingVoiceService');
jest.mock('../utils/sentenceDetector');
jest.mock('../utils/sseHelper');
jest.mock('../utils/logger');

describe('StreamingResponseService', () => {
  let service;
  let mockVoiceService;
  let mockSentenceDetector;
  let mockSSEConnection;
  let mockTTSStream;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock TTS stream
    mockTTSStream = {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      removeAllListeners: jest.fn()
    };

    // Mock voice service
    mockVoiceService = {
      startStream: jest.fn().mockReturnValue(mockTTSStream),
      writeTextChunk: jest.fn().mockResolvedValue({ wasCached: false, audio: null }),
      endStream: jest.fn()
    };
    StreamingVoiceService.mockImplementation(() => mockVoiceService);

    // Mock sentence detector
    mockSentenceDetector = {
      addToken: jest.fn(),
      hasCompleteSentence: jest.fn().mockReturnValue(false),
      extractSentence: jest.fn().mockReturnValue(''),
      getRemainingBuffer: jest.fn().mockReturnValue(''),
      reset: jest.fn()
    };
    SentenceDetector.mockImplementation(() => mockSentenceDetector);

    // Mock SSE connection (Express response object)
    mockSSEConnection = {
      write: jest.fn(),
      end: jest.fn()
    };

    // Mock SSEHelper methods
    SSEHelper.sendTextChunk = jest.fn();
    SSEHelper.sendAudioChunk = jest.fn();
    SSEHelper.sendSuggestions = jest.fn();
    SSEHelper.sendMetadata = jest.fn();
    SSEHelper.sendStatus = jest.fn();
    SSEHelper.sendWarning = jest.fn();
    SSEHelper.sendError = jest.fn();
    SSEHelper.sendComplete = jest.fn();
    SSEHelper.handleStreamError = jest.fn();

    service = new StreamingResponseService();
  });

  describe('streamResponse - Basic Flow', () => {
    it('streams text chunks from response generator', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Hello' };
        yield { type: 'text', data: ' world' };
        yield { type: 'complete', data: { sessionId: 'sess-123' } };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: false,
        languageCode: 'en-IN'
      });

      expect(SSEHelper.sendTextChunk).toHaveBeenCalledWith(mockSSEConnection, 'Hello');
      expect(SSEHelper.sendTextChunk).toHaveBeenCalledWith(mockSSEConnection, ' world');
    });

    it('sends completion event with metadata', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Test' };
        yield { type: 'complete', data: { sessionId: 'sess-123', tokens: 50 } };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: false,
        languageCode: 'en-IN'
      });

      expect(SSEHelper.sendComplete).toHaveBeenCalledWith(
        mockSSEConnection,
        expect.objectContaining({
          duration: expect.any(Number),
          wordCount: 1,
          sentenceCount: 0,
          language: 'en-IN'
        })
      );
    });

    it('accumulates full text buffer', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Hello' };
        yield { type: 'text', data: ' ' };
        yield { type: 'text', data: 'world' };
        yield { type: 'complete', data: {} };
      };

      const result = await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: false,
        languageCode: 'en-IN'
      });

      expect(result.fullText).toBe('Hello world');
      expect(SSEHelper.sendComplete).toHaveBeenCalledWith(
        mockSSEConnection,
        expect.objectContaining({
          wordCount: 2
        })
      );
    });
  });

  describe('streamResponse - TTS Integration', () => {
    it('starts TTS stream when enabled', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Test' };
        yield { type: 'complete', data: {} };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: true,
        languageCode: 'hi-IN'
      });

      expect(mockVoiceService.startStream).toHaveBeenCalledWith('hi-IN');
    });

    it('does not start TTS stream when disabled', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Test' };
        yield { type: 'complete', data: {} };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: false,
        languageCode: 'en-IN'
      });

      expect(mockVoiceService.startStream).not.toHaveBeenCalled();
    });

    it('detects complete sentences and sends to TTS', async () => {
      mockSentenceDetector.hasCompleteSentence
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      mockSentenceDetector.extractSentence.mockReturnValue('Hello world.');

      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Hello' };
        yield { type: 'text', data: ' ' };
        yield { type: 'text', data: 'world.' };
        yield { type: 'complete', data: {} };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: true,
        languageCode: 'en-IN'
      });

      expect(mockVoiceService.writeTextChunk).toHaveBeenCalledWith(
        mockTTSStream,
        'Hello world.',
        'en-IN'
      );
    });

    it('sends audio chunks when TTS produces audio', async () => {
      const audioContent = Buffer.from('audio-data');

      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Test' };
        yield { type: 'complete', data: {} };
      };

      // Setup TTS stream to emit audio
      mockVoiceService.startStream.mockImplementation(() => {
        setTimeout(() => {
          const dataHandler = mockTTSStream.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (dataHandler) {
            dataHandler({ audioContent });
          }
        }, 0);
        return mockTTSStream;
      });

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: true,
        languageCode: 'en-IN'
      });

      // Allow async events to process
      await new Promise(resolve => setImmediate(resolve));

      expect(SSEHelper.sendAudioChunk).toHaveBeenCalledWith(
        mockSSEConnection,
        audioContent.toString('base64'),
        expect.any(Number)
      );
    });

    it('handles TTS stream errors gracefully', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Test' };
        yield { type: 'complete', data: {} };
      };

      // Setup TTS stream to emit error
      mockVoiceService.startStream.mockImplementation(() => {
        setTimeout(() => {
          const errorHandler = mockTTSStream.on.mock.calls.find(call => call[0] === 'error')?.[1];
          if (errorHandler) {
            errorHandler(new Error('TTS failed'));
          }
        }, 0);
        return mockTTSStream;
      });

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: true,
        languageCode: 'en-IN'
      });

      await new Promise(resolve => setImmediate(resolve));

      expect(SSEHelper.sendWarning).toHaveBeenCalledWith(
        mockSSEConnection,
        'Audio generation temporarily unavailable'
      );
    });

    it('processes remaining buffer as final sentence', async () => {
      mockSentenceDetector.getRemainingBuffer.mockReturnValue('Final text');

      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Final text' };
        yield { type: 'complete', data: {} };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: true,
        languageCode: 'en-IN'
      });

      expect(mockVoiceService.writeTextChunk).toHaveBeenCalledWith(
        mockTTSStream,
        'Final text',
        'en-IN'
      );
    });

    it('ends TTS stream after processing', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Test' };
        yield { type: 'complete', data: {} };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: true,
        languageCode: 'en-IN'
      });

      expect(mockTTSStream.end).toHaveBeenCalled();
    });
  });

  describe('streamResponse - Suggestions Handling', () => {
    it('extracts and sends suggestions from text', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Here is my response. ' };
        yield { type: 'text', data: '[SUGGESTIONS: Tell me more | What are the benefits? | Show pricing]' };
        yield { type: 'complete', data: {} };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: false,
        languageCode: 'en-IN'
      });

      expect(SSEHelper.sendSuggestions).toHaveBeenCalledWith(
        mockSSEConnection,
        expect.arrayContaining([
          'Tell me more',
          'What are the benefits?',
          'Show pricing'
        ])
      );
    });

    it('does not send suggestions if none found', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Simple response without suggestions.' };
        yield { type: 'complete', data: {} };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: false,
        languageCode: 'en-IN'
      });

      expect(SSEHelper.sendSuggestions).not.toHaveBeenCalled();
    });

    it('forwards suggestions from generator if provided', async () => {
      const suggestions = ['Option A', 'Option B', 'Option C'];

      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Response text' };
        yield { type: 'suggestions', data: suggestions };
        yield { type: 'complete', data: {} };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: false,
        languageCode: 'en-IN'
      });

      expect(SSEHelper.sendSuggestions).toHaveBeenCalledWith(
        mockSSEConnection,
        suggestions
      );
    });
  });

  describe('streamResponse - Metadata Handling', () => {
    it('forwards metadata events from generator', async () => {
      const metadata = { intent: 'sales_inquiry', confidence: 0.95 };

      const responseGenerator = async function* () {
        yield { type: 'metadata', data: metadata };
        yield { type: 'text', data: 'Response' };
        yield { type: 'complete', data: {} };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: false,
        languageCode: 'en-IN'
      });

      expect(SSEHelper.sendMetadata).toHaveBeenCalledWith(
        mockSSEConnection,
        metadata
      );
    });
  });

  describe('streamResponse - Performance Metrics', () => {
    it('tracks first token latency', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'First token' };
        yield { type: 'complete', data: {} };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: false,
        languageCode: 'en-IN'
      });

      expect(SSEHelper.sendComplete).toHaveBeenCalledWith(
        mockSSEConnection,
        expect.objectContaining({
          firstTokenTime: expect.any(Number)
        })
      );
    });

    it('tracks first audio latency when TTS enabled', async () => {
      const audioContent = Buffer.from('audio-data');

      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Test.' };
        yield { type: 'complete', data: {} };
      };

      // Simulate complete sentence detection
      mockSentenceDetector.hasCompleteSentence.mockReturnValue(true);
      mockSentenceDetector.extractSentence.mockReturnValue('Test.');

      // Setup TTS stream to emit audio quickly
      mockVoiceService.startStream.mockImplementation(() => {
        setTimeout(() => {
          const dataHandler = mockTTSStream.on.mock.calls.find(call => call[0] === 'data')?.[1];
          if (dataHandler) dataHandler({ audioContent });
        }, 0);
        return mockTTSStream;
      });

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: true,
        languageCode: 'en-IN'
      });

      await new Promise(resolve => setImmediate(resolve));

      expect(SSEHelper.sendComplete).toHaveBeenCalledWith(
        mockSSEConnection,
        expect.objectContaining({
          firstAudioTime: expect.any(Number)
        })
      );
    });

    it('includes total processing time in completion', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Test' };
        yield { type: 'complete', data: {} };
      };

      const startTime = Date.now();

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: false,
        languageCode: 'en-IN'
      });

      const endTime = Date.now();

      expect(SSEHelper.sendComplete).toHaveBeenCalledWith(
        mockSSEConnection,
        expect.objectContaining({
          totalTime: expect.any(Number)
        })
      );

      const callArgs = SSEHelper.sendComplete.mock.calls[0][1];
      expect(callArgs.totalTime).toBeGreaterThanOrEqual(0);
      expect(callArgs.totalTime).toBeLessThan(endTime - startTime + 100);
    });
  });

  describe('streamResponse - Error Handling', () => {
    it('handles generator errors gracefully', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Start' };
        throw new Error('Generator failed');
      };

      await expect(
        service.streamResponse({
          responseGenerator,
          sseConnection: mockSSEConnection,
          enableTTS: false,
          languageCode: 'en-IN'
        })
      ).rejects.toThrow('Generator failed');

      expect(logger.error).toHaveBeenCalled();
    });

    it('cleans up TTS stream on error', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Start' };
        throw new Error('Test error');
      };

      try {
        await service.streamResponse({
          responseGenerator,
          sseConnection: mockSSEConnection,
          enableTTS: true,
          languageCode: 'en-IN'
        });
      } catch (e) {
        // Expected
      }

      expect(mockTTSStream.end).toHaveBeenCalled();
    });

    it('handles missing enableTTS parameter', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Test' };
        yield { type: 'complete', data: {} };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        languageCode: 'en-IN'
        // enableTTS not provided
      });

      expect(mockVoiceService.startStream).not.toHaveBeenCalled();
    });

    it('defaults to en-IN language when not specified', async () => {
      const responseGenerator = async function* () {
        yield { type: 'text', data: 'Test' };
        yield { type: 'complete', data: {} };
      };

      await service.streamResponse({
        responseGenerator,
        sseConnection: mockSSEConnection,
        enableTTS: true
        // languageCode not provided
      });

      expect(mockVoiceService.startStream).toHaveBeenCalledWith('en-IN');
    });
  });

  describe('extractSuggestionsFromStream', () => {
    it('extracts suggestions from [SUGGESTIONS: ...] tag with pipe separator', () => {
      const text = 'Response text [SUGGESTIONS: First option | Second option | Third option]';

      const suggestions = service.extractSuggestionsFromStream(text);

      expect(suggestions).toHaveLength(3);
      expect(suggestions[0]).toBe('First option');
      expect(suggestions[1]).toBe('Second option');
      expect(suggestions[2]).toBe('Third option');
    });

    it('extracts suggestions with semicolon separator', () => {
      const text = 'Response [SUGGESTIONS: Option 1; Option 2; Option 3]';

      const suggestions = service.extractSuggestionsFromStream(text);

      expect(suggestions).toHaveLength(3);
    });

    it('returns empty array when no suggestions found', () => {
      const text = 'Simple response without any suggestions.';

      const suggestions = service.extractSuggestionsFromStream(text);

      expect(suggestions).toEqual([]);
    });

    it('limits to 3 suggestions', () => {
      const text = '[SUGGESTIONS: One | Two | Three | Four | Five]';

      const suggestions = service.extractSuggestionsFromStream(text);

      expect(suggestions).toHaveLength(3);
    });
  });
});
