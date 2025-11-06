// tests/typingIndicator.test.js
const { calculateTypingDelay, calculateTypingDelayCustom, getTypingIndicatorMetadata } = require('../utils/typingIndicator');

describe('Typing Indicator Utility', () => {
  
  describe('calculateTypingDelay', () => {
    
    test('should return minimum delay for very short messages', () => {
      const delay = calculateTypingDelay('Hi');
      expect(delay).toBeGreaterThanOrEqual(500);
      expect(delay).toBeLessThanOrEqual(3000);
    });

    test('should return appropriate delay for medium messages', () => {
      const message = 'Our service offers 24/7 support with AI-powered chatbots.';
      const delay = calculateTypingDelay(message);
      expect(delay).toBeGreaterThan(500);
      expect(delay).toBeLessThan(3000);
    });

    test('should cap at maximum delay for very long messages', () => {
      const longMessage = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);
      const delay = calculateTypingDelay(longMessage);
      expect(delay).toBeLessThanOrEqual(3000);
    });

    test('should handle empty string gracefully', () => {
      const delay = calculateTypingDelay('');
      expect(delay).toBe(500); // Returns minimum
    });

    test('should handle null/undefined gracefully', () => {
      expect(calculateTypingDelay(null)).toBe(500);
      expect(calculateTypingDelay(undefined)).toBe(500);
    });

    test('should return consistent results for same input', () => {
      const message = 'Test message for consistency check';
      const delay1 = calculateTypingDelay(message);
      const delay2 = calculateTypingDelay(message);
      expect(delay1).toBe(delay2);
    });

    test('should increase delay with message length', () => {
      const short = calculateTypingDelay('Hello');
      const medium = calculateTypingDelay('Hello, how can I help you today?');
      const long = calculateTypingDelay('Hello, how can I help you today? I am here to assist with any questions you might have about our services.');
      
      expect(medium).toBeGreaterThanOrEqual(short);
      expect(long).toBeGreaterThanOrEqual(medium);
    });
  });

  describe('calculateTypingDelayCustom', () => {
    
    test('should respect custom min delay', () => {
      const delay = calculateTypingDelayCustom('Hi', { minDelay: 1000 });
      expect(delay).toBeGreaterThanOrEqual(1000);
    });

    test('should respect custom max delay', () => {
      const longMessage = 'Lorem ipsum dolor sit amet. '.repeat(20);
      const delay = calculateTypingDelayCustom(longMessage, { maxDelay: 2000 });
      expect(delay).toBeLessThanOrEqual(2000);
    });

    test('should use custom words per minute', () => {
      const message = 'Hello world from typing test';
      const slow = calculateTypingDelayCustom(message, { wordsPerMinute: 40, maxDelay: 5000 });
      const fast = calculateTypingDelayCustom(message, { wordsPerMinute: 120, maxDelay: 5000 });
      
      expect(slow).toBeGreaterThan(fast);
    });

    test('should handle custom base delay', () => {
      const message = 'Test';
      const noBase = calculateTypingDelayCustom(message, { baseDelay: 0, minDelay: 0 });
      const withBase = calculateTypingDelayCustom(message, { baseDelay: 1000 });
      
      expect(withBase).toBeGreaterThan(noBase);
    });
  });

  describe('getTypingIndicatorMetadata', () => {
    
    test('should return valid metadata structure', () => {
      const message = 'Hello, how can I help you?';
      const metadata = getTypingIndicatorMetadata(message);
      
      expect(metadata).toHaveProperty('totalDelay');
      expect(metadata).toHaveProperty('chunks');
      expect(metadata).toHaveProperty('estimatedDuration');
      expect(metadata).toHaveProperty('messageLength');
      expect(metadata).toHaveProperty('chunkCount');
    });

    test('should create appropriate chunks', () => {
      const message = 'A'.repeat(100);
      const metadata = getTypingIndicatorMetadata(message, 25);
      
      expect(metadata.chunks.length).toBe(4); // 100 chars / 25 chunk size
      expect(metadata.chunkCount).toBe(4);
    });

    test('should have valid chunk structure', () => {
      const message = 'Hello world';
      const metadata = getTypingIndicatorMetadata(message, 5);
      
      metadata.chunks.forEach(chunk => {
        expect(chunk).toHaveProperty('text');
        expect(chunk).toHaveProperty('delay');
        expect(chunk).toHaveProperty('startPos');
        expect(chunk).toHaveProperty('endPos');
        expect(typeof chunk.delay).toBe('number');
      });
    });

    test('should handle empty message', () => {
      const metadata = getTypingIndicatorMetadata('');
      expect(metadata.chunks).toHaveLength(0);
      expect(metadata.totalDelay).toBe(500);
    });
  });

  describe('Real-world scenarios', () => {
    
    test('should handle typical chatbot response', () => {
      const response = 'I can help you with that! Our pricing plans start at ₹999 per month. Would you like to see the details?';
      const delay = calculateTypingDelay(response);
      
      expect(delay).toBeGreaterThan(500);
      expect(delay).toBeLessThanOrEqual(3000);
    });

    test('should handle technical response with numbers', () => {
      const response = 'Product ID: 12345, Price: ₹2,499, Available in sizes: S, M, L, XL. In stock: Yes.';
      const delay = calculateTypingDelay(response);
      
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(3000);
    });

    test('should handle multilingual content', () => {
      const response = 'हमारी सेवा 24/7 उपलब्ध है। Our service is available 24/7.';
      const delay = calculateTypingDelay(response);
      
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(3000);
    });

    test('should handle response with links', () => {
      const response = 'Check out more details here: https://example.com/pricing. Let me know if you need help!';
      const delay = calculateTypingDelay(response);
      
      expect(delay).toBeGreaterThan(500);
    });
  });

  describe('Performance', () => {
    
    test('should execute quickly', () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        calculateTypingDelay('Test message for performance check');
      }
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // Should process 1000 calls in <100ms
    });

    test('should handle very long messages efficiently', () => {
      const veryLongMessage = 'Lorem ipsum dolor sit amet. '.repeat(1000);
      const start = Date.now();
      calculateTypingDelay(veryLongMessage);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(10); // Should be instant
    });
  });
});
