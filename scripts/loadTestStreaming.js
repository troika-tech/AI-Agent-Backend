/**
 * Load Testing Script for Streaming Endpoints
 *
 * Tests different load scenarios:
 * - Sustained load: Moderate concurrent users over time
 * - Spike test: Sudden increase in concurrent requests
 * - Endurance test: Long duration with consistent load
 *
 * Usage:
 *   node scripts/loadTestStreaming.js <test-type> [options]
 *
 * Test types:
 *   sustained - 50 concurrent users, 10 req/s, 1000 total requests
 *   spike     - 200 concurrent users, sudden spike
 *   endurance - 20 concurrent users, 10 minutes continuous
 *   quick     - 10 concurrent users, 100 requests (for quick validation)
 */

const http = require('http');
const crypto = require('crypto');

// Configuration
const CHATBOT_ID = process.argv[2] || '68ea0b4d28fb01da88e59697';
const TEST_TYPE = process.argv[3] || 'quick';
const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';

const TEST_QUERIES = [
  'Hello',
  'What programs do you offer?',
  'Tell me about your courses',
  'How can I apply?',
  'What are the fees?',
  'Do you offer scholarships?',
  'Tell me about placements',
  'What is your location?'
];

const TEST_CONFIGS = {
  quick: {
    name: 'Quick Validation',
    concurrency: 10,
    totalRequests: 100,
    rampUpTime: 5000, // 5 seconds
    description: 'Quick validation test with low load'
  },
  sustained: {
    name: 'Sustained Load',
    concurrency: 50,
    totalRequests: 1000,
    rampUpTime: 10000, // 10 seconds
    description: '50 concurrent users, 1000 total requests'
  },
  spike: {
    name: 'Spike Test',
    concurrency: 200,
    totalRequests: 500,
    rampUpTime: 1000, // 1 second - sudden spike
    description: '200 concurrent users, sudden spike'
  },
  endurance: {
    name: 'Endurance Test',
    concurrency: 20,
    totalRequests: 1200, // 20 requests/min * 10 min = 1200
    rampUpTime: 60000, // 1 minute ramp up
    description: '20 concurrent users, 10 minutes continuous'
  }
};

// Metrics tracking
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalDuration: 0,
  totalFirstToken: 0,
  totalWords: 0,
  errors: {},
  latencies: [],
  firstTokenLatencies: [],
  startTime: Date.now()
};

/**
 * Generate UUID v4
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Get random query from test set
 */
function getRandomQuery() {
  return TEST_QUERIES[Math.floor(Math.random() * TEST_QUERIES.length)];
}

/**
 * Make a single streaming request
 */
function makeStreamingRequest() {
  return new Promise((resolve, reject) => {
    const query = getRandomQuery();
    const sessionId = generateUUID();
    const requestBody = JSON.stringify({
      query,
      chatbotId: CHATBOT_ID,
      sessionId,
      enableTTS: false,
      language: 'en-IN'
    });

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/chat/query/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'Accept': 'text/event-stream'
      }
    };

    const startTime = Date.now();
    let firstTokenTime = null;
    let wordCount = 0;
    let completed = false;
    let hasError = false;

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        hasError = true;
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        const lines = chunk.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          if (line.startsWith('event:')) {
            const eventType = line.substring(6).trim();
            const dataLine = lines[i + 1];

            if (dataLine && dataLine.startsWith('data:')) {
              const dataStr = dataLine.substring(5).trim();

              try {
                const data = JSON.parse(dataStr);

                if (eventType === 'text' && !firstTokenTime) {
                  firstTokenTime = Date.now() - startTime;
                }

                if (eventType === 'complete') {
                  wordCount = data.wordCount || 0;
                  completed = true;
                }
              } catch (err) {
                // Ignore JSON parse errors
              }
            }
          }
        }
      });

      res.on('end', () => {
        const duration = Date.now() - startTime;

        if (completed && !hasError) {
          resolve({
            success: true,
            duration,
            firstTokenTime: firstTokenTime || duration,
            wordCount
          });
        } else if (!hasError) {
          reject(new Error('Stream did not complete'));
        }
      });

      res.on('error', (err) => {
        hasError = true;
        reject(err);
      });
    });

    req.on('error', (err) => {
      hasError = true;
      reject(err);
    });

    // Timeout after 30 seconds
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(requestBody);
    req.end();
  });
}

/**
 * Track request result
 */
function trackResult(result) {
  metrics.totalRequests++;

  if (result.success) {
    metrics.successfulRequests++;
    metrics.totalDuration += result.duration;
    metrics.totalFirstToken += result.firstTokenTime;
    metrics.totalWords += result.wordCount;
    metrics.latencies.push(result.duration);
    metrics.firstTokenLatencies.push(result.firstTokenTime);
  } else {
    metrics.failedRequests++;
    const errorKey = result.error?.message || 'Unknown error';
    metrics.errors[errorKey] = (metrics.errors[errorKey] || 0) + 1;
  }
}

/**
 * Calculate percentile
 */
function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

/**
 * Print progress bar
 */
function printProgress(current, total) {
  const percentage = Math.floor((current / total) * 100);
  const barLength = 40;
  const filled = Math.floor((barLength * current) / total);
  const empty = barLength - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  process.stdout.write(`\r[${bar}] ${percentage}% (${current}/${total})`);
}

/**
 * Print final report
 */
