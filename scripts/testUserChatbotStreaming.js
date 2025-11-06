/**
 * Test script for user chatbot streaming API endpoint
 * Tests /api/chat/query/stream
 *
 * Usage: node scripts/testUserChatbotStreaming.js [chatbotId] [query]
 */

const http = require('http');
const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const API_ENDPOINT = '/api/chat/query/stream';

const CHATBOT_ID = process.argv[2] || 'test-chatbot-id';
const TEST_QUERY = process.argv[3] || 'What are your services?';

// Generate a valid UUID v4
function generateUUID() {
  return crypto.randomUUID();
}

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

function testUserChatbotStreaming() {
  return new Promise((resolve, reject) => {
    const url = new URL(API_ENDPOINT, BASE_URL);

    const requestBody = JSON.stringify({
      query: TEST_QUERY,
      chatbotId: CHATBOT_ID,
      sessionId: generateUUID(), // Generate valid UUID v4
      enableTTS: false, // Set to true to test audio streaming
      language: 'en-IN'
    });

    log(colors.cyan, 'REQUEST', `POST ${url.href}`);
    log(colors.cyan, 'CHATBOT', CHATBOT_ID);
    log(colors.cyan, 'QUERY', TEST_QUERY);
    console.log('');

    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        'Accept': 'text/event-stream'
      }
    };

    const req = http.request(options, (res) => {
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
      let suggestions = [];
      const startTime = Date.now();

      // SSE parsing with buffering for multi-chunk events
      let buffer = '';
      let currentEvent = null;

      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        // Debug: Log raw chunk
        const DEBUG_SSE = false; // Enable to see raw SSE data
        if (DEBUG_SSE) {
          console.log('\n===== RAW SSE CHUNK =====');
          console.log(JSON.stringify(chunk));
          console.log('========================\n');
        }

        // Add chunk to buffer
        buffer += chunk;

        // Process complete SSE events (event + data + empty line)
        const events = buffer.split('\n\n');

        // Keep the last incomplete event in buffer
        buffer = events.pop() || '';

        for (const eventBlock of events) {
          const lines = eventBlock.split('\n');
          let eventType = null;
          let eventData = null;

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              eventData = line.substring(5).trim();
            }
          }

          if (eventType && eventData) {
            try {
              const data = JSON.parse(eventData);

              switch (eventType) {
                  case 'connected':
                    log(colors.blue, 'CONNECTED', `Client ID: ${data.clientId}`);
                    break;

                  case 'status':
                    log(colors.yellow, 'STATUS', data.message || data.status);
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
      });

      res.on('end', () => {
        const totalTime = Date.now() - startTime;
        console.log('\n' + '='.repeat(60));
        log(colors.bright, 'SUMMARY', `Total time: ${totalTime}ms`);
        log(colors.bright, 'TEXT', `${fullText.split(/\s+/).filter(Boolean).length} words`);
        if (fullText) {
          console.log(`Full response: "${fullText}"`);
        }
        log(colors.bright, 'AUDIO', `${audioChunkCount} chunks`);
        log(colors.bright, 'SUGGESTIONS', `${suggestions.length} items`);
        console.log('='.repeat(60));
        resolve({
          fullText,
          audioChunkCount,
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
    log(colors.bright, 'TEST', 'User Chatbot Streaming API');
    console.log('='.repeat(60));
    console.log('');

    await testUserChatbotStreaming();

    console.log('');
    log(colors.green, 'SUCCESS', 'Test completed successfully');
    process.exit(0);
  } catch (error) {
    console.log('');
    log(colors.red, 'FAILED', error.message);
    process.exit(1);
  }
})();
