/**
 * Feature Flags System
 *
 * Controls gradual rollout of streaming features
 * Supports percentage-based rollout, A/B testing, and user-specific overrides
 */

const logger = require('./logger');
const crypto = require('crypto');

class FeatureFlags {
  constructor() {
    this.flags = {
      // Streaming feature flags
      streaming: {
        enabled: process.env.STREAMING_ENABLED === 'true' || true,
        rolloutPercentage: parseInt(process.env.STREAMING_ROLLOUT_PERCENTAGE || '100', 10),
        whitelist: (process.env.STREAMING_WHITELIST || '').split(',').filter(Boolean),
        blacklist: (process.env.STREAMING_BLACKLIST || '').split(',').filter(Boolean)
      },

      // TTS feature flags
      tts: {
        enabled: process.env.TTS_ENABLED !== 'false',
        rolloutPercentage: parseInt(process.env.TTS_ROLLOUT_PERCENTAGE || '100', 10)
      },

      // A/B Testing
      abTest: {
        enabled: process.env.AB_TEST_STREAMING === 'true',
        variant: process.env.AB_TEST_VARIANT || 'A'  // A = streaming, B = REST
      },

      // Metrics collection
      metrics: {
        enabled: process.env.METRICS_ENABLED !== 'false'
      }
    };

    logger.info('Feature flags initialized', {
      streaming: {
        enabled: this.flags.streaming.enabled,
        rollout: `${this.flags.streaming.rolloutPercentage}%`
      },
      tts: {
        enabled: this.flags.tts.enabled,
        rollout: `${this.flags.tts.rolloutPercentage}%`
      },
      abTest: this.flags.abTest.enabled
    });
  }

  /**
   * Check if streaming is enabled for a specific user/session
   * @param {Object} context - Request context
   * @param {string} context.userId - User ID (optional)
   * @param {string} context.sessionId - Session ID (optional)
   * @param {string} context.chatbotId - Chatbot ID
   * @param {string} context.ip - Client IP address (optional)
   * @returns {boolean} True if streaming should be enabled
   */
  isStreamingEnabled(context = {}) {
    const { userId, sessionId, chatbotId, ip } = context;

    // Global kill switch
    if (!this.flags.streaming.enabled) {
      return false;
    }

    // Check blacklist first (highest priority)
    const identifier = userId || sessionId || ip || chatbotId;
    if (identifier && this.flags.streaming.blacklist.includes(identifier)) {
      return false;
    }

    // Check whitelist (always enable for whitelisted users)
    if (identifier && this.flags.streaming.whitelist.includes(identifier)) {
      return true;
    }

    // A/B Test mode
    if (this.flags.abTest.enabled) {
      const variant = this.getABTestVariant(identifier || sessionId);
      return variant === 'A'; // A = streaming, B = REST
    }

    // Percentage-based rollout
    const rolloutPercentage = this.flags.streaming.rolloutPercentage;

    if (rolloutPercentage === 0) {
      return false;
    }

    if (rolloutPercentage === 100) {
      return true;
    }

    // Deterministic percentage check based on identifier
    const bucket = this.getUserBucket(identifier || sessionId || chatbotId);
    return bucket < rolloutPercentage;
  }

  /**
   * Check if TTS is enabled for a specific user/session
   * @param {Object} context - Request context
   * @returns {boolean} True if TTS should be enabled
   */
  isTTSEnabled(context = {}) {
    if (!this.flags.tts.enabled) {
      return false;
    }

    const { userId, sessionId, chatbotId } = context;
    const rolloutPercentage = this.flags.tts.rolloutPercentage;

    if (rolloutPercentage === 100) {
      return true;
    }

    const identifier = userId || sessionId || chatbotId;
    const bucket = this.getUserBucket(identifier);
    return bucket < rolloutPercentage;
  }

  /**
   * Check if metrics collection is enabled
   * @returns {boolean}
   */
  isMetricsEnabled() {
    return this.flags.metrics.enabled;
  }