function printReport(config) {
  const elapsed = Date.now() - metrics.startTime;
  const successRate = metrics.totalRequests > 0
    ? (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2)
    : 0;

  const avgDuration = metrics.successfulRequests > 0
    ? Math.round(metrics.totalDuration / metrics.successfulRequests)
    : 0;

  const avgFirstToken = metrics.successfulRequests > 0
    ? Math.round(metrics.totalFirstToken / metrics.successfulRequests)
    : 0;

  const avgWords = metrics.successfulRequests > 0
    ? Math.round(metrics.totalWords / metrics.successfulRequests)
    : 0;

  const throughput = (metrics.totalRequests / (elapsed / 1000)).toFixed(2);

  console.log('\n\n' + '='.repeat(80));
  console.log(`LOAD TEST RESULTS: ${config.name}`);
  console.log('='.repeat(80));
  console.log(`Description: ${config.description}`);
  console.log(`Chatbot ID: ${CHATBOT_ID}`);
  console.log(`Duration: ${(elapsed / 1000).toFixed(1)}s`);
  console.log('');

  console.log('REQUEST STATISTICS:');
  console.log(`  Total Requests:      ${metrics.totalRequests}`);
  console.log(`  Successful:          ${metrics.successfulRequests}`);
  console.log(`  Failed:              ${metrics.failedRequests}`);
  console.log(`  Success Rate:        ${successRate}%`);
  console.log(`  Throughput:          ${throughput} req/s`);
  console.log('');

  console.log('LATENCY STATISTICS (ms):');
  console.log(`  First Token (avg):   ${avgFirstToken}`);
  console.log(`  First Token (p50):   ${calculatePercentile(metrics.firstTokenLatencies, 50)}`);
  console.log(`  First Token (p95):   ${calculatePercentile(metrics.firstTokenLatencies, 95)}`);
  console.log(`  First Token (p99):   ${calculatePercentile(metrics.firstTokenLatencies, 99)}`);
  console.log(`  Complete (avg):      ${avgDuration}`);
  console.log(`  Complete (p50):      ${calculatePercentile(metrics.latencies, 50)}`);
  console.log(`  Complete (p95):      ${calculatePercentile(metrics.latencies, 95)}`);
  console.log(`  Complete (p99):      ${calculatePercentile(metrics.latencies, 99)}`);
  console.log('');

  console.log('RESPONSE STATISTICS:');
  console.log(`  Avg Words/Response:  ${avgWords}`);
  console.log('');

  if (Object.keys(metrics.errors).length > 0) {
    console.log('ERROR BREAKDOWN:');
    Object.entries(metrics.errors).forEach(([error, count]) => {
      console.log(`  ${error}: ${count}`);
    });
    console.log('');
  }

  console.log('PASS/FAIL CRITERIA:');
  const checks = [
    {
      name: 'Success Rate >= 95%',
      pass: parseFloat(successRate) >= 95,
      value: `${successRate}%`
    },
    {
      name: 'Avg First Token < 1000ms',
      pass: avgFirstToken < 1000,
      value: `${avgFirstToken}ms`
    },
    {
      name: 'P95 First Token < 1500ms',
      pass: calculatePercentile(metrics.firstTokenLatencies, 95) < 1500,
      value: `${calculatePercentile(metrics.firstTokenLatencies, 95)}ms`
    },
    {
      name: 'Avg Complete < 3000ms',
      pass: avgDuration < 3000,
      value: `${avgDuration}ms`
    }
  ];

  checks.forEach(check => {
    const status = check.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} - ${check.name} (${check.value})`);
  });

  const allPassed = checks.every(c => c.pass);
  console.log('');
  console.log('='.repeat(80));
  console.log(`OVERALL: ${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
  console.log('='.repeat(80));
}

/**
 * Run load test
 */
async function runLoadTest(config) {
  console.log('='.repeat(80));
  console.log(`Starting Load Test: ${config.name}`);
  console.log('='.repeat(80));
  console.log(`Concurrency: ${config.concurrency} users`);
  console.log(`Total Requests: ${config.totalRequests}`);
  console.log(`Ramp-up Time: ${config.rampUpTime}ms`);
  console.log(`Description: ${config.description}`);
  console.log('='.repeat(80));
  console.log('');

  const delayBetweenRequests = config.rampUpTime / config.concurrency;
  let requestsStarted = 0;
  let activeRequests = 0;
  const maxConcurrency = config.concurrency;

  // Start progress indicator
  console.log('Running test...\n');

  while (requestsStarted < config.totalRequests || activeRequests > 0) {
    // Launch new requests up to concurrency limit
    while (activeRequests < maxConcurrency && requestsStarted < config.totalRequests) {
      activeRequests++;
      requestsStarted++;

      makeStreamingRequest()
        .then(result => {
          trackResult({ success: true, ...result });
        })
        .catch(error => {
          trackResult({ success: false, error });
        })
        .finally(() => {
          activeRequests--;
          printProgress(metrics.totalRequests, config.totalRequests);
        });

      // Delay between launching requests (ramp-up)
      if (requestsStarted < config.totalRequests) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
      }
    }

    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Print final report
  printReport(config);
}

// Main execution
const config = TEST_CONFIGS[TEST_TYPE];

if (!config) {
  console.error(`Unknown test type: ${TEST_TYPE}`);
  console.error(`Available types: ${Object.keys(TEST_CONFIGS).join(', ')}`);
  process.exit(1);
}

runLoadTest(config).catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
