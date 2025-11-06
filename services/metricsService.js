const logger = require('../utils/logger');

/**
 * MetricsService
 *
 * Tracks and aggregates performance metrics for streaming responses
 * Used for monitoring, alerting, and optimization
 */
class MetricsService {
  constructor() {
    // Streaming metrics
    this.metrics = {
      totalRequests: 0,
      successfulStreams: 0,
      failedStreams: 0,
      activeStreams: 0,

      // Latency tracking (in milliseconds)
      latency: {
        firstToken: [],
        firstAudio: [],
        complete: []
      },

      // Cache performance
      cache: {
        kbHits: 0,
        kbMisses: 0,
        ttsHits: 0,
        ttsMisses: 0
      },

      // Error tracking
      errors: {
        openai: 0,
        tts: 0,
        network: 0,
        validation: 0,
        other: 0
      },

      // Resource usage
      resources: {
        avgResponseSize: 0,
        totalTokens: 0,
        totalAudioChunks: 0
      }
    };

    // Track unique active users (using Set for uniqueness)
    // Store sessionIds seen in the last hour
    this.uniqueSessions = new Set();
    this.sessionTimestamps = new Map(); // sessionId -> timestamp

    // Store recent events for dashboard (last 100)
    this.recentEvents = [];
    this.maxRecentEvents = 100;

    // Start timestamp
    this.startTime = Date.now();

    // Clean up old sessions every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupOldSessions(), 5 * 60 * 1000);
  }

  /**
   * Record a successful streaming request
   * @param {Object} data - Request data
   */
  recordSuccess(data = {}) {
    this.metrics.totalRequests++;
    this.metrics.successfulStreams++;

    // Track unique session (active user)
    if (data.sessionId) {
      this.uniqueSessions.add(data.sessionId);
      this.sessionTimestamps.set(data.sessionId, Date.now());
    }

    // Track latencies
    if (data.firstTokenLatency) {
      this.metrics.latency.firstToken.push(data.firstTokenLatency);
      // Keep only last 1000 samples
      if (this.metrics.latency.firstToken.length > 1000) {
        this.metrics.latency.firstToken.shift();
      }
    }

    if (data.firstAudioLatency) {
      this.metrics.latency.firstAudio.push(data.firstAudioLatency);
      if (this.metrics.latency.firstAudio.length > 1000) {
        this.metrics.latency.firstAudio.shift();
      }
    }

    if (data.duration) {
      this.metrics.latency.complete.push(data.duration);
      if (this.metrics.latency.complete.length > 1000) {
        this.metrics.latency.complete.shift();
      }
    }

    // Track resources
    if (data.wordCount) {
      const current = this.metrics.resources.avgResponseSize;
      const count = this.metrics.successfulStreams;
      this.metrics.resources.avgResponseSize =
        (current * (count - 1) + data.wordCount) / count;
    }

    if (data.tokens) {
      this.metrics.resources.totalTokens += data.tokens;
    }

    if (data.audioChunks) {
      this.metrics.resources.totalAudioChunks += data.audioChunks;
    }

    // Add to recent events
    this.addRecentEvent({
      type: 'success',
      timestamp: Date.now(),
      data
    });
  }

  /**
   * Record a failed streaming request
   * @param {string} errorType - Type of error
   * @param {Error} error - Error object
   */
  recordError(errorType = 'other', error = null) {
    this.metrics.totalRequests++;
    this.metrics.failedStreams++;

    // Track error type
    if (this.metrics.errors[errorType] !== undefined) {
      this.metrics.errors[errorType]++;
    } else {
      this.metrics.errors.other++;
    }

    // Add to recent events
    this.addRecentEvent({
      type: 'error',
      errorType,
      timestamp: Date.now(),
      message: error?.message || 'Unknown error'
    });

    // Log error for monitoring
    logger.warn(`Stream error recorded: ${errorType}`, {
      errorCount: this.metrics.errors[errorType],
      totalErrors: this.metrics.failedStreams
    });
  }

  /**
   * Record cache hit
   * @param {string} cacheType - 'kb' or 'tts'
   */
  recordCacheHit(cacheType) {
    if (cacheType === 'kb') {
      this.metrics.cache.kbHits++;
    } else if (cacheType === 'tts') {
      this.metrics.cache.ttsHits++;
    }
  }

  /**
   * Record cache miss
   * @param {string} cacheType - 'kb' or 'tts'
   */
  recordCacheMiss(cacheType) {
    if (cacheType === 'kb') {
      this.metrics.cache.kbMisses++;
    } else if (cacheType === 'tts') {
      this.metrics.cache.ttsMisses++;
    }
  }

  /**
   * Update active stream count
   * @param {number} count - Current active streams
   */
  updateActiveStreams(count) {
    this.metrics.activeStreams = count;
  }

  /**
   * Get all metrics
   * @returns {Object} Complete metrics
   */
  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const successRate = this.metrics.totalRequests > 0
      ? (this.metrics.successfulStreams / this.metrics.totalRequests * 100).toFixed(2)
      : 0;

