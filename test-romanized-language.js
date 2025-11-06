/**
 * Test script for romanized language support
 * Tests multiple romanized languages input and response
 */

const axios = require('axios');

const CHATBOT_ID = '68ff51efd9538341c9e1e34c';
const BASE_URL = 'http://localhost:5000'; // Update if your backend runs on a different port

// Test queries for different romanized languages
const testQueries = {
  gujarati: [
    { query: 'tame kai seva aapdo che', expected: 'gu', name: 'Gujarati - Basic service inquiry' },
    { query: 'mane WhatsApp marketing vishe mahiti joiye', expected: 'gu', name: 'Gujarati - Specific service info' },
    { query: 'ame ketla paisa ma aa service mali sake', expected: 'gu', name: 'Gujarati - Pricing inquiry' },
  ],
  hindi: [
    { query: 'kya price hai tumhari service ki', expected: 'hi', name: 'Hindi - Price inquiry' },
    { query: 'mujhe WhatsApp marketing ke baare mein janna hai', expected: 'hi', name: 'Hindi - Service information' },
    { query: 'aapki company kya services deti hai', expected: 'hi', name: 'Hindi - Company services' },
  ],
  marathi: [
    { query: 'mala mahiti havi aahe WhatsApp marketing vishayi', expected: 'mr', name: 'Marathi - Information request' },
    { query: 'tumhala kay services ahet', expected: 'mr', name: 'Marathi - Services inquiry' },
    { query: 'kimmat kithi aahe', expected: 'mr', name: 'Marathi - Price question' },
  ],
  tamil: [
    { query: 'enakku WhatsApp marketing pathi therinja venum', expected: 'ta', name: 'Tamil - Service info' },
    { query: 'enna services kodukreenga', expected: 'ta', name: 'Tamil - Services list' },
    { query: 'rate enna irukku', expected: 'ta', name: 'Tamil - Price inquiry' },
  ],
  telugu: [
    { query: 'nenu WhatsApp marketing gurinchi thelusukovaalanukunnaanu', expected: 'te', name: 'Telugu - Service info' },
    { query: 'meeru emi services istaru', expected: 'te', name: 'Telugu - Services inquiry' },
    { query: 'price entha untundi', expected: 'te', name: 'Telugu - Pricing' },
  ],
  kannada: [
    { query: 'nanage WhatsApp marketing bagge tiliyabeku', expected: 'kn', name: 'Kannada - Service info' },
    { query: 'nimma services yaavuvu', expected: 'kn', name: 'Kannada - Services list' },
    { query: 'price eshtu ide', expected: 'kn', name: 'Kannada - Price question' },
  ],
  malayalam: [
    { query: 'enikku WhatsApp marketing patti ariyanum', expected: 'ml', name: 'Malayalam - Service info' },
    { query: 'ningalude services enthokkeyaanu', expected: 'ml', name: 'Malayalam - Services inquiry' },
    { query: 'rate ethra undu', expected: 'ml', name: 'Malayalam - Price inquiry' },
  ],
  punjabi: [
    { query: 'tenu WhatsApp marketing bare dasseyo', expected: 'pa', name: 'Punjabi - Service info' },
    { query: 'tuhadi kihdi services ne', expected: 'pa', name: 'Punjabi - Services list' },
    { query: 'price kinna hai', expected: 'pa', name: 'Punjabi - Pricing' },
  ],
  bengali: [
    { query: 'ami WhatsApp marketing somporke jante chai', expected: 'bn', name: 'Bengali - Service info' },
    { query: 'apnar ki services ache', expected: 'bn', name: 'Bengali - Services inquiry' },
    { query: 'dam koto hobe', expected: 'bn', name: 'Bengali - Price question' },
  ],
};

