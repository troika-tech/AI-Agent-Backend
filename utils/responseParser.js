/**
 * Response Parser Utility
 *
 * Handles extraction and cleaning of LLM responses:
 * - Extract [KBQ: keywords] tags for follow-up context
 * - Clean answers (remove tags visible to users)
 * - Prepare messages for history storage
 */

const logger = require('./logger');

// Regex patterns
const KBQ_TAG_REGEX = /\[KBQ:\s*([^\]]+)\]/i;
const SUGGESTIONS_TAG_REGEX = /\[SUGGESTIONS:\s*([^\]]+)\]/i;

/**
 * Extract KBQ tag from bot message
 * Returns keywords string or null if not found
 *
 * @param {string} text - Bot response text
 * @returns {string|null} - Extracted keywords or null
 */
function extractKbqTag(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const match = KBQ_TAG_REGEX.exec(text);
  if (match && match[1]) {
    const keywords = match[1].trim();
    logger.info(`[KBQ EXTRACT] Found keywords: "${keywords}"`);
    return keywords;
  }

  logger.debug(`[KBQ EXTRACT] No KBQ tag found in: "${text.substring(0, 100)}..."`);
  return null;
}

/**
 * Extract suggestion buttons from bot message
 * Returns array of suggestions or empty array
 *
 * @param {string} text - Bot response text
 * @returns {string[]} - Array of suggestion questions
 */
function extractSuggestions(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const match = SUGGESTIONS_TAG_REGEX.exec(text);
  if (!match || !match[1]) {
    return [];
  }

  try {
    // Extract suggestions and split by delimiter (| or ;)
    const suggestionsStr = match[1].trim();
    const suggestions = suggestionsStr
      .split(/\||;/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= 150) // Reasonable length
      .slice(0, 3); // Max 3 suggestions

    logger.info(`[SUGGESTIONS EXTRACT] Found ${suggestions.length} suggestions`);
    return suggestions;
  } catch (err) {
    logger.warn(`[SUGGESTIONS EXTRACT] Failed to parse: ${err.message}`);
    return [];
  }
}

/**
 * Clean answer for user display
 * Removes all hidden tags ([KBQ:...], [SUGGESTIONS:...], etc.)
 *
 * @param {string} answer - Raw bot response
 * @returns {string} - Cleaned answer
 */
function cleanAnswer(answer) {
  if (!answer || typeof answer !== 'string') {
    return '';
  }

  return answer
    .replace(KBQ_TAG_REGEX, '') // Remove [KBQ: keywords]
    .replace(SUGGESTIONS_TAG_REGEX, '') // Remove [SUGGESTIONS: ...]
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Prepare assistant message for conversation history
 * Keeps KBQ tag but removes suggestion tags
 *
 * @param {string} answer - Raw bot response
 * @returns {string} - Message for history storage
 */
function prepareMessageForHistory(answer) {
  if (!answer || typeof answer !== 'string') {
    return '';
  }

  // Keep KBQ tag (needed for follow-up detection)
  // Remove suggestion tags (not needed in history)
  return answer
    .replace(SUGGESTIONS_TAG_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse complete LLM response
 * Extracts all metadata and prepares cleaned versions
 *
 * @param {string} rawAnswer - Raw LLM response
 * @returns {object} - Parsed response object
 */
function parseResponse(rawAnswer) {
  if (!rawAnswer || typeof rawAnswer !== 'string') {
    logger.warn('[RESPONSE PARSE] Empty or invalid response');
    return {
      cleanAnswer: '',
      assistantMessageForHistory: '',
      kbFollowUpQuery: null,
      suggestions: [],
    };
  }

  // Extract metadata
  const kbFollowUpQuery = extractKbqTag(rawAnswer);
  const suggestions = extractSuggestions(rawAnswer);

  // Prepare cleaned versions
  const cleanedAnswer = cleanAnswer(rawAnswer);
  const historyMessage = prepareMessageForHistory(rawAnswer);

  logger.info(`[RESPONSE PARSE] Completed:`, {
    originalLength: rawAnswer.length,
    cleanedLength: cleanedAnswer.length,
    hasKbqTag: !!kbFollowUpQuery,
    suggestionsCount: suggestions.length,
  });

  return {
    cleanAnswer: cleanedAnswer,
    assistantMessageForHistory: historyMessage,
    kbFollowUpQuery,
    suggestions,
  };
}

module.exports = {
  extractKbqTag,
  extractSuggestions,
  cleanAnswer,
  prepareMessageForHistory,
  parseResponse,
  KBQ_TAG_REGEX,
  SUGGESTIONS_TAG_REGEX,
};
