#!/usr/bin/env node
/**
 * Production Transcript Test
 * Tests transcript sending on production API
 *
 * Usage: node scripts/testProductionTranscript.js <phone>
 */

require('dotenv').config();
const axios = require('axios');

const phone = process.argv[2];

if (!phone) {
  console.error('❌ Error: Phone number is required');
  console.log('\nUsage: node scripts/testProductionTranscript.js <phone>');
  console.log('Example: node scripts/testProductionTranscript.js 9834699858');
  process.exit(1);
}

const apiBase = 'https://api.0804.in/api';

const testData = {
  sessionId: `prod-test-${Date.now()}`,
  phone: phone,
  chatbotId: '507f1f77bcf86cd799439011', // Dummy ObjectId
  chatHistory: [
    {
      sender: 'user',
      content: 'Hi! I want to know more about your AI agents.',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: 'Hello! I\'d be happy to help you learn about our AI agents. We offer AI Supa Agent, AI Calling Agent, RCS Messaging, and WhatsApp Marketing solutions.',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'user',
      content: 'Tell me about pricing',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: 'Our pricing starts from ₹9,999/month with customized plans available. Would you like a detailed proposal sent to your WhatsApp?',
      timestamp: new Date().toISOString()
    }
  ]
};

console.log('\n🚀 Production Transcript Test');
console.log('=============================');
console.log(`📞 Phone: ${phone}`);
console.log(`🌐 API: ${apiBase}/conversation-transcript/send`);
console.log(`📊 Messages: ${testData.chatHistory.length}`);
console.log(`🆔 Session: ${testData.sessionId}`);
console.log('\n⏳ Sending request to production...\n');

axios.post(`${apiBase}/conversation-transcript/send`, testData, {
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 60000 // 60 second timeout
})
  .then(response => {
    console.log('✅ SUCCESS!');
    console.log('============');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.s3Url) {
      console.log('\n📄 PDF URL:', response.data.s3Url);
    }

    console.log('\n📱 Check WhatsApp number', phone, 'for the PDF transcript!');
    console.log('\n✨ If you received it, the transcript feature is working in production!');
    process.exit(0);
  })
  .catch(error => {
    console.log('❌ FAILED!');
    console.log('===========');

    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));

      if (error.response.data.error) {
        console.log('\n🔍 Error Details:', error.response.data.error);
      }
    } else if (error.request) {
      console.log('No response received from server');
      console.log('Request details:', error.message);
    } else {
      console.log('Error:', error.message);
    }

    console.log('\n📋 Debugging Steps:');
    console.log('1. Check backend logs: pm2 logs chatbot-backend');
    console.log('2. Verify S3 access: curl https://api.0804.in/api/conversation-transcript/s3-status');
    console.log('3. Check AiSensy template "chatsummarytemp" exists');

    process.exit(1);
  });
