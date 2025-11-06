#!/usr/bin/env node
/**
 * Test ALL Languages Support
 * Comprehensive test for global multilingual PDF support
 */

require('dotenv').config();
const axios = require('axios');

const phone = process.argv[2] || '9834699858';
const apiBase = 'https://api.0804.in/api';

// Comprehensive multilingual test conversation
const testData = {
  sessionId: `all-languages-test-${Date.now()}`,
  phone: phone,
  chatbotId: '507f1f77bcf86cd799439011',
  chatHistory: [
    {
      sender: 'user',
      content: '🌍 Testing All Major World Languages',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: 'Welcome! Let\'s test comprehensive language support across the globe! 🚀',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'user',
      content: '🇮🇳 Indian Languages:\nHindi: नमस्ते, मुझे मदद चाहिए\nTamil: வணக்கம், எனக்கு உதவி வேண்டும்\nTelugu: నమస్కారం, నాకు సహాయం కావాలి\nKannada: ನಮಸ್ಕಾರ, ನನಗೆ ಸಹಾಯ ಬೇಕು\nMalayalam: ഹലോ, എനിക്ക് സഹായം വേണം\nGujarati: નમસ્તે, મને મદદ જોઈએ છે\nPunjabi: ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਨੂੰ ਮਦਦ ਚਾਹੀਦੀ ਹੈ\nBengali: হ্যালো, আমার সাহায্য দরকার\nMarathi: नमस्कार, मला मदत हवी आहे\nOdia: ନମସ୍କାର, ମୋତେ ସାହାଯ୍ୟ ଦରକାର',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: '✅ Indian languages look great! Let\'s test more regions...',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'user',
      content: '🌏 East Asian Languages:\nChinese (Simplified): 你好，我需要帮助 (Nǐ hǎo, wǒ xūyào bāngzhù)\nChinese (Traditional): 你好，我需要幫助\nJapanese: こんにちは、助けが必要です (Konnichiwa, tasuke ga hitsuyō desu)\nKorean: 안녕하세요, 도움이 필요합니다 (Annyeonghaseyo, doumi pilyohamnida)\nThai: สวัสดี ฉันต้องการความช่วยเหลือ\nVietnamese: Xin chào, tôi cần giúp đỡ\nKhmer: សួស្តី ខ្ញុំត្រូវការជំនួយ',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: '✅ East Asian scripts rendering perfectly! Moving to Middle East and Africa...',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'user',
      content: '🌍 Middle Eastern & African Languages:\nArabic: مرحبا، أحتاج المساعدة (Marhaba, ahtaj almusa\'ada)\nHebrew: שלום, אני צריך עזרה (Shalom, ani tzarikh ezra)\nUrdu: ہیلو، مجھے مدد چاہیے (Hello, mujhe madad chahiye)\nPersian: سلام، به کمک نیاز دارم (Salaam, be komak niyaz daram)\nAmharic: ሰላም፣ እገዛ እፈልጋለሁ\nSwahili: Habari, nahitaji msaada',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: '✅ Right-to-left languages working! Let\'s test Southeast Asia...',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'user',
      content: '🌏 Southeast Asian Languages:\nMyanmar: မင်္ဂလာပါ၊ အကူအညီလိုပါတယ်\nLao: ສະບາຍດີ, ຂ້ອຍຕ້ອງການຄວາມຊ່ວຍເຫຼືອ\nSinhala: හෙලෝ, මට උදව් අවශ්‍යයි\nTibetan: བཀྲ་ཤིས་བདེ་ལེགས། ངལ་རོགས་པ་དགོས།\nMongolian: Сайн уу, надад тусламж хэрэгтэй байна',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: '✅ Southeast Asian scripts perfect! Testing European languages...',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'user',
      content: '🇪🇺 European Languages:\nSpanish: Hola, necesito ayuda\nFrench: Bonjour, j\'ai besoin d\'aide\nGerman: Hallo, ich brauche Hilfe\nRussian: Привет, мне нужна помощь (Privet, mne nuzhna pomoshch)\nItalian: Ciao, ho bisogno di aiuto\nPolish: Cześć, potrzebuję pomocy\nGreek: Γεια σου, χρειάζομαι βοήθεια (Geia sou, chriázomai voítheia)\nPortuguese: Olá, preciso de ajuda\nDutch: Hallo, ik heb hulp nodig\nTurkish: Merhaba, yardıma ihtiyacım var',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: '✅ European languages excellent! Special characters test...',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'user',
      content: '✨ Special Characters & Symbols:\n🎯 Emojis: 😀 🎉 🚀 💪 ❤️ 🌟 ✅ ⭐ 🔥 💡\n➡️ Arrows: → ← ↑ ↓ ⇒ ⇐ ➜ ➔\n✓ Checkmarks: ✓ ✔ ✅ ☑\n★ Stars: ★ ☆ ⭐ 🌟\n© Symbols: © ® ™ € $ ¥ £ ₹\n• Bullets: • ◦ ▪ ▫ ○ ●\n─ Lines: ─ ═ │ ║ ┌ ┐ └ ┘',
      timestamp: new Date().toISOString()
    },
    {
      sender: 'bot',
      content: '🎉 Perfect! All symbols rendered correctly!\n\n📊 Test Summary:\n✅ Indian Languages (10 scripts)\n✅ East Asian (7 scripts)\n✅ Middle Eastern (6 scripts)\n✅ Southeast Asian (5 scripts)\n✅ European (10+ languages)\n✅ Special Characters & Emojis\n\n🌍 Total: 50+ languages tested successfully!',
      timestamp: new Date().toISOString()
    }
  ]
};