    const kbTotal = this.metrics.cache.kbHits + this.metrics.cache.kbMisses;
    const kbHitRate = kbTotal > 0
      ? (this.metrics.cache.kbHits / kbTotal * 100).toFixed(2)
      : 0;

    const ttsTotal = this.metrics.cache.ttsHits + this.metrics.cache.ttsMisses;
    const ttsHitRate = ttsTotal > 0
      ? (this.metrics.cache.ttsHits / ttsTotal * 100).toFixed(2)
      : 0;

    return {
      uptime: Math.floor(uptime / 1000), // seconds
      uptimeFormatted: this.formatUptime(uptime),

      requests: {
        total: this.metrics.totalRequests,
        successful: this.metrics.successfulStreams,
        failed: this.metrics.failedStreams,
        active: this.metrics.activeStreams,
        successRate: parseFloat(successRate)
      },

      users: {
        activeUnique: this.uniqueSessions.size,  // Unique active users (last hour)
        totalSessions: this.metrics.successfulStreams  // Total sessions/conversations
      },

      latency: {
        firstToken: {
          avg: this.calculateAverage(this.metrics.latency.firstToken),
          p50: this.calculatePercentile(this.metrics.latency.firstToken, 50),
          p95: this.calculatePercentile(this.metrics.latency.firstToken, 95),
          p99: this.calculatePercentile(this.metrics.latency.firstToken, 99)
        },
        firstAudio: {
          avg: this.calculateAverage(this.metrics.latency.firstAudio),
          p50: this.calculatePercentile(this.metrics.latency.firstAudio, 50),
          p95: this.calculatePercentile(this.metrics.latency.firstAudio, 95),
          p99: this.calculatePercentile(this.metrics.latency.firstAudio, 99)
        },
        complete: {
          avg: this.calculateAverage(this.metrics.latency.complete),
          p50: this.calculatePercentile(this.metrics.latency.complete, 50),
          p95: this.calculatePercentile(this.metrics.latency.complete, 95),
          p99: this.calculatePercentile(this.metrics.latency.complete, 99)
        }
      },

      cache: {
        kb: {
          hits: this.metrics.cache.kbHits,
          misses: this.metrics.cache.kbMisses,
          hitRate: parseFloat(kbHitRate),
          total: kbTotal
        },
        tts: {
          hits: this.metrics.cache.ttsHits,
          misses: this.metrics.cache.ttsMisses,
          hitRate: parseFloat(ttsHitRate),
          total: ttsTotal
        }
      },

      errors: this.metrics.errors,

      resources: {
        avgResponseSize: Math.round(this.metrics.resources.avgResponseSize),
        totalTokens: this.metrics.resources.totalTokens,
        totalAudioChunks: this.metrics.resources.totalAudioChunks
      }
    };
  }

  /**
   * Get recent events
   * @param {number} limit - Max events to return
   * @returns {Array} Recent events
   */
  getRecentEvents(limit = 50) {
    return this.recentEvents.slice(-limit);
  }

  /**
   * Add event to recent events list
   * @private
   */
  addRecentEvent(event) {
    this.recentEvents.push(event);

    // Keep only last N events
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }
  }

  /**
   * Calculate average of array
   * @private
   */
  calculateAverage(arr) {
    if (!arr || arr.length === 0) return 0;
    const sum = arr.reduce((a, b) => a + b, 0);
    return Math.round(sum / arr.length);
  }

  /**
   * Calculate percentile of array
   * @private
   */
  calculatePercentile(arr, percentile) {
    if (!arr || arr.length === 0) return 0;

    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return Math.round(sorted[index] || 0);
  }

  /**
   * Format uptime in human-readable format
   * @private
   */
  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Clean up old sessions (older than 1 hour)
   * @private
   */
  cleanupOldSessions() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [sessionId, timestamp] of this.sessionTimestamps.entries()) {
      if (timestamp < oneHourAgo) {
        this.uniqueSessions.delete(sessionId);
        this.sessionTimestamps.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} old sessions. Active unique users: ${this.uniqueSessions.size}`);
    }
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      totalRequests: 0,
      successfulStreams: 0,
      failedStreams: 0,
      activeStreams: 0,
      latency: {
        firstToken: [],
        firstAudio: [],
        complete: []
      },
      cache: {
        kbHits: 0,
        kbMisses: 0,
        ttsHits: 0,
        ttsMisses: 0
      },
      errors: {
        openai: 0,
        tts: 0,
        network: 0,
        validation: 0,
        other: 0
      },
      resources: {
        avgResponseSize: 0,
        totalTokens: 0,
        totalAudioChunks: 0
      }
    };

    this.uniqueSessions.clear();
    this.sessionTimestamps.clear();
    this.recentEvents = [];
    this.startTime = Date.now();

    logger.info('Metrics service reset');
  }
}

// Export singleton instance
module.exports = new MetricsService();
