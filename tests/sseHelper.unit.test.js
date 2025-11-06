const SSEHelper = require('../utils/sseHelper');
const { SSE_EVENTS } = require('../utils/sseEventTypes');

describe('SSEHelper', () => {
  let mockRes;
  let heartbeatInterval;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock Express response object
    mockRes = {
      writeHead: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn()
    };

    // Clear any existing heartbeat intervals
    SSEHelper.heartbeats.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    SSEHelper.heartbeats.clear();
  });

  describe('initializeSSE', () => {
    it('sets correct SSE headers', () => {
      SSEHelper.initializeSSE(mockRes, 'client-123');

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
    });

    it('sends initial connected event', () => {
      SSEHelper.initializeSSE(mockRes, 'client-123');

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('event: connected')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"clientId":"client-123"')
      );
    });

    it('starts heartbeat interval', () => {
      SSEHelper.initializeSSE(mockRes, 'client-123');

      expect(SSEHelper.heartbeats.has('client-123')).toBe(true);
    });

    it('sends heartbeat at regular intervals', () => {
      SSEHelper.initializeSSE(mockRes, 'client-123');

      // Clear initial writes
      mockRes.write.mockClear();

      // Fast-forward 15 seconds
      jest.advanceTimersByTime(15000);

      expect(mockRes.write).toHaveBeenCalledWith(': heartbeat\n\n');
    });

    it('sends multiple heartbeats over time', () => {
      SSEHelper.initializeSSE(mockRes, 'client-123');
      mockRes.write.mockClear();

      // Fast-forward 45 seconds (3 heartbeats)
      jest.advanceTimersByTime(45000);

      expect(mockRes.write).toHaveBeenCalledTimes(3);
    });

    it('handles client disconnect gracefully', () => {
      SSEHelper.initializeSSE(mockRes, 'client-123');

      // Simulate client disconnect
      const closeHandler = mockRes.on.mock.calls.find(call => call[0] === 'close')?.[1];
      expect(closeHandler).toBeDefined();

      closeHandler();

      expect(SSEHelper.heartbeats.has('client-123')).toBe(false);
    });
  });

  describe('sendEvent', () => {
    it('sends event with correct format', () => {
      SSEHelper.sendEvent(mockRes, 'test-event', { message: 'Hello' });

      expect(mockRes.write).toHaveBeenCalledWith('event: test-event\n');
      expect(mockRes.write).toHaveBeenCalledWith('data: {"message":"Hello"}\n\n');
    });

    it('sends event with string data', () => {
      SSEHelper.sendEvent(mockRes, 'message', 'Simple string');

      expect(mockRes.write).toHaveBeenCalledWith('event: message\n');
      expect(mockRes.write).toHaveBeenCalledWith('data: "Simple string"\n\n');
    });

    it('sends event with number data', () => {
      SSEHelper.sendEvent(mockRes, 'count', 42);

      expect(mockRes.write).toHaveBeenCalledWith('data: 42\n\n');
    });

    it('sends event with array data', () => {
      SSEHelper.sendEvent(mockRes, 'items', [1, 2, 3]);

      expect(mockRes.write).toHaveBeenCalledWith('data: [1,2,3]\n\n');
    });

    it('sends event with nested object data', () => {
      const data = {
        user: { name: 'John', age: 30 },
        items: [{ id: 1 }, { id: 2 }]
      };

      SSEHelper.sendEvent(mockRes, 'complex', data);

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"user":{"name":"John","age":30}')
      );
    });

    it('handles null data', () => {
      SSEHelper.sendEvent(mockRes, 'null-event', null);

      expect(mockRes.write).toHaveBeenCalledWith('data: null\n\n');
    });

    it('handles undefined data', () => {
      SSEHelper.sendEvent(mockRes, 'undefined-event', undefined);

      expect(mockRes.write).toHaveBeenCalledWith('data: \n\n');
    });
  });

  describe('sendTextChunk', () => {
    it('sends text chunk with correct event type', () => {
      SSEHelper.sendTextChunk(mockRes, 'Hello world');

      expect(mockRes.write).toHaveBeenCalledWith(`event: ${SSE_EVENTS.TEXT}\n`);
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"content":"Hello world"')
      );
    });

    it('handles empty text', () => {
      SSEHelper.sendTextChunk(mockRes, '');

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"content":""')
      );
    });

    it('handles special characters in text', () => {
      SSEHelper.sendTextChunk(mockRes, 'Text with "quotes" and \n newlines');

      expect(mockRes.write).toHaveBeenCalled();
    });
  });

  describe('sendAudioChunk', () => {
    it('sends audio chunk with sequence number', () => {
      const audioData = 'base64encodedaudio';

      SSEHelper.sendAudioChunk(mockRes, audioData, 1);

      expect(mockRes.write).toHaveBeenCalledWith(`event: ${SSE_EVENTS.AUDIO}\n`);
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"chunk":"base64encodedaudio"')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"sequence":1')
      );
    });

    it('handles multiple audio chunks with incrementing sequence', () => {
      SSEHelper.sendAudioChunk(mockRes, 'audio1', 1);
      SSEHelper.sendAudioChunk(mockRes, 'audio2', 2);
      SSEHelper.sendAudioChunk(mockRes, 'audio3', 3);

      expect(mockRes.write).toHaveBeenCalledTimes(6); // 2 writes per chunk
    });
  });

  describe('sendSuggestions', () => {
    it('sends suggestions array', () => {
      const suggestions = [
        'Tell me more',
        'What are the benefits?',
        'How much does it cost?'
      ];

      SSEHelper.sendSuggestions(mockRes, suggestions);

      expect(mockRes.write).toHaveBeenCalledWith(`event: ${SSE_EVENTS.SUGGESTIONS}\n`);
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"suggestions":["Tell me more"')
      );
    });

    it('handles empty suggestions array', () => {
      SSEHelper.sendSuggestions(mockRes, []);

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"suggestions":[]')
      );
    });
  });

  describe('sendMetadata', () => {
    it('sends metadata object', () => {
      const metadata = {
        sessionId: 'sess-123',
        intent: 'product_inquiry',
        language: 'en-IN'
      };

      SSEHelper.sendMetadata(mockRes, metadata);

      expect(mockRes.write).toHaveBeenCalledWith(`event: ${SSE_EVENTS.METADATA}\n`);
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"sessionId":"sess-123"')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"intent":"product_inquiry"')
      );
    });
  });

  describe('sendStatus', () => {
    it('sends status update', () => {
      SSEHelper.sendStatus(mockRes, 'processing', 'Analyzing your query...');

      expect(mockRes.write).toHaveBeenCalledWith(`event: ${SSE_EVENTS.STATUS}\n`);
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"status":"processing"')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Analyzing your query..."')
      );
    });
  });

  describe('sendWarning', () => {
    it('sends warning message', () => {
      SSEHelper.sendWarning(mockRes, 'TTS unavailable, text-only response');

      expect(mockRes.write).toHaveBeenCalledWith(`event: ${SSE_EVENTS.WARNING}\n`);
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"warning":"TTS unavailable, text-only response"')
      );
    });
  });

  describe('sendError', () => {
    it('sends error message', () => {
      SSEHelper.sendError(mockRes, 'Failed to process query');

      expect(mockRes.write).toHaveBeenCalledWith(`event: ${SSE_EVENTS.ERROR}\n`);
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Failed to process query"')
      );
    });

    it('sends error with error code', () => {
      SSEHelper.sendError(mockRes, 'Rate limit exceeded', 'RATE_LIMIT');

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Rate limit exceeded"')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"code":"RATE_LIMIT"')
      );
    });
  });

  describe('sendComplete', () => {
    it('sends completion event with metadata', () => {
      const completionData = {
        sessionId: 'sess-123',
        totalTokens: 250,
        duration: 1500
      };

      SSEHelper.sendComplete(mockRes, completionData);

      expect(mockRes.write).toHaveBeenCalledWith(`event: ${SSE_EVENTS.COMPLETE}\n`);
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"sessionId":"sess-123"')
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining('"totalTokens":250')
      );
    });

    it('handles completion with minimal data', () => {
      SSEHelper.sendComplete(mockRes, {});

      expect(mockRes.write).toHaveBeenCalledWith(`event: ${SSE_EVENTS.COMPLETE}\n`);
    });
  });

  describe('closeConnection', () => {
    it('sends close event and ends response', () => {
      SSEHelper.initializeSSE(mockRes, 'client-123');

      SSEHelper.closeConnection(mockRes, 'client-123');

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(`event: ${SSE_EVENTS.CLOSE}`)
      );
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('clears heartbeat interval', () => {
      SSEHelper.initializeSSE(mockRes, 'client-123');

      expect(SSEHelper.heartbeats.has('client-123')).toBe(true);

      SSEHelper.closeConnection(mockRes, 'client-123');

      expect(SSEHelper.heartbeats.has('client-123')).toBe(false);
    });

    it('handles closing non-existent client gracefully', () => {
      expect(() => {
        SSEHelper.closeConnection(mockRes, 'non-existent-client');
      }).not.toThrow();

      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('Streaming scenario integration', () => {
    it('handles complete streaming flow', () => {
      // Initialize
      SSEHelper.initializeSSE(mockRes, 'client-123');
      mockRes.write.mockClear();

      // Send metadata
      SSEHelper.sendMetadata(mockRes, { intent: 'sales_inquiry' });

      // Send text chunks
      SSEHelper.sendTextChunk(mockRes, 'Hello');
      SSEHelper.sendTextChunk(mockRes, ' world');
      SSEHelper.sendTextChunk(mockRes, '!');

      // Send audio chunks
      SSEHelper.sendAudioChunk(mockRes, 'audio1', 1);
      SSEHelper.sendAudioChunk(mockRes, 'audio2', 2);

      // Send suggestions
      SSEHelper.sendSuggestions(mockRes, ['Tell me more']);

      // Complete
      SSEHelper.sendComplete(mockRes, { sessionId: 'sess-123' });

      // Close
      SSEHelper.closeConnection(mockRes, 'client-123');

      // Verify all events were sent
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(SSE_EVENTS.METADATA)
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(SSE_EVENTS.TEXT)
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(SSE_EVENTS.AUDIO)
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(SSE_EVENTS.SUGGESTIONS)
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(SSE_EVENTS.COMPLETE)
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(SSE_EVENTS.CLOSE)
      );
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('handles error during streaming', () => {
      SSEHelper.initializeSSE(mockRes, 'client-123');
      mockRes.write.mockClear();

      SSEHelper.sendTextChunk(mockRes, 'Starting response...');
      SSEHelper.sendError(mockRes, 'OpenAI API timeout', 'OPENAI_TIMEOUT');
      SSEHelper.closeConnection(mockRes, 'client-123');

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(SSE_EVENTS.ERROR)
      );
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('handles warning during streaming', () => {
      SSEHelper.initializeSSE(mockRes, 'client-123');
      mockRes.write.mockClear();

      SSEHelper.sendTextChunk(mockRes, 'Response text');
      SSEHelper.sendWarning(mockRes, 'TTS failed, continuing with text only');
      SSEHelper.sendComplete(mockRes, {});
      SSEHelper.closeConnection(mockRes, 'client-123');

      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(SSE_EVENTS.WARNING)
      );
      expect(mockRes.write).toHaveBeenCalledWith(
        expect.stringContaining(SSE_EVENTS.COMPLETE)
      );
    });
  });

  describe('Multiple clients', () => {
    it('manages multiple client heartbeats independently', () => {
      const mockRes1 = { ...mockRes, write: jest.fn(), writeHead: jest.fn(), on: jest.fn() };
      const mockRes2 = { ...mockRes, write: jest.fn(), writeHead: jest.fn(), on: jest.fn() };

      SSEHelper.initializeSSE(mockRes1, 'client-1');
      SSEHelper.initializeSSE(mockRes2, 'client-2');

      expect(SSEHelper.heartbeats.has('client-1')).toBe(true);
      expect(SSEHelper.heartbeats.has('client-2')).toBe(true);

      SSEHelper.closeConnection(mockRes1, 'client-1');

      expect(SSEHelper.heartbeats.has('client-1')).toBe(false);
      expect(SSEHelper.heartbeats.has('client-2')).toBe(true);
    });
  });
});
