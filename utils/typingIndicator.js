// utils/typingIndicator.js
// Calculate realistic typing delay based on message length

/**
 * Calculate typing delay in milliseconds based on message length
 * Simulates realistic human typing/reading speed
 * 
 * @param {string} message - The message text
 * @returns {number} - Typing delay in milliseconds
 */
function calculateTypingDelay(message) {
  if (!message || typeof message !== 'string') {
    return 500; // Minimum delay
  }

  // Average reading speed: 200-250 words per minute
  // Average word length: 5 characters
  // Formula: (characters / 5 words) / (225 words/min) * 60000 ms
  
  const characters = message.length;
  const words = characters / 5; // Estimate word count
  const readingTimeMs = (words / 225) * 60000; // Time to read at 225 wpm
  
  // Add base processing delay (bot "thinks" before typing)
  const baseDelay = 800;
  
  // Calculate total delay (reading time * 0.4 for typing simulation)
  let totalDelay = baseDelay + (readingTimeMs * 0.4);
  
  // Apply constraints
  const minDelay = 500;   // Minimum 0.5 seconds
  const maxDelay = 3000;  // Maximum 3 seconds (avoid too long waits)
  
  totalDelay = Math.max(minDelay, Math.min(totalDelay, maxDelay));
  
  return Math.round(totalDelay);
}

/**
 * Calculate typing delay with custom parameters
 * 
 * @param {string} message - The message text
 * @param {Object} options - Configuration options
 * @param {number} options.minDelay - Minimum delay in ms (default: 500)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 3000)
 * @param {number} options.wordsPerMinute - Typing speed (default: 90)
 * @param {number} options.baseDelay - Base processing delay (default: 800)
 * @returns {number} - Typing delay in milliseconds
 */
function calculateTypingDelayCustom(message, options = {}) {
  const {
    minDelay = 500,
    maxDelay = 3000,
    wordsPerMinute = 90, // Average human typing speed
    baseDelay = 800
  } = options;

  if (!message || typeof message !== 'string') {
    return minDelay;
  }

  const characters = message.length;
  const words = characters / 5;
  const typingTimeMs = (words / wordsPerMinute) * 60000;
  
  let totalDelay = baseDelay + typingTimeMs;
  totalDelay = Math.max(minDelay, Math.min(totalDelay, maxDelay));
  
  return Math.round(totalDelay);
}

/**
 * Get typing indicator metadata for streaming
 * Breaks message into chunks for progressive display
 * 
 * @param {string} message - The message text
 * @param {number} chunkSize - Characters per chunk (default: 50)
 * @returns {Object} - Typing indicator metadata
 */
function getTypingIndicatorMetadata(message, chunkSize = 50) {
  if (!message || typeof message !== 'string') {
    return {
      totalDelay: 500,
      chunks: [],
      estimatedDuration: 500
    };
  }

  const chunks = [];
  let currentPos = 0;
  
  while (currentPos < message.length) {
    const chunk = message.slice(currentPos, currentPos + chunkSize);
    const delay = calculateTypingDelay(chunk);
    chunks.push({
      text: chunk,
      delay,
      startPos: currentPos,
      endPos: currentPos + chunk.length
    });
    currentPos += chunkSize;
  }

  const totalDelay = calculateTypingDelay(message);
  const estimatedDuration = chunks.reduce((sum, chunk) => sum + chunk.delay, 0);

  return {
    totalDelay,
    chunks,
    estimatedDuration,
    messageLength: message.length,
    chunkCount: chunks.length
  };
}

module.exports = {
  calculateTypingDelay,
  calculateTypingDelayCustom,
  getTypingIndicatorMetadata
};
