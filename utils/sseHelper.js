const logger = require('./logger');

/**
 * SSEHelper
 *
 * Utility for managing Server-Sent Events (SSE) connections.
 * Handles connection initialization, event transmission, heartbeats, and cleanup.
 */
class SSEHelper {
  /**
   * Initialize SSE connection with proper headers and heartbeat
   * @param {Response} res - Express response object
   * @param {string} clientId - Unique client identifier
   * @returns {NodeJS.Timer} Heartbeat interval (for cleanup)
   */
  static initializeSSE(res, clientId) {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Access-Control-Allow-Origin': '*', // CORS for SSE
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    // Send initial connection event
    this.sendEvent(res, 'connected', {
      clientId,
      timestamp: Date.now(),
      message: 'SSE connection established'
    });

    // Setup heartbeat (every 15 seconds to keep connection alive)
    const heartbeatInterval = setInterval(() => {
      if (!this.isConnectionAlive(res)) {
        clearInterval(heartbeatInterval);
        return;
      }
      this.sendHeartbeat(res);
    }, 15000);

    // Cleanup on client disconnect
    res.on('close', () => {
      clearInterval(heartbeatInterval);
      logger.info(`SSE connection closed: ${clientId}`);
    });

    res.on('error', (err) => {
      logger.error(`SSE connection error (${clientId}):`, err);
      clearInterval(heartbeatInterval);
    });

    logger.info(`SSE connection initialized: ${clientId}`);

    return heartbeatInterval;
  }

  /**
   * Send SSE event to client
   * @param {Response} res - Express response object
   * @param {string} eventType - Event type name
   * @param {Object|string} data - Event data
   * @returns {boolean} True if sent successfully
   */
  static sendEvent(res, eventType, data) {
    if (!this.isConnectionAlive(res)) {
      return false;
    }

    try {
      const formattedData = this.formatSSEData(data);

      // Write event type
      res.write(`event: ${eventType}\n`);

      // Write data
      res.write(`data: ${formattedData}\n\n`);

      return true;
    } catch (error) {
      logger.error(`Failed to send SSE event (${eventType}):`, error);
      return false;
    }
  }

  /**
   * Send heartbeat (keep-alive ping)
   * @param {Response} res - Express response object
   */
  static sendHeartbeat(res) {
    if (this.isConnectionAlive(res)) {
      // Send comment (ignored by EventSource but keeps connection alive)
      res.write(`:heartbeat ${Date.now()}\n\n`);
    }
  }

  /**
   * Check if SSE connection is still alive
   * @param {Response} res - Express response object
   * @returns {boolean} True if connection is alive
   */
  static isConnectionAlive(res) {
    return res && !res.writableEnded && !res.destroyed && res.writable;
  }

  /**
   * Close SSE connection gracefully
   * @param {Response} res - Express response object
   * @param {string} reason - Reason for closing
   */
  static closeConnection(res, reason = 'complete') {
    if (this.isConnectionAlive(res)) {
      try {
        // Send close event
        this.sendEvent(res, 'close', { reason, timestamp: Date.now() });

        // End the response
        res.end();

      } catch (error) {
        logger.error('Error closing SSE connection:', error);
      }
    }
  }

  /**
   * Format data for SSE transmission
   * @param {*} data - Data to format
   * @returns {string} Formatted data string
   */
  static formatSSEData(data) {
    // Convert data to JSON string
    let jsonString;

    if (typeof data === 'string') {
      jsonString = JSON.stringify({ message: data });
    } else if (typeof data === 'object') {
      jsonString = JSON.stringify(data);
    } else {
      jsonString = JSON.stringify({ value: data });
    }

    // Handle multi-line data (each line must be prefixed with "data: ")
    const lines = jsonString.split('\n');
    if (lines.length > 1) {
      return lines.join('\ndata: ');
    }

    return jsonString;
  }

  /**
   * Send error event
   * @param {Response} res - Express response object
   * @param {Error|string} error - Error object or message
   * @param {boolean} canRetry - Whether client can retry
   */
  static sendError(res, error, canRetry = false) {
    const errorMessage = error instanceof Error ? error.message : error;

    this.sendEvent(res, 'error', {
      message: errorMessage,
      canRetry,
      timestamp: Date.now()
    });
  }

