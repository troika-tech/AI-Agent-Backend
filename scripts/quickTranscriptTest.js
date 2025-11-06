#!/usr/bin/env node
/**
 * Quick Transcript Test - Minimal version
 * Tests transcript sending with minimal data
 *
 * Usage: node scripts/quickTranscriptTest.js <phone>
 */

require('dotenv').config();
const axios = require('axios');

const phone = process.argv[2] || '9876543210';
const apiBase = process.env.API_BASE || 'http://localhost:5000/api';

const testData = {
  sessionId: `quick-test-${Date.now()}`,
  phone: phone,
  chatbotId: '507f1f77bcf86cd799439011', // Dummy ObjectId
  chatHistory: [
    { sender: 'user', content: 'Hello', timestamp: new Date() },
    { sender: 'bot', content: 'Hi! How can I help you?', timestamp: new Date() }
  ]
};

console.log('\n🚀 Quick Transcript Test');
console.log('========================');
console.log(`📞 Phone: ${phone}`);
console.log(`🌐 API: ${apiBase}/conversation-transcript/send`);
console.log(`📊 Messages: ${testData.chatHistory.length}`);
console.log('\n⏳ Sending request...\n');

axios.post(`${apiBase}/conversation-transcript/send`, testData)
  .then(response => {
    console.log('✅ SUCCESS!');
    console.log('============');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('\n📱 Check WhatsApp for the PDF!');
    process.exit(0);
  })
  .catch(error => {
    console.log('❌ FAILED!');
    console.log('===========');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
    process.exit(1);
  });