console.log('\n' + '='.repeat(70));
console.log('🌍 COMPREHENSIVE MULTILINGUAL PDF TEST');
console.log('='.repeat(70));
console.log(`\n📞 Phone: ${phone}`);
console.log(`🌐 API: ${apiBase}/conversation-transcript/send`);
console.log(`📊 Messages: ${testData.chatHistory.length}`);
console.log(`🆔 Session: ${testData.sessionId}`);
console.log('\n📝 Testing Languages:\n');
console.log('  🇮🇳 Indian Languages (10):');
console.log('     Hindi, Tamil, Telugu, Kannada, Malayalam,');
console.log('     Gujarati, Punjabi, Bengali, Marathi, Odia');
console.log('\n  🌏 East Asian (7):');
console.log('     Chinese (Simplified & Traditional), Japanese,');
console.log('     Korean, Thai, Vietnamese, Khmer');
console.log('\n  🌍 Middle Eastern & African (6):');
console.log('     Arabic, Hebrew, Urdu, Persian, Amharic, Swahili');
console.log('\n  🌏 Southeast Asian (5):');
console.log('     Myanmar, Lao, Sinhala, Tibetan, Mongolian');
console.log('\n  🇪🇺 European (10+):');
console.log('     Spanish, French, German, Russian, Italian,');
console.log('     Polish, Greek, Portuguese, Dutch, Turkish');
console.log('\n  ✨ Special Characters:');
console.log('     Emojis, Symbols, Mathematical operators');
console.log('\n' + '-'.repeat(70));
console.log('⏳ Sending comprehensive test to production...');
console.log('⚠️  Note: This may take 10-15 seconds due to font loading\n');

axios.post(`${apiBase}/conversation-transcript/send`, testData, {
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 120000 // 2 minute timeout for comprehensive font loading
})
  .then(response => {
    console.log('='.repeat(70));
    console.log('✅ SUCCESS!');
    console.log('='.repeat(70));
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.s3Url) {
      console.log('\n📄 PDF URL:', response.data.s3Url);
    }

    console.log('\n📱 Check WhatsApp number', phone, 'for the comprehensive PDF!');
    console.log('\n🔍 Verification Checklist:');
    console.log('   [ ] Hindi/Devanagari displays correctly');
    console.log('   [ ] Tamil/Telugu/Kannada scripts visible');
    console.log('   [ ] Chinese/Japanese/Korean characters clear');
    console.log('   [ ] Arabic/Hebrew right-to-left text works');
    console.log('   [ ] Thai/Myanmar/Khmer scripts readable');
    console.log('   [ ] Emojis render properly');
    console.log('   [ ] No boxes (□) or question marks (?)');
    console.log('   [ ] All special symbols display correctly');
    console.log('\n✨ If all items check out, global multilingual support is WORKING!');
    console.log('\n' + '='.repeat(70) + '\n');
    process.exit(0);
  })
  .catch(error => {
    console.log('='.repeat(70));
    console.log('❌ FAILED!');
    console.log('='.repeat(70));

    if (error.response) {
      console.log('\nStatus:', error.response.status);
      console.log('Error:', JSON.stringify(error.response.data, null, 2));

      if (error.response.data.error) {
        console.log('\n🔍 Error Details:', error.response.data.error);
      }
    } else if (error.request) {
      console.log('\nNo response received from server');
      console.log('Request details:', error.message);
    } else {
      console.log('\nError:', error.message);
    }

    console.log('\n📋 Debugging Steps:');
    console.log('1. Check backend logs: pm2 logs chatbot-backend');
    console.log('2. Verify fonts loaded: Check for "Fonts loaded successfully" in logs');
    console.log('3. Test network: curl https://fonts.googleapis.com');
    console.log('4. Increase timeout if fonts are slow to load');
    console.log('\n' + '='.repeat(70) + '\n');

    process.exit(1);
  });
