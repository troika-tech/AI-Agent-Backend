#!/usr/bin/env node
/**
 * Test Multilingual Transcript
 * Tests PDF generation with Hindi and other Indian languages
 */

require('dotenv').config();
const axios = require('axios');

const phone = process.argv[2] || '9834699858';
const apiBase = 'https://api.0804.in/api';

// Multilingual test conversation
const testData = {
  sessionId: `multilingual-test-${Date.now()}`,
  phone: phone,
  chatbotId: '507f1f77bcf86cd799439011',
  chatHistory: [
    {
      sender: 'user',
      content: 'नमस्ते! मुझे आपके AI एजेंट के बारे में जानना है।',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: 'नमस्ते! हमारे AI एजेंट के बारे में जानकारी देने में मुझे खुशी होगी। हम निम्नलिखित समाधान प्रदान करते हैं:\n\n1. **AI Supa Agent** - वेबसाइट के लिए बुद्धिमान चैटबॉट\n2. **AI Calling Agent** - स्वचालित वॉयस कॉलिंग सिस्टम\n3. **RCS Messaging** - रिच कम्युनिकेशन सर्विसेज\n4. **WhatsApp Marketing** - स्वचालित WhatsApp अभियान',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'user',
      content: 'मुझे कीमत के बारे में बताइए',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: 'हमारी कीमतें ₹9,999/माह से शुरू होती हैं। क्या आप चाहेंगे कि मैं आपके WhatsApp पर विस्तृत प्रस्ताव भेजूं?',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'user',
      content: 'हाँ, कृपया भेजिए',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: 'बिल्कुल! मैं आपके WhatsApp नंबर पर विस्तृत प्रस्ताव भेज रहा हूं। धन्यवाद! 🙏',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'user',
      content: 'Testing other languages: தமிழ் | తెలుగు | ಕನ್ನಡ | മലയാളം | ગુજરાતી | ਪੰਜਾਬੀ | বাংলা | मराठी',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: 'Great! Our system supports multiple Indian languages:\n✅ Hindi (हिंदी)\n✅ Tamil (தமிழ்)\n✅ Telugu (తెలుగు)\n✅ Kannada (ಕನ್ನಡ)\n✅ Malayalam (മലയാളം)\n✅ Gujarati (ગુજરાતી)\n✅ Punjabi (ਪੰਜਾਬੀ)\n✅ Bengali (বাংলা)\n✅ Marathi (मराठी)',
      timestamp: new Date().toISOString()
    }
  ]
};

console.log('\n🌍 Multilingual Transcript Test');
console.log('================================');
console.log(`📞 Phone: ${phone}`);
console.log(`🌐 API: ${apiBase}/conversation-transcript/send`);
console.log(`📊 Messages: ${testData.chatHistory.length}`);
console.log(`🆔 Session: ${testData.sessionId}`);
console.log('\n📝 Languages tested:');
console.log('   - Hindi (हिंदी)');
console.log('   - Tamil (தமிழ்)');
console.log('   - Telugu (తెలుగు)');
console.log('   - Kannada (ಕನ್ನಡ)');
console.log('   - Malayalam (മലയാളം)');
console.log('   - Gujarati (ગુજરાતી)');
console.log('   - Punjabi (ਪੰਜਾਬੀ)');
console.log('   - Bengali (বাংলা)');
console.log('   - Marathi (मराठी)');
console.log('\n⏳ Sending request to production...\n');

axios.post(`${apiBase}/conversation-transcript/send`, testData, {
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 90000 // 90 second timeout for font loading
})
  .then(response => {
    console.log('✅ SUCCESS!');
    console.log('============');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.s3Url) {
      console.log('\n📄 PDF URL:', response.data.s3Url);
    }

    console.log('\n📱 Check WhatsApp number', phone, 'for the PDF transcript!');
    console.log('\n🔍 Verify that:');
    console.log('   1. Hindi text (हिंदी) displays correctly');
    console.log('   2. Regional language scripts are readable');
    console.log('   3. No boxes or question marks appear');
    console.log('\n✨ If all languages display properly, multilingual support is working!');
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
    console.log('2. Verify fonts loaded properly');
    console.log('3. Test with English first to isolate font issues');

    process.exit(1);
  });