  /**
   * Send warning event (non-fatal issue)
   * @param {Response} res - Express response object
   * @param {string} message - Warning message
   */
  static sendWarning(res, message) {
    this.sendEvent(res, 'warning', {
      message,
      timestamp: Date.now()
    });
  }

  /**
   * Send status update
   * @param {Response} res - Express response object
   * @param {string} status - Status message
   */
  static sendStatus(res, status) {
    this.sendEvent(res, 'status', {
      message: status,
      timestamp: Date.now()
    });
  }

  /**
   * Send metadata
   * @param {Response} res - Express response object
   * @param {Object} metadata - Metadata object
   */
  static sendMetadata(res, metadata) {
    this.sendEvent(res, 'metadata', {
      ...metadata,
      timestamp: Date.now()
    });
  }

  /**
   * Send text chunk
   * @param {Response} res - Express response object
   * @param {string} content - Text content
   */
  static sendTextChunk(res, content) {
    this.sendEvent(res, 'text', { content });
  }

  /**
   * Send audio chunk
   * @param {Response} res - Express response object
   * @param {string} audioData - Base64 encoded audio
   * @param {number} sequence - Sequence number for ordering
   */
  static sendAudioChunk(res, audioData, sequence) {
    this.sendEvent(res, 'audio', {
      chunk: audioData,
      sequence,
      format: 'base64'
    });
  }

  /**
   * Send suggestions
   * @param {Response} res - Express response object
   * @param {Array<string>} suggestions - Array of suggestion questions
   */
  static sendSuggestions(res, suggestions) {
    this.sendEvent(res, 'suggestions', {
      items: suggestions,
      count: suggestions.length
    });
  }

  /**
   * Send completion event
   * @param {Response} res - Express response object
   * @param {Object} metadata - Completion metadata
   */
  static sendComplete(res, metadata = {}) {
    this.sendEvent(res, 'complete', {
      success: true,
      ...metadata,
      timestamp: Date.now()
    });
  }

  /**
   * Handle stream errors gracefully
   * @param {Response} res - Express response object
   * @param {Error} error - Error object
   * @param {string} stage - Stage where error occurred
   */
  static handleStreamError(res, error, stage = 'unknown') {
    logger.error(`Stream error at ${stage}:`, error);

    if (this.isConnectionAlive(res)) {
      this.sendError(res, `Error at ${stage}: ${error.message}`, this.isRetryableError(error));
      this.closeConnection(res, 'error');
    }
  }

  /**
   * Check if error is retryable
   * @param {Error} error - Error object
   * @returns {boolean} True if error is retryable
   */
  static isRetryableError(error) {
    const retryableCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'RATE_LIMIT_EXCEEDED',
      'RATE_LIMIT'
    ];

    return retryableCodes.some(code =>
      error.code === code ||
      error.message.toUpperCase().includes(code)
    );
  }

  /**
   * Create SSE middleware for Express routes
   * @returns {Function} Express middleware
   */
  static middleware() {
    return (req, res, next) => {
      // Add SSE helper methods to response object
      res.sse = {
        send: (eventType, data) => this.sendEvent(res, eventType, data),
        sendText: (content) => this.sendTextChunk(res, content),
        sendAudio: (audioData, sequence) => this.sendAudioChunk(res, audioData, sequence),
        sendSuggestions: (suggestions) => this.sendSuggestions(res, suggestions),
        sendError: (error, canRetry) => this.sendError(res, error, canRetry),
        sendComplete: (metadata) => this.sendComplete(res, metadata),
        close: (reason) => this.closeConnection(res, reason)
      };

      next();
    };
  }

  /**
   * Get connection statistics
   * @param {Response} res - Express response object
   * @returns {Object} Connection stats
   */
  static getConnectionStats(res) {
    return {
      isAlive: this.isConnectionAlive(res),
      writableEnded: res.writableEnded,
      destroyed: res.destroyed,
      writable: res.writable
    };
  }
}

module.exports = SSEHelper;
