/**
 * SSE Event Types
 *
 * Constants for Server-Sent Events used in streaming responses.
 */

const SSE_EVENTS = {
  // Connection lifecycle
  CONNECTED: 'connected',      // Initial connection established
  CLOSE: 'close',             // Connection closing

  // Content streaming
  TEXT: 'text',               // Text chunk streamed
  AUDIO: 'audio',             // Audio chunk ready
  SUGGESTIONS: 'suggestions', // Follow-up questions

  // Metadata and status
  METADATA: 'metadata',       // Response metadata (intent, intelligence level, etc.)
  STATUS: 'status',          // Processing status updates

  // Completion
  COMPLETE: 'complete',       // Stream finished successfully

  // Errors and warnings
  WARNING: 'warning',         // Non-fatal issues (e.g., TTS unavailable)
  ERROR: 'error'             // Fatal errors
};

/**
 * Get description for event type
 * @param {string} eventType - Event type constant
 * @returns {string} Human-readable description
 */
function getEventDescription(eventType) {
  const descriptions = {
    [SSE_EVENTS.CONNECTED]: 'Initial SSE connection established with client',
    [SSE_EVENTS.TEXT]: 'Text content chunk streamed from LLM',
    [SSE_EVENTS.AUDIO]: 'Audio chunk generated and ready for playback',
    [SSE_EVENTS.SUGGESTIONS]: 'Follow-up question suggestions generated',
    [SSE_EVENTS.METADATA]: 'Response metadata (intent, intelligence level, etc.)',
    [SSE_EVENTS.STATUS]: 'Processing status update (e.g., "Generating response...")',
    [SSE_EVENTS.COMPLETE]: 'Stream completed successfully',
    [SSE_EVENTS.WARNING]: 'Non-fatal issue occurred (e.g., audio unavailable)',
    [SSE_EVENTS.ERROR]: 'Fatal error occurred, stream terminated',
    [SSE_EVENTS.CLOSE]: 'Connection closing gracefully'
  };

  return descriptions[eventType] || 'Unknown event type';
}

/**
 * Check if event type is valid
 * @param {string} eventType - Event type to validate
 * @returns {boolean} True if valid
 */
function isValidEventType(eventType) {
  return Object.values(SSE_EVENTS).includes(eventType);
}

module.exports = {
  SSE_EVENTS,
  getEventDescription,
  isValidEventType
};
