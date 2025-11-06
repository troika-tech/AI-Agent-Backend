const express = require('express');
const router = express.Router();
const metricsService = require('../services/metricsService');

/**
 * GET /prometheus/metrics
 * Prometheus-compatible metrics endpoint for Grafana
 *
 * This endpoint exposes application metrics in Prometheus format,
 * which Grafana Alloy can scrape and send to Grafana Cloud.
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = metricsService.getMetrics();
    const processMemory = process.memoryUsage();

    // Build Prometheus format metrics
    const prometheusMetrics = `
# HELP chatbot_requests_total Total number of chat requests
# TYPE chatbot_requests_total counter
chatbot_requests_total{type="success"} ${metrics.requests.successful}
chatbot_requests_total{type="failed"} ${metrics.requests.failed}

# HELP chatbot_active_streams Current number of active streaming connections
# TYPE chatbot_active_streams gauge
chatbot_active_streams ${metrics.requests.active}

# HELP chatbot_success_rate Success rate percentage (0-100)
# TYPE chatbot_success_rate gauge
chatbot_success_rate ${metrics.requests.successRate}

# HELP chatbot_active_users_unique Unique active users in the last hour
# TYPE chatbot_active_users_unique gauge
chatbot_active_users_unique ${metrics.users.activeUnique}

# HELP chatbot_total_sessions Total number of chat sessions
# TYPE chatbot_total_sessions counter
chatbot_total_sessions ${metrics.users.totalSessions}

# HELP chatbot_latency_milliseconds Response latency in milliseconds
# TYPE chatbot_latency_milliseconds gauge
chatbot_latency_milliseconds{type="first_token",percentile="avg"} ${metrics.latency.firstToken.avg}
chatbot_latency_milliseconds{type="first_token",percentile="p50"} ${metrics.latency.firstToken.p50}
chatbot_latency_milliseconds{type="first_token",percentile="p95"} ${metrics.latency.firstToken.p95}
chatbot_latency_milliseconds{type="first_token",percentile="p99"} ${metrics.latency.firstToken.p99}
chatbot_latency_milliseconds{type="first_audio",percentile="avg"} ${metrics.latency.firstAudio.avg}
chatbot_latency_milliseconds{type="first_audio",percentile="p50"} ${metrics.latency.firstAudio.p50}
chatbot_latency_milliseconds{type="first_audio",percentile="p95"} ${metrics.latency.firstAudio.p95}
chatbot_latency_milliseconds{type="first_audio",percentile="p99"} ${metrics.latency.firstAudio.p99}
chatbot_latency_milliseconds{type="complete",percentile="avg"} ${metrics.latency.complete.avg}
chatbot_latency_milliseconds{type="complete",percentile="p50"} ${metrics.latency.complete.p50}
chatbot_latency_milliseconds{type="complete",percentile="p95"} ${metrics.latency.complete.p95}
chatbot_latency_milliseconds{type="complete",percentile="p99"} ${metrics.latency.complete.p99}

# HELP chatbot_cache_hit_rate Cache hit rate percentage (0-100)
# TYPE chatbot_cache_hit_rate gauge
chatbot_cache_hit_rate{type="knowledge_base"} ${metrics.cache.kb.hitRate}
chatbot_cache_hit_rate{type="tts"} ${metrics.cache.tts.hitRate}

# HELP chatbot_cache_operations_total Total cache operations
# TYPE chatbot_cache_operations_total counter
chatbot_cache_operations_total{type="knowledge_base",result="hit"} ${metrics.cache.kb.hits}
chatbot_cache_operations_total{type="knowledge_base",result="miss"} ${metrics.cache.kb.misses}
chatbot_cache_operations_total{type="tts",result="hit"} ${metrics.cache.tts.hits}
chatbot_cache_operations_total{type="tts",result="miss"} ${metrics.cache.tts.misses}

# HELP chatbot_errors_total Total errors by type
# TYPE chatbot_errors_total counter
chatbot_errors_total{type="openai"} ${metrics.errors.openai}
chatbot_errors_total{type="tts"} ${metrics.errors.tts}
chatbot_errors_total{type="network"} ${metrics.errors.network}
chatbot_errors_total{type="validation"} ${metrics.errors.validation}
chatbot_errors_total{type="other"} ${metrics.errors.other}

# HELP chatbot_uptime_seconds Application uptime in seconds
# TYPE chatbot_uptime_seconds counter
chatbot_uptime_seconds ${metrics.uptime}

# HELP chatbot_resources_total Resource usage totals
# TYPE chatbot_resources_total counter
chatbot_resources_total{type="tokens"} ${metrics.resources.totalTokens}
chatbot_resources_total{type="audio_chunks"} ${metrics.resources.totalAudioChunks}

# HELP chatbot_avg_response_size Average response size in words
# TYPE chatbot_avg_response_size gauge
chatbot_avg_response_size ${metrics.resources.avgResponseSize}

# HELP nodejs_memory_usage_bytes Node.js memory usage in bytes
# TYPE nodejs_memory_usage_bytes gauge
nodejs_memory_usage_bytes{type="rss"} ${processMemory.rss}
nodejs_memory_usage_bytes{type="heap_total"} ${processMemory.heapTotal}
nodejs_memory_usage_bytes{type="heap_used"} ${processMemory.heapUsed}
nodejs_memory_usage_bytes{type="external"} ${processMemory.external}

# HELP nodejs_heap_usage_percent Node.js heap usage percentage (0-100)
# TYPE nodejs_heap_usage_percent gauge
nodejs_heap_usage_percent ${((processMemory.heapUsed / processMemory.heapTotal) * 100).toFixed(2)}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds counter
process_uptime_seconds ${Math.floor(process.uptime())}
`.trim();

    // Set Content-Type to Prometheus text format
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(prometheusMetrics);
  } catch (error) {
    console.error('Error generating Prometheus metrics:', error);
    res.status(500).send('# Error generating metrics\n');
  }
});

module.exports = router;