// Language-specific script detection patterns
const scriptPatterns = {
  gujarati: { pattern: /[\u0A80-\u0AFF]/, name: 'ગુજરાતી', keywords: ['ame', 'tame', 'chhe', 'che', 'seva', 'aapdo', 'joiye', 'mane'] },
  hindi: { pattern: /[\u0900-\u097F]/, name: 'हिंदी', keywords: ['mujhe', 'tumhare', 'kya', 'hai', 'aapki', 'deti', 'ke'] },
  marathi: { pattern: /[\u0900-\u097F]/, name: 'मराठी', keywords: ['mala', 'tumhala', 'aahe', 'kay', 'vishayi', 'kimmat', 'kithi'] },
  tamil: { pattern: /[\u0B80-\u0BFF]/, name: 'தமிழ்', keywords: ['enakku', 'enna', 'venum', 'pathi', 'irukku', 'kodukreenga'] },
  telugu: { pattern: /[\u0C00-\u0C7F]/, name: 'తెలుగు', keywords: ['nenu', 'meeru', 'gurinchi', 'istaru', 'entha', 'untundi'] },
  kannada: { pattern: /[\u0C80-\u0CFF]/, name: 'ಕನ್ನಡ', keywords: ['nanage', 'nimma', 'bagge', 'yaavuvu', 'eshtu', 'ide'] },
  malayalam: { pattern: /[\u0D00-\u0D7F]/, name: 'മലയാളം', keywords: ['enikku', 'ningalude', 'patti', 'enthokkeyaanu', 'ethra', 'undu'] },
  punjabi: { pattern: /[\u0A00-\u0A7F]/, name: 'ਪੰਜਾਬੀ', keywords: ['tenu', 'tuhadi', 'bare', 'kihdi', 'kinna', 'dasseyo'] },
  bengali: { pattern: /[\u0980-\u09FF]/, name: 'বাংলা', keywords: ['ami', 'apnar', 'somporke', 'jante', 'chai', 'ache', 'koto'] },
};

// Common English words that should not appear in romanized responses
const commonEnglishWords = /\b(Hello|Hi|We|Our|Service|Services|Provide|Offer|Company|Business|Help|Can|Would|Should|Please|Thank|You|Welcome|About|Information|Price|Cost)\b/i;

/**
 * Test intelligent chat endpoint
 */
