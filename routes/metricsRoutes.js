const express = require('express');
const router = express.Router();
const metricsService = require('../services/metricsService');
const StreamingResponseService = require('../services/streamingResponseService');
const StreamingVoiceService = require('../services/streamingVoiceService');
const featureFlags = require('../utils/featureFlags');
const logger = require('../utils/logger');

// Create service instances for stats
const streamingResponseService = new StreamingResponseService();
const streamingVoiceService = new StreamingVoiceService();

/**
 * GET /api/metrics/streaming
 * Get comprehensive streaming metrics
 */
router.get('/streaming', (req, res) => {
  try {
    const metrics = metricsService.getMetrics();
    const streamingStats = streamingResponseService.getStats();
    const voiceStats = streamingVoiceService.getStats();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: {
        ...metrics,
        streaming: streamingStats,
        voice: voiceStats
      }
    });
  } catch (error) {
    logger.error('Error fetching streaming metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics'
    });
  }
});

/**
 * GET /api/metrics/streaming/summary
 * Get summarized metrics (for dashboard)
 */
router.get('/streaming/summary', (req, res) => {
  try {
    const metrics = metricsService.getMetrics();

    // Return simplified summary
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        uptime: metrics.uptimeFormatted,
        totalRequests: metrics.requests.total,
        successRate: metrics.requests.successRate,
        activeStreams: metrics.requests.active,
        avgFirstTokenLatency: metrics.latency.firstToken.avg,
        avgCompleteLatency: metrics.latency.complete.avg,
        cacheHitRate: {
          kb: metrics.cache.kb.hitRate,
          tts: metrics.cache.tts.hitRate
        },
        errorCount: metrics.requests.failed
      }
    });
  } catch (error) {
    logger.error('Error fetching metrics summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics summary'
    });
  }
});

/**
 * GET /api/metrics/streaming/events
 * Get recent streaming events
 */
router.get('/streaming/events', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const events = metricsService.getRecentEvents(limit);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      events,
      count: events.length
    });
  } catch (error) {
    logger.error('Error fetching streaming events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events'
    });
  }
});

/**
 * POST /api/metrics/streaming/reset
 * Reset metrics (admin only - add authentication)
 */
router.post('/streaming/reset', (req, res) => {
  try {
    // TODO: Add authentication middleware
    // For now, only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'Reset not allowed in production'
      });
    }

    metricsService.reset();

    res.json({
      success: true,
      message: 'Metrics reset successfully'
    });
  } catch (error) {
    logger.error('Error resetting metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset metrics'
    });
  }
});

/**
 * GET /api/metrics/health/streaming
 * Health check endpoint for streaming services
 */
router.get('/health/streaming', async (req, res) => {
  try {
    const metrics = metricsService.getMetrics();
    const voiceService = new StreamingVoiceService();

    // Check error rate
    const errorRate = metrics.requests.total > 0
      ? (metrics.requests.failed / metrics.requests.total) * 100
      : 0;

    // Check average latency
    const avgLatency = metrics.latency.firstToken.avg;

    // Determine health status
    let status = 'healthy';
    let issues = [];

    if (errorRate > 5) {
      status = 'unhealthy';
      issues.push(`High error rate: ${errorRate.toFixed(2)}%`);
    } else if (errorRate > 2) {
      status = 'degraded';
      issues.push(`Elevated error rate: ${errorRate.toFixed(2)}%`);
    }

    if (avgLatency > 2000) {
      status = 'unhealthy';
      issues.push(`High latency: ${avgLatency}ms`);
    } else if (avgLatency > 1000) {
      if (status === 'healthy') status = 'degraded';
      issues.push(`Elevated latency: ${avgLatency}ms`);
    }

    // Check if services are available
    const redisAvailable = !!voiceService.redis;
    if (!redisAvailable) {
      if (status === 'healthy') status = 'degraded';
      issues.push('Redis cache unavailable');
    }

    res.status(status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503).json({
      success: status !== 'unhealthy',
      status,
      timestamp: new Date().toISOString(),
      checks: {
        errorRate: {
          status: errorRate <= 2 ? 'pass' : errorRate <= 5 ? 'warn' : 'fail',
          value: errorRate.toFixed(2) + '%',
          threshold: '≤5%'
        },
        latency: {
          status: avgLatency <= 1000 ? 'pass' : avgLatency <= 2000 ? 'warn' : 'fail',
          value: avgLatency + 'ms',
          threshold: '≤1000ms'
        },
        redis: {
          status: redisAvailable ? 'pass' : 'warn',
          value: redisAvailable ? 'connected' : 'disconnected'
        },
        activeStreams: {
          status: 'pass',
          value: metrics.requests.active
        }
      },
      issues: issues.length > 0 ? issues : undefined
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Health check failed'
    });
  }
});

/**
 * GET /api/metrics/feature-flags
 * Get current feature flag configuration
 */
router.get('/feature-flags', (req, res) => {
  try {
    const flags = featureFlags.getAllFlags();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      flags
    });
  } catch (error) {
    logger.error('Error fetching feature flags:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feature flags'
    });
  }
});

/**
 * POST /api/metrics/feature-flags/rollout
 * Update rollout percentage for a feature
 * Body: { feature: 'streaming', percentage: 50 }
 */
router.post('/feature-flags/rollout', (req, res) => {
  try {
    // TODO: Add authentication middleware for production
    if (process.env.NODE_ENV === 'production') {
      // In production, this should require admin authentication
      logger.warn('Feature flag update attempted in production');
    }

    const { feature, percentage } = req.body;

    if (!feature || percentage === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: feature, percentage'
      });
    }

    const updated = featureFlags.setRolloutPercentage(feature, percentage);

    if (updated) {
      res.json({
        success: true,
        message: `Rollout percentage updated for ${feature}`,
        newPercentage: percentage
      });
    } else {
      res.status(404).json({
        success: false,
        error: `Unknown feature: ${feature}`
      });
    }
  } catch (error) {
    logger.error('Error updating feature flag:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update feature flag'
    });
  }
});

module.exports = router;
