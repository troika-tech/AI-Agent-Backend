/**
 * Test script for streaming API endpoint
 * Tests /api/troika/intelligent-chat/stream
 *
 * Usage: node scripts/testStreamingApi.js
 */

const https = require('https');
const http = require('http');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const API_ENDPOINT = '/api/troika/intelligent-chat/stream';

const TEST_QUERY = process.argv[2] || 'Tell me about your AI services';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m'
};

function log(color, prefix, message) {
  console.log(`${color}${colors.bright}[${prefix}]${colors.reset} ${message}`);
}

function testStreamingAPI() {
  return new Promise((resolve, reject) => {
    const url = new URL(API_ENDPOINT, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestBody = JSON.stringify({
      query: TEST_QUERY,
      enableTTS: true,
      language: 'en-IN',
      context: {
        industry: 'Technology',
        services: ['AI', 'Machine Learning']
      }
    });

    log(colors.cyan, 'REQUEST', `POST ${url.href}`);
    log(colors.cyan, 'QUERY', TEST_QUERY);
    console.log('');

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'Accept': 'text/event-stream'
      }
    };

    const req = client.request(options, (res) => {
      log(colors.green, 'STATUS', `${res.statusCode} ${res.statusMessage}`);

      if (res.statusCode !== 200) {
        log(colors.red, 'ERROR', 'Non-200 status code received');
        let errorData = '';
        res.on('data', chunk => errorData += chunk);
        res.on('end', () => {
          console.error(errorData);
          reject(new Error(`HTTP ${res.statusCode}`));
        });
        return;
      }

      let fullText = '';
      let audioChunkCount = 0;
      let metadata = null;
      let suggestions = [];
      const startTime = Date.now();

      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        // Parse SSE data
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

                switch (eventType) {
                  case 'connected':
                    log(colors.blue, 'CONNECTED', `Client ID: ${data.clientId}`);
                    break;

                  case 'metadata':
                    metadata = data;
                    log(colors.magenta, 'METADATA', `Intent: ${data.intent}, Level: ${data.intelligenceLevel || 'N/A'}`);
                    break;

                  case 'text':
                    process.stdout.write(colors.green + data.content + colors.reset);
                    fullText += data.content;
                    break;

                  case 'audio':
                    audioChunkCount++;
                    if (audioChunkCount === 1) {
                      log(colors.yellow, '\nAUDIO', `First audio chunk received (sequence: ${data.sequence})`);
                    }
                    break;

                  case 'suggestions':
                    suggestions = data.suggestions || [];
                    console.log('\n');
                    log(colors.cyan, 'SUGGESTIONS', `${suggestions.length} suggestions received`);
                    suggestions.forEach((s, idx) => {
                      console.log(`  ${idx + 1}. ${s}`);
                    });
                    break;

                  case 'complete':
                    console.log('\n');
                    log(colors.green, 'COMPLETE', 'Stream finished');
                    console.log(`  Duration: ${data.duration}ms`);
                    console.log(`  Words: ${data.wordCount}`);
                    console.log(`  Sentences: ${data.sentenceCount}`);
                    console.log(`  Audio Chunks: ${data.audioChunks}`);
                    console.log(`  First Token: ${data.firstTokenLatency}ms`);
                    console.log(`  First Audio: ${data.firstAudioLatency || 'N/A'}ms`);
                    break;

                  case 'error':
                    log(colors.red, 'ERROR', data.error);
                    break;

                  case 'warning':
                    log(colors.yellow, 'WARNING', data.warning);
                    break;

                  case 'close':
                    log(colors.blue, 'CLOSE', 'Connection closed by server');
                    break;
                }
              } catch (parseError) {
                // Ignore parse errors for heartbeats and other non-JSON data
              }
            }
          }
        }
      });

      res.on('end', () => {
        const totalTime = Date.now() - startTime;
        console.log('\n' + '='.repeat(60));
        log(colors.bright, 'SUMMARY', `Total time: ${totalTime}ms`);
        log(colors.bright, 'TEXT', `${fullText.split(/\s+/).length} words`);
        log(colors.bright, 'AUDIO', `${audioChunkCount} chunks`);
        console.log('='.repeat(60));
        resolve({
          fullText,
          audioChunkCount,
          metadata,
          suggestions,
          totalTime
        });
      });

      res.on('error', (error) => {
        log(colors.red, 'STREAM ERROR', error.message);
        reject(error);
      });
    });

    req.on('error', (error) => {
      log(colors.red, 'REQUEST ERROR', error.message);
      reject(error);
    });

    req.write(requestBody);
    req.end();
  });
}

// Run the test
(async () => {
  try {
    console.log('='.repeat(60));
    log(colors.bright, 'TEST', 'Troika Intelligent Chat Streaming API');
    console.log('='.repeat(60));
    console.log('');

    await testStreamingAPI();

    console.log('');
    log(colors.green, 'SUCCESS', 'Test completed successfully');
    process.exit(0);
  } catch (error) {
    console.log('');
    log(colors.red, 'FAILED', error.message);
    process.exit(1);
  }
})();
