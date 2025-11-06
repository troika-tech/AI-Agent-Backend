/**
 * Test Mixpanel by sending Streaming Completed events
 */

require('dotenv').config();

const mixpanelService = require('../services/mixpanelService');

console.log('🧪 Testing Mixpanel - Sending Streaming Completed Event\n');

// Send a Streaming Completed event
mixpanelService.trackStreamingCompleted({
  sessionId: 'test-session-' + Date.now(),
  chatbotId: 'test-chatbot-123',
  durationMs: 3500,
  wordCount: 150,
  audioChunks: 8,
  intelligenceLevel: 'standard',
  intelligenceUsed: 3,
  responseMode: 'detailed',
  hasSuggestions: true
});

console.log('✅ Streaming Completed event sent!');
console.log('\n📊 Wait 1-2 minutes, then refresh your Mixpanel dashboard');
console.log('   You should see "Streaming Completed" in the event list\n');

setTimeout(() => {
  process.exit(0);
}, 2000);
