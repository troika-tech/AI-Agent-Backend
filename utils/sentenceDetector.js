const logger = require('./logger');

/**
 * SentenceDetector
 *
 * Detects sentence boundaries in streaming text for multi-language content.
 * Handles edge cases like prices (₹25,000.), abbreviations (Mr., Dr.), and URLs.
 */
class SentenceDetector {
  constructor() {
    this.buffer = '';
    this.lastBoundaryIndex = 0;

    // Sentence-ending punctuation marks
    this.sentenceEnders = ['.', '!', '?', '।']; // Including Hindi purna viram

    // Common abbreviations that shouldn't trigger sentence breaks
    this.abbreviations = [
      'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr',
      'Ph.D', 'M.D', 'B.A', 'M.A', 'B.Sc', 'M.Sc',
      'Co', 'Ltd', 'Inc', 'Corp', 'vs', 'etc', 'e.g', 'i.e'
    ];
  }

  /**
   * Add token to buffer
   * @param {string} token - Text token from LLM stream
   */
  addToken(token) {
    if (!token) return;
    this.buffer += token;
  }

  /**
   * Check if buffer contains a complete sentence
   * @returns {boolean} True if complete sentence detected
   */
  hasCompleteSentence() {
    // Need at least some content
    if (this.buffer.length < 5) return false;

    // Look for sentence-ending punctuation
    for (const ender of this.sentenceEnders) {
      const index = this.buffer.lastIndexOf(ender);

      if (index === -1 || index <= this.lastBoundaryIndex) {
        continue;
      }

      // Check if this is a real sentence boundary
      if (this._isRealSentenceBoundary(index, ender)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract complete sentence from buffer
   * @returns {string} Complete sentence
   */
  extractSentence() {
    if (!this.hasCompleteSentence()) {
      return '';
    }

    // Find the last valid sentence boundary
    let boundaryIndex = -1;
    let boundaryChar = '';

    for (const ender of this.sentenceEnders) {
      const index = this.buffer.lastIndexOf(ender);

      if (index > boundaryIndex && this._isRealSentenceBoundary(index, ender)) {
        boundaryIndex = index;
        boundaryChar = ender;
      }
    }

    if (boundaryIndex === -1) {
      return '';
    }

    // Extract sentence (include the ending punctuation)
    const sentence = this.buffer.substring(0, boundaryIndex + 1).trim();

    // Update buffer (keep remaining text)
    this.buffer = this.buffer.substring(boundaryIndex + 1).trim();
    this.lastBoundaryIndex = 0;

    return sentence;
  }

  /**
   * Get remaining buffer content (incomplete sentence)
   * @returns {string} Remaining text
   */
  getRemainingBuffer() {
    return this.buffer.trim();
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.buffer = '';
    this.lastBoundaryIndex = 0;
  }

  /**
   * Check if punctuation mark is a real sentence boundary
   * @private
   * @param {number} index - Index of punctuation mark
   * @param {string} punctuation - Punctuation character
   * @returns {boolean} True if real boundary
   */
  _isRealSentenceBoundary(index, punctuation) {
    // Handle Hindi purna viram (always a boundary)
    if (punctuation === '।') {
      return true;
    }

    // Get context around the punctuation
    const before = this.buffer.substring(Math.max(0, index - 10), index);
    const after = this.buffer.substring(index + 1, Math.min(this.buffer.length, index + 5));

    // Check for common false positives

    // 1. Numbers/prices (₹25,000. or 3.14159)
    if (this._isNumericContext(before, after)) {
      return false;
    }

    // 2. Abbreviations (Mr. Smith, Ph.D. degree)
    if (this._isAbbreviation(before)) {
      return false;
    }

    // 3. URLs (www.example.com or http://...)
    if (this._isURL(before, after)) {
      return false;
    }

    // 4. Ellipsis (...)
    if (this._isEllipsis(before, after)) {
      return false;
    }

    // Check if followed by sentence starter (capital letter or whitespace)
    if (after.length > 0) {
      const nextChar = after.trim()[0];

      // For period, expect capital letter or nothing
      if (punctuation === '.') {
        // If followed by lowercase letter, probably not a sentence boundary
        if (nextChar && /[a-z]/.test(nextChar)) {
          return false;
        }
      }

      // For ! and ?, more lenient
      if (punctuation === '!' || punctuation === '?') {
        return true;
      }

      // For period, check if followed by capital or end of text
      if (punctuation === '.') {
        return !nextChar || /[A-Z\u0900-\u097F]/.test(nextChar); // Include Devanagari
      }
    }

    // End of buffer and ends with punctuation = sentence boundary
    if (index === this.buffer.length - 1) {
      return true;
    }

    return false;
  }

  /**
   * Check if context is numeric (prices, decimals)
   * @private
   */
  _isNumericContext(before, after) {
    // Check for currency symbols
    const currencyPattern = /[₹$€£¥][\d,]+$/;
    if (currencyPattern.test(before)) {
      return true;
    }

    // Check for decimal numbers (3.14, 1.5)
    const decimalPattern = /\d$/;
    const afterDigit = /^\d/;
    if (decimalPattern.test(before) && afterDigit.test(after)) {
      return true;
    }

    // Check for thousands separator (1,000.00)
    const thousandsPattern = /\d,\d{3}$/;
    if (thousandsPattern.test(before)) {
      return true;
    }

    return false;
  }

  /**
   * Check if context is an abbreviation
   * @private
   */
  _isAbbreviation(before) {
    // Extract last word before period
    const words = before.trim().split(/\s+/);
    const lastWord = words[words.length - 1] || '';

    // Check against known abbreviations
    return this.abbreviations.some(abbr =>
      lastWord.toLowerCase() === abbr.toLowerCase()
    );
  }

  /**
   * Check if context is a URL
   * @private
   */
  _isURL(before, after) {
    // Check for common URL patterns
    const urlPatterns = [
      /https?:\/\/[^\s]*$/i,  // http:// or https://
      /www\.[^\s]*$/i,         // www.
      /[a-z0-9-]+\.[a-z]{2,}$/i // domain.com
    ];

    return urlPatterns.some(pattern => pattern.test(before + after));
  }

  /**
   * Check if context is an ellipsis
   * @private
   */
  _isEllipsis(before, after) {
    // Check for ... or ..
    const ellipsisPattern = /\.{2,}$/;
    return ellipsisPattern.test(before) || /^\./.test(after);
  }

  /**
   * Detect if text contains multi-sentence content
   * @param {string} text - Text to analyze
   * @returns {number} Estimated sentence count
   */
  static estimateSentenceCount(text) {
    if (!text) return 0;

    // Count sentence-ending punctuation
    const enders = ['.', '!', '?', '।'];
    let count = 0;

    for (const char of text) {
      if (enders.includes(char)) {
        count++;
      }
    }

    // Adjust for common false positives (rough estimate)
    return Math.max(1, Math.floor(count * 0.8));
  }

  /**
   * Split text into sentences (for batch processing)
   * @param {string} text - Text to split
   * @returns {Array<string>} Array of sentences
   */
  static splitIntoSentences(text) {
    const detector = new SentenceDetector();
    const sentences = [];

    // Add text token by token (simulating streaming)
    for (const char of text) {
      detector.addToken(char);

      if (detector.hasCompleteSentence()) {
        const sentence = detector.extractSentence();
        if (sentence) {
          sentences.push(sentence);
        }
      }
    }

    // Get any remaining text
    const remaining = detector.getRemainingBuffer();
    if (remaining) {
      sentences.push(remaining);
    }

    return sentences;
  }

  /**
   * Get statistics about current buffer
   * @returns {Object} Buffer statistics
   */
  getStats() {
    return {
      bufferLength: this.buffer.length,
      hasContent: this.buffer.length > 0,
      estimatedSentences: SentenceDetector.estimateSentenceCount(this.buffer)
    };
  }
}

module.exports = SentenceDetector;
