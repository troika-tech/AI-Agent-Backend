const SentenceDetector = require('../utils/sentenceDetector');

describe('SentenceDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new SentenceDetector();
  });

  describe('addToken', () => {
    it('adds single token to buffer', () => {
      detector.addToken('Hello');
      expect(detector.buffer).toBe('Hello');
    });

    it('accumulates multiple tokens', () => {
      detector.addToken('Hello');
      detector.addToken(' ');
      detector.addToken('world');
      expect(detector.buffer).toBe('Hello world');
    });

    it('handles empty tokens', () => {
      detector.addToken('Hello');
      detector.addToken('');
      detector.addToken('world');
      expect(detector.buffer).toBe('Helloworld');
    });
  });

  describe('hasCompleteSentence - English', () => {
    it('detects period as sentence boundary', () => {
      detector.addToken('Hello world.');
      expect(detector.hasCompleteSentence()).toBe(true);
    });

    it('detects question mark as sentence boundary', () => {
      detector.addToken('How are you?');
      expect(detector.hasCompleteSentence()).toBe(true);
    });

    it('detects exclamation mark as sentence boundary', () => {
      detector.addToken('Great news!');
      expect(detector.hasCompleteSentence()).toBe(true);
    });

    it('returns false for incomplete sentence', () => {
      detector.addToken('Hello world');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('detects sentence with space after punctuation', () => {
      detector.addToken('Hello world. ');
      expect(detector.hasCompleteSentence()).toBe(true);
    });

    it('handles multiple sentences in buffer', () => {
      detector.addToken('First sentence. Second sentence.');
      expect(detector.hasCompleteSentence()).toBe(true);
    });
  });

  describe('hasCompleteSentence - Hindi', () => {
    it('detects Hindi purna viram (।) as sentence boundary', () => {
      detector.addToken('नमस्ते।');
      expect(detector.hasCompleteSentence()).toBe(true);
    });

    it('detects Hindi question mark', () => {
      detector.addToken('आप कैसे हैं?');
      expect(detector.hasCompleteSentence()).toBe(true);
    });

    it('handles mixed Hindi-English (Hinglish)', () => {
      detector.addToken('Hello kaise ho।');
      expect(detector.hasCompleteSentence()).toBe(true);
    });
  });

  describe('Edge cases - Abbreviations', () => {
    it('does not split on Mr.', () => {
      detector.addToken('Hello Mr. Smith');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('does not split on Dr.', () => {
      detector.addToken('Dr. Johnson is here');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('does not split on Mrs.', () => {
      detector.addToken('Mrs. Brown called');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('does not split on Ms.', () => {
      detector.addToken('Ms. Taylor arrived');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('does not split on Prof.', () => {
      detector.addToken('Prof. Williams teaches');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('detects sentence after abbreviation', () => {
      detector.addToken('Hello Mr. Smith. How are you?');
      expect(detector.hasCompleteSentence()).toBe(true);
    });
  });

  describe('Edge cases - Numbers and prices', () => {
    it('does not split on decimal numbers', () => {
      detector.addToken('The value is 3.14 here');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('does not split on prices with rupee symbol', () => {
      detector.addToken('The cost is ₹1,234.56 only');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('does not split on prices with dollar symbol', () => {
      detector.addToken('Price is $99.99 today');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('does not split on lakhs format', () => {
      detector.addToken('Amount is ₹25,000.00 exactly');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('detects sentence after price', () => {
      detector.addToken('The price is ₹1,234.56. Buy now!');
      expect(detector.hasCompleteSentence()).toBe(true);
    });
  });

  describe('Edge cases - URLs and email', () => {
    it('does not split on URLs with dots', () => {
      detector.addToken('Visit example.com for details');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('does not split on email addresses', () => {
      detector.addToken('Contact us at info@example.com here');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('does not split on www URLs', () => {
      detector.addToken('Check www.example.com today');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('detects sentence after URL', () => {
      detector.addToken('Visit example.com. Get more info.');
      expect(detector.hasCompleteSentence()).toBe(true);
    });
  });

  describe('Edge cases - Ellipsis', () => {
    it('does not split on ellipsis (...)', () => {
      detector.addToken('Wait for it...');
      expect(detector.hasCompleteSentence()).toBe(false);
    });

    it('detects sentence after ellipsis with space', () => {
      detector.addToken('Wait... Now start!');
      expect(detector.hasCompleteSentence()).toBe(true);
    });
  });

  describe('extractSentence', () => {
    it('extracts complete sentence and updates buffer', () => {
      detector.addToken('First sentence. Second part');

      const sentence = detector.extractSentence();

      expect(sentence).toBe('First sentence.');
      expect(detector.buffer).toBe('Second part');
    });

    it('extracts sentence with question mark', () => {
      detector.addToken('Is this working? Yes it is');

      const sentence = detector.extractSentence();

      expect(sentence).toBe('Is this working?');
      expect(detector.buffer).toBe('Yes it is');
    });

    it('extracts sentence with exclamation', () => {
      detector.addToken('Amazing! Tell me more');

      const sentence = detector.extractSentence();

      expect(sentence).toBe('Amazing!');
      expect(detector.buffer).toBe('Tell me more');
    });

    it('extracts Hindi sentence with purna viram', () => {
      detector.addToken('नमस्ते। कैसे हो');

      const sentence = detector.extractSentence();

      expect(sentence).toBe('नमस्ते।');
      expect(detector.buffer).toBe('कैसे हो');
    });

    it('trims whitespace from extracted sentence', () => {
      detector.addToken('Hello world.  ');

      const sentence = detector.extractSentence();

      expect(sentence).toBe('Hello world.');
    });

    it('trims whitespace from remaining buffer', () => {
      detector.addToken('First.   Second');

      detector.extractSentence();

      expect(detector.buffer).toBe('Second');
    });

    it('handles multiple sentence boundaries correctly', () => {
      detector.addToken('First. Second. Third');

      // extractSentence() uses lastIndexOf, so it extracts up to the last boundary
      const first = detector.extractSentence();
      expect(first).toBe('First. Second.');
      expect(detector.buffer).toBe('Third');
    });

    it('returns empty string when no complete sentence', () => {
      detector.addToken('Incomplete sentence');

      const sentence = detector.extractSentence();

      expect(sentence).toBe('');
      expect(detector.buffer).toBe('Incomplete sentence');
    });

    it('does not extract on abbreviations', () => {
      detector.addToken('Hello Mr. Smith is here');

      const sentence = detector.extractSentence();

      expect(sentence).toBe('');
      expect(detector.buffer).toBe('Hello Mr. Smith is here');
    });

    it('does not extract on decimal numbers', () => {
      detector.addToken('Value is 3.14 pi');

      const sentence = detector.extractSentence();

      expect(sentence).toBe('');
      expect(detector.buffer).toBe('Value is 3.14 pi');
    });
  });

  describe('clear', () => {
    it('clears the buffer', () => {
      detector.addToken('Hello world.');
      detector.clear();

      expect(detector.buffer).toBe('');
    });

    it('allows fresh detection after clear', () => {
      detector.addToken('First sentence.');
      detector.clear();
      detector.addToken('Second sentence.');

      expect(detector.hasCompleteSentence()).toBe(true);
      expect(detector.extractSentence()).toBe('Second sentence.');
    });
  });

  describe('getRemainingBuffer', () => {
    it('returns current buffer contents', () => {
      detector.addToken('Incomplete text');

      expect(detector.getRemainingBuffer()).toBe('Incomplete text');
    });

    it('returns empty string for empty buffer', () => {
      expect(detector.getRemainingBuffer()).toBe('');
    });

    it('does not modify buffer', () => {
      detector.addToken('Test');
      detector.getRemainingBuffer();

      expect(detector.buffer).toBe('Test');
    });
  });

  describe('Streaming scenarios', () => {
    it('handles token-by-token streaming', () => {
      const tokens = ['Hello', ' ', 'world', '.', ' ', 'How', ' ', 'are', ' ', 'you', '?'];

      tokens.forEach(token => {
        detector.addToken(token);
      });

      // Due to lastIndexOf, extracts up to the last boundary
      expect(detector.hasCompleteSentence()).toBe(true);
      const extracted = detector.extractSentence();
      // Should extract both sentences since lastIndexOf finds the '?'
      expect(extracted).toBe('Hello world. How are you?');
      expect(detector.buffer).toBe('');
    });

    it('handles partial punctuation tokens', () => {
      detector.addToken('Hello world');
      expect(detector.hasCompleteSentence()).toBe(false);

      detector.addToken('.');
      expect(detector.hasCompleteSentence()).toBe(true);
    });

    it('handles real-world streaming with abbreviation', () => {
      const tokens = ['Meet', ' ', 'Dr', '.', ' ', 'Smith', '.', ' ', 'He', ' ', 'helps', '.'];

      tokens.forEach(token => detector.addToken(token));

      // Due to lastIndexOf, extracts up to last boundary
      // The implementation checks abbreviations, so "Dr." won't be considered a boundary
      // But "Smith." and "helps." will be, and lastIndexOf finds "helps."
      const extracted = detector.extractSentence();
      expect(extracted).toBe('Meet Dr. Smith. He helps.');
      expect(detector.buffer).toBe('');
    });

    it('handles price in streaming context', () => {
      const tokens = ['Cost', ' ', 'is', ' ', '₹', '1', ',', '234', '.', '56', '.', ' ', 'Buy', ' ', 'now', '.'];

      tokens.forEach(token => detector.addToken(token));

      // lastIndexOf extracts to the last boundary
      const extracted = detector.extractSentence();
      expect(extracted).toBe('Cost is ₹1,234.56. Buy now.');
      expect(detector.buffer).toBe('');
    });
  });

  describe('Complex real-world cases', () => {
    it('handles business communication with prices and abbreviations', () => {
      const text = 'Dear Mr. Sharma, the total cost is ₹25,000.50. Please confirm by visiting www.example.com. Thank you!';
      detector.addToken(text);

      // lastIndexOf extracts up to the last boundary (!)
      const extracted = detector.extractSentence();
      expect(extracted).toBe('Dear Mr. Sharma, the total cost is ₹25,000.50. Please confirm by visiting www.example.com. Thank you!');
    });

    it('handles technical content with decimals', () => {
      const text = 'The value of pi is 3.14159. This is important. Remember it.';
      detector.addToken(text);

      // lastIndexOf extracts to the last period
      const extracted = detector.extractSentence();
      expect(extracted).toBe('The value of pi is 3.14159. This is important. Remember it.');
    });

    it('handles Hinglish mixed content', () => {
      const text = 'Hello, aap kaise ho? Main theek hoon। Price is ₹500. Thank you!';
      detector.addToken(text);

      // Should extract everything up to the last punctuation
      expect(detector.hasCompleteSentence()).toBe(true);
      const extracted = detector.extractSentence();
      expect(extracted.length).toBeGreaterThan(0);
    });
  });
});