async function testIntelligentChat(testCase, languageKey) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📝 ${testCase.name}`);
  console.log(`Query: "${testCase.query}"`);
  console.log(`Expected Language: ${testCase.expected}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const response = await axios.post(
      `${BASE_URL}/api/troika/intelligent-chat`,
      {
        query: testCase.query,
        chatbotId: CHATBOT_ID,
        sessionId: `test_session_${Date.now()}`,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 second timeout
      }
    );

    console.log('\n✅ Response received:');
    console.log('─────────────────────────────────────────');
    console.log(`Answer: ${response.data.answer}`);
    console.log('─────────────────────────────────────────');

    // Get language detection info
    const langInfo = scriptPatterns[languageKey];

    // Check if response is in native script (WRONG)
    const hasNativeScript = langInfo.pattern.test(response.data.answer);

    // Check if response is in pure English (WRONG)
    const hasEnglishWords = commonEnglishWords.test(response.data.answer);

    // Check if response has romanized keywords (CORRECT)
    const hasRomanizedKeywords = langInfo.keywords.some(keyword =>
      new RegExp(`\\b${keyword}\\b`, 'i').test(response.data.answer)
    );

    console.log('\n📊 Language Analysis:');
    console.log(`   Contains native script (${langInfo.name}): ${hasNativeScript ? '❌ YES (WRONG!)' : '✅ NO (GOOD!)'}`);
    console.log(`   Contains English words: ${hasEnglishWords ? '⚠️ YES (CHECK IF TOO MANY)' : '✅ NO (GOOD!)'}`);
    console.log(`   Contains Romanized keywords: ${hasRomanizedKeywords ? '✅ YES (GOOD!)' : '⚠️ NO (CHECK RESPONSE)'}`);

    // Determine test result
    let testResult = 'UNCERTAIN';
    if (!hasNativeScript && hasRomanizedKeywords) {
      testResult = 'PASSED';
      console.log('\n🎉 TEST PASSED! Response is in romanized format.');
    } else if (hasNativeScript) {
      testResult = 'FAILED';
      console.log(`\n❌ TEST FAILED! Response is in native ${langInfo.name} script instead of romanized.`);
    } else if (hasEnglishWords && !hasRomanizedKeywords) {
      testResult = 'FAILED';
      console.log('\n❌ TEST FAILED! Response is in English instead of romanized language.');
    } else {
      console.log('\n⚠️ TEST UNCERTAIN! Please manually verify the response language.');
    }

    return { success: testResult === 'PASSED', result: testResult, data: response.data };
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    return { success: false, result: 'ERROR', error: error.message };
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  ROMANIZED LANGUAGE SUPPORT TEST SUITE                       ║');
  console.log('║  Testing Multiple Romanized Languages Input/Output           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(`\nChatbot ID: ${CHATBOT_ID}`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Time: ${new Date().toLocaleString()}`);
  console.log(`\n📋 Languages to test: ${Object.keys(testQueries).length}`);
  console.log(`📝 Total test cases: ${Object.values(testQueries).flat().length}`);

  let passedTests = 0;
  let failedTests = 0;
  let uncertainTests = 0;
  let errorTests = 0;

  const results = {};

  // Test each language
  for (const [languageKey, tests] of Object.entries(testQueries)) {
    console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
    console.log(`║  TESTING ${languageKey.toUpperCase()} (${scriptPatterns[languageKey].name})`.padEnd(65) + '║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');

    results[languageKey] = [];

    for (let i = 0; i < tests.length; i++) {
      const testCase = tests[i];
      console.log(`\n🧪 TEST ${i + 1}/${tests.length}: ${testCase.name}`);

      const result = await testIntelligentChat(testCase, languageKey);
      results[languageKey].push(result);

      if (result.success) {
        passedTests++;
      } else if (result.result === 'FAILED') {
        failedTests++;
      } else if (result.result === 'UNCERTAIN') {
        uncertainTests++;
      } else if (result.result === 'ERROR') {
        errorTests++;
      }

      // Wait 2 seconds between tests to avoid rate limiting
      if (i < tests.length - 1 || Object.keys(testQueries).indexOf(languageKey) < Object.keys(testQueries).length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // Summary
  console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUMMARY                                                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const totalTests = passedTests + failedTests + uncertainTests + errorTests;
  console.log(`\n✅ Passed:    ${passedTests}/${totalTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`❌ Failed:    ${failedTests}/${totalTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`⚠️  Uncertain: ${uncertainTests}/${totalTests} (${((uncertainTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`💥 Errors:    ${errorTests}/${totalTests} (${((errorTests/totalTests)*100).toFixed(1)}%)`);

  // Per-language breakdown
  console.log('\n📊 Per-Language Results:');
  for (const [languageKey, langResults] of Object.entries(results)) {
    const passed = langResults.filter(r => r.success).length;
    const total = langResults.length;
    const status = passed === total ? '✅' : passed > 0 ? '⚠️' : '❌';
    console.log(`   ${status} ${languageKey.padEnd(12)}: ${passed}/${total} passed`);
  }

  console.log('\n📋 EXPECTED BEHAVIOR:');
  console.log('   - Bot should detect the correct romanized language');
  console.log('   - Bot should detect isRomanized as "true"');
  console.log('   - Response should be in ROMANIZED format (using English/Latin letters)');
  console.log('   - Response should NOT contain native script (देवनागरी, ગુજરાતી, etc.)');
  console.log('   - Response should NOT be in pure English');
  console.log('   - Some English technical terms are acceptable (e.g., "WhatsApp", "marketing")');

  console.log('\n💡 TIPS:');
  console.log('   - Check backend logs for language detection details');
  console.log('   - Look for "[INTELLIGENT STREAMING] Language detected: XX, isRomanized: true"');
  console.log('   - Verify the system prompt includes the language instruction');
  console.log('   - Verify the user prompt includes the critical language instruction');

  console.log('\n');
}

// Run the tests
runTests().catch(error => {
  console.error('\n💥 Test suite failed:', error);
  process.exit(1);
});
