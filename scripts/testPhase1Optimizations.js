const dotenv = require('dotenv');
dotenv.config();

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Test queries matching the previous test
const testQueries = [
  {
    name: 'Real Estate Query (Industry + Service)',
    query: 'How can you help my real estate business?',
    phone: '9999999999',
    expectIndustry: 'real_estate',
    expectObjection: false
  },
  {
    name: 'Pricing Query (High Intent)',
    query: 'What are your prices?',
    phone: '9999999999',
    expectIndustry: null,
    expectObjection: false
  },
  {
    name: 'Objection Query (Price Skepticism)',
    query: '₹25K sounds too cheap',
    phone: '9999999999',
    expectIndustry: null,
    expectObjection: true
  },
  {
    name: 'Education Query (Industry + Service)',
    query: 'I run a coaching institute, can you help?',
    phone: '9999999999',
    expectIndustry: 'education',
    expectObjection: false
  }
];

async function testPhase1Optimizations() {
  console.log('🧪 Testing Phase 1 Optimizations\n');
  console.log('📊 Tracking metrics:');
  console.log('   1. AI suggestion generation rate (goal: 80%+)');
  console.log('   2. Industry detection accuracy');
  console.log('   3. Objection detection accuracy');
  console.log('   4. Response times\n');
  console.log('='.repeat(80));

  let sessionId = null;
  const metrics = {
    aiSuggestions: 0,
    predictedSuggestions: 0,
    industryDetected: 0,
    objectionsDetected: 0,
    totalTime: 0
  };

  for (let i = 0; i < testQueries.length; i++) {
    const test = testQueries[i];

    console.log(`\n\n📝 Test ${i + 1}/${testQueries.length}: ${test.name}`);
    console.log('─'.repeat(80));
    console.log(`Query: "${test.query}"`);

    const startTime = Date.now();

    try {
      const requestData = {
        query: test.query,
        phone: test.phone
      };

      if (sessionId) requestData.sessionId = sessionId;

      const response = await axios.post(`${BASE_URL}/api/troika/intelligent-chat`, requestData, {
        timeout: 30000
      });

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(1);
      metrics.totalTime += parseFloat(duration);

      // Response format: { answer, audio, sessionId, suggestions }
      if (response.data) {
        sessionId = response.data.sessionId;

        console.log(`\n✅ Response time: ${duration}s`);
        console.log(`🔑 Session ID: ${sessionId}`);
        console.log(`💡 Suggestions: ${response.data.suggestions?.length || 0}`);
        console.log(`🎵 Audio: ${response.data.audio ? 'generated' : 'not generated'}`);

        if (response.data.suggestions && response.data.suggestions.length > 0) {
          console.log('\n💭 Suggestions:');
          response.data.suggestions.forEach((s, idx) => {
            console.log(`   ${idx + 1}. ${s}`);
          });
        }

        console.log(`\n📝 Answer (first 200 chars):`);
        console.log(response.data.answer.substring(0, 200) + '...');

        // Extract metrics from server logs (manual check required)
        console.log('\n⚠️  Check server console logs for:');
        console.log(`   🏢 Industry detection: Expected "${test.expectIndustry || 'none'}"`);
        console.log(`   🚨 Objection detection: Expected ${test.expectObjection ? 'YES' : 'NO'}`);
        console.log(`   📊 Suggestion source: AI-generated vs predicted fallback`);

      } else {
        console.log('❌ Failed: No response data');
      }

    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }

    // Wait between requests
    if (i < testQueries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  const avgResponseTime = (metrics.totalTime / testQueries.length).toFixed(1);

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total queries: ${testQueries.length}`);
  console.log(`Average response time: ${avgResponseTime}s`);
  console.log('\n⚠️  MANUAL METRICS (check server logs):');
  console.log('   1. AI suggestion rate (goal: 80%+ = 3-4 out of 4)');
  console.log('   2. Industry detection (2 queries should detect industry)');
  console.log('   3. Objection detection (1 query should detect objection)');
  console.log('\n✅ If AI suggestions are now 80%+, Phase 1 optimization is COMPLETE!');
  console.log('='.repeat(80));
}

// Check if server is running first
axios.get(`${BASE_URL}/health`)
  .then(() => {
    console.log('✅ Server is running\n');
    return testPhase1Optimizations();
  })
  .catch(err => {
    console.error('❌ Server is not running. Please start the server first:');
    console.error('   npm run dev');
    console.error('\nOr test manually with:');
    console.error('   1. Start server: npm run dev');
    console.error('   2. In another terminal: node scripts/testPhase1Optimizations.js\n');
    process.exit(1);
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
