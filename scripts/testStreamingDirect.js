/**
 * Direct test of streaming response generation
 * Tests the intelligent response service streaming method directly
 */

require('dotenv').config();

const IntelligentResponseService = require('../services/intelligentResponseService');
const StreamingResponseService = require('../services/streamingResponseService');

async function testDirectStreaming() {
  console.log('Testing streaming response generation directly...\n');

  const intelligentService = new IntelligentResponseService();
  const streamingService = new StreamingResponseService();

  // Create a mock SSE connection
  const mockSSE = {
    writeHead: () => {},
    write: (data) => {
      // Parse SSE format
      if (typeof data === 'string' && data.includes('event:')) {
        const lines = data.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('event:')) {
            const eventType = lines[i].substring(6).trim();
            const dataLine = lines[i + 1];
            if (dataLine && dataLine.startsWith('data:')) {
              try {
                const eventData = JSON.parse(dataLine.substring(5).trim());
                console.log(`[${eventType.toUpperCase()}]`, JSON.stringify(eventData).substring(0, 100));
              } catch (e) {
                console.log(`[${eventType.toUpperCase()}]`, dataLine.substring(5, 50));
              }
            }
          }
        }
      }
    },
    end: () => {},
    on: () => {}
  };

  try {
    // Create response generator
    const responseGenerator = () => intelligentService.generateStreamingResponse({
      query: 'What AI services do you offer?',
      chatbotId: null,
      sessionId: null,
      email: null,
      phone: null,
      context: {}
    });

    console.log('Starting stream...\n');

    const result = await streamingService.streamResponse({
      responseGenerator,
      sseConnection: mockSSE,
      enableTTS: false, // Disable TTS for faster testing
      languageCode: 'en-IN'
    });

    console.log('\n=== RESULT ===');
    console.log('Full Text Length:', result.fullText?.length || 0);
    console.log('Full Text Preview:', result.fullText?.substring(0, 200));
    console.log('Word Count:', result.metrics?.wordCount);
    console.log('Duration:', result.duration + 'ms');
    console.log('Suggestions:', result.suggestions?.length || 0);

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  }
}

testDirectStreaming()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
