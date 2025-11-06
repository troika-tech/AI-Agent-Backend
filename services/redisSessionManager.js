const { getClient, isConnected } = require('../lib/redis');
const logger = require('../utils/logger');

class RedisSessionManager {
  constructor() {
    this.prefix = 'troika:session:';
    this.ttl = 24 * 60 * 60; // 24 hours in seconds
  }

  /**
   * Save session data to Redis
   * @param {String} sessionId - Session ID
   * @param {Object} data - Session data
   * @returns {Boolean} - Success status
   */
  async saveSession(sessionId, data) {
    try {
      if (!isConnected()) {
        return false;
      }

      const client = getClient();
      const key = this._getKey(sessionId);

      // Get existing session
      const existingData = await this.getSession(sessionId);

      // Merge with existing data
      const sessionData = existingData
        ? { ...existingData, ...data }
        : data;

      // Add metadata
      sessionData.updatedAt = new Date().toISOString();
      if (!sessionData.createdAt) {
        sessionData.createdAt = new Date().toISOString();
      }

      // Save to Redis with TTL
      await client.setEx(key, this.ttl, JSON.stringify(sessionData));

      return true;

    } catch (error) {
      logger.error('Error saving session to Redis:', error);
      return false;
    }
  }

  /**
   * Get session data from Redis
   * @param {String} sessionId - Session ID
   * @returns {Object|null} - Session data or null
   */
  async getSession(sessionId) {
    try {
      if (!isConnected()) {
        return null;
      }

      const client = getClient();
      const key = this._getKey(sessionId);

      const data = await client.get(key);

      if (!data) {
        return null;
      }

      const sessionData = JSON.parse(data);

      return sessionData;

    } catch (error) {
      logger.error('Error getting session from Redis:', error);
      return null;
    }
  }

  /**
   * Delete session from Redis
   * @param {String} sessionId - Session ID
   * @returns {Boolean} - Success status
   */
  async deleteSession(sessionId) {
    try {
      if (!isConnected()) {
        return false;
      }

      const client = getClient();
      const key = this._getKey(sessionId);

      await client.del(key);

      return true;

    } catch (error) {
      logger.error('Error deleting session from Redis:', error);
      return false;
    }
  }

  /**
   * Extend session TTL
   * @param {String} sessionId - Session ID
   * @param {Number} ttl - New TTL in seconds (optional, defaults to default TTL)
   * @returns {Boolean} - Success status
   */
  async extendSession(sessionId, ttl = null) {
    try {
      if (!isConnected()) {
        return false;
      }

      const client = getClient();
      const key = this._getKey(sessionId);

      await client.expire(key, ttl || this.ttl);

      return true;

    } catch (error) {
      logger.error('Error extending session TTL:', error);
      return false;
    }
  }

  /**
   * Check if session exists
   * @param {String} sessionId - Session ID
   * @returns {Boolean} - Exists status
   */
  async sessionExists(sessionId) {
    try {
      if (!isConnected()) {
        return false;
      }

      const client = getClient();
      const key = this._getKey(sessionId);

      const exists = await client.exists(key);
      return exists === 1;

    } catch (error) {
      logger.error('Error checking session existence:', error);
      return false;
    }
  }

  /**
   * Get all session keys (for debugging/admin purposes)
   * @returns {Array<String>} - List of session IDs
   */
  async getAllSessionIds() {
    try {
      if (!isConnected()) {
        return [];
      }

      const client = getClient();
      const pattern = `${this.prefix}*`;

      const keys = await client.keys(pattern);
      const sessionIds = keys.map(key => key.replace(this.prefix, ''));

      return sessionIds;

    } catch (error) {
      logger.error('Error getting all session IDs:', error);
      return [];
    }
  }

  /**
   * Get session count
   * @returns {Number} - Number of active sessions
   */
  async getSessionCount() {
    try {
      if (!isConnected()) {
        return 0;
      }

      const client = getClient();
      const pattern = `${this.prefix}*`;

      const keys = await client.keys(pattern);
      return keys.length;

    } catch (error) {
      logger.error('Error getting session count:', error);
      return 0;
    }
  }

  /**
   * Append conversation turn to session
   * @param {String} sessionId - Session ID
   * @param {Object} turn - Conversation turn data
   * @returns {Boolean} - Success status
   */
  async appendConversation(sessionId, turn) {
    try {
      const session = await this.getSession(sessionId);

      if (!session) {
        // Create new session with this turn
        return await this.saveSession(sessionId, {
          conversation: [turn],
          turnCount: 1
        });
      }

      // Append to existing conversation
      if (!session.conversation) {
        session.conversation = [];
      }

      session.conversation.push(turn);
      session.turnCount = session.conversation.length;

      // Keep only last 10 turns to avoid bloating
      if (session.conversation.length > 10) {
        session.conversation = session.conversation.slice(-10);
      }

      return await this.saveSession(sessionId, session);

    } catch (error) {
      logger.error('Error appending conversation to session:', error);
      return false;
    }
  }

  /**
   * Get conversation history from session
   * @param {String} sessionId - Session ID
   * @param {Number} limit - Number of recent turns to return
   * @returns {Array} - Conversation turns
   */
  async getConversationHistory(sessionId, limit = 5) {
    try {
      const session = await this.getSession(sessionId);

      if (!session || !session.conversation) {
        return [];
      }

      // Return last N turns
      return session.conversation.slice(-limit);

    } catch (error) {
      logger.error('Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Clear all sessions (for testing/admin purposes)
   * @returns {Number} - Number of sessions cleared
   */
  async clearAllSessions() {
    try {
      if (!isConnected()) {
        return 0;
      }

      const client = getClient();
      const pattern = `${this.prefix}*`;

      const keys = await client.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      await client.del(keys);
      logger.info(`Cleared ${keys.length} sessions`);

      return keys.length;

    } catch (error) {
      logger.error('Error clearing all sessions:', error);
      return 0;
    }
  }

  /**
   * Get Redis key for session
   * @private
   * @param {String} sessionId - Session ID
   * @returns {String} - Redis key
   */
  _getKey(sessionId) {
    return `${this.prefix}${sessionId}`;
  }

  /**
   * Get session statistics
   * @returns {Object} - Session stats
   */
  async getSessionStats() {
    try {
      const count = await this.getSessionCount();

      if (count === 0) {
        return {
          total: 0,
          connected: isConnected()
        };
      }

      const sessionIds = await this.getAllSessionIds();
      const sessions = [];

      // Sample up to 100 sessions for stats
      const sampleIds = sessionIds.slice(0, 100);

      for (const id of sampleIds) {
        const session = await this.getSession(id);
        if (session) {
          sessions.push(session);
        }
      }

      // Calculate stats
      const avgTurnCount = sessions.reduce((sum, s) => sum + (s.turnCount || 0), 0) / sessions.length;
      const withConversation = sessions.filter(s => s.conversation && s.conversation.length > 0).length;

      return {
        total: count,
        sampled: sessions.length,
        avgTurnCount: avgTurnCount.toFixed(2),
        withConversation,
        connected: isConnected()
      };

    } catch (error) {
      logger.error('Error getting session stats:', error);
      return {
        total: 0,
        connected: isConnected(),
        error: error.message
      };
    }
  }
}

module.exports = RedisSessionManager;