  /**
   * Get A/B test variant for a user
   * @param {string} identifier - User identifier
   * @returns {string} 'A' or 'B'
   */
  getABTestVariant(identifier) {
    if (!identifier) {
      return Math.random() < 0.5 ? 'A' : 'B';
    }

    const bucket = this.getUserBucket(identifier);
    return bucket < 50 ? 'A' : 'B';
  }

  /**
   * Get user bucket (0-99) based on identifier
   * Ensures consistent bucketing for the same identifier
   * @private
   * @param {string} identifier - User/session identifier
   * @returns {number} Bucket number 0-99
   */
  getUserBucket(identifier) {
    if (!identifier) {
      return Math.floor(Math.random() * 100);
    }

    // Use hash for deterministic bucketing
    const hash = crypto
      .createHash('md5')
      .update(identifier)
      .digest('hex');

    // Convert first 8 chars of hash to number and mod 100
    const bucket = parseInt(hash.substring(0, 8), 16) % 100;
    return bucket;
  }

  /**
   * Update rollout percentage (hot reload)
   * @param {string} feature - Feature name ('streaming', 'tts')
   * @param {number} percentage - New rollout percentage (0-100)
   */
  setRolloutPercentage(feature, percentage) {
    if (this.flags[feature]) {
      const oldPercentage = this.flags[feature].rolloutPercentage;
      this.flags[feature].rolloutPercentage = Math.max(0, Math.min(100, percentage));

      logger.info(`Feature flag updated: ${feature}`, {
        old: `${oldPercentage}%`,
        new: `${this.flags[feature].rolloutPercentage}%`
      });

      return true;
    }

    logger.warn(`Unknown feature flag: ${feature}`);
    return false;
  }

  /**
   * Enable/disable a feature globally
   * @param {string} feature - Feature name
   * @param {boolean} enabled - Enable or disable
   */
  setFeatureEnabled(feature, enabled) {
    if (this.flags[feature]) {
      this.flags[feature].enabled = enabled;

      logger.info(`Feature flag toggled: ${feature}`, {
        enabled
      });

      return true;
    }

    logger.warn(`Unknown feature flag: ${feature}`);
    return false;
  }

  /**
   * Add user to whitelist
   * @param {string} feature - Feature name
   * @param {string} identifier - User identifier
   */
  addToWhitelist(feature, identifier) {
    if (this.flags[feature] && this.flags[feature].whitelist) {
      if (!this.flags[feature].whitelist.includes(identifier)) {
        this.flags[feature].whitelist.push(identifier);
        logger.info(`Added to whitelist: ${feature}`, { identifier });
      }
      return true;
    }
    return false;
  }

  /**
   * Add user to blacklist
   * @param {string} feature - Feature name
   * @param {string} identifier - User identifier
   */
  addToBlacklist(feature, identifier) {
    if (this.flags[feature] && this.flags[feature].blacklist) {
      if (!this.flags[feature].blacklist.includes(identifier)) {
        this.flags[feature].blacklist.push(identifier);
        logger.info(`Added to blacklist: ${feature}`, { identifier });
      }
      return true;
    }
    return false;
  }

  /**
   * Get current flag configuration
   * @returns {Object} Current flags
   */
  getAllFlags() {
    return {
      streaming: {
        enabled: this.flags.streaming.enabled,
        rolloutPercentage: this.flags.streaming.rolloutPercentage,
        whitelistCount: this.flags.streaming.whitelist.length,
        blacklistCount: this.flags.streaming.blacklist.length
      },
      tts: {
        enabled: this.flags.tts.enabled,
        rolloutPercentage: this.flags.tts.rolloutPercentage
      },
      abTest: {
        enabled: this.flags.abTest.enabled,
        variant: this.flags.abTest.variant
      },
      metrics: {
        enabled: this.flags.metrics.enabled
      }
    };
  }

  /**
   * Get statistics about feature usage
   * @returns {Object} Feature usage stats
   */
  getStats() {
    return {
      flags: this.getAllFlags(),
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
module.exports = new FeatureFlags();
