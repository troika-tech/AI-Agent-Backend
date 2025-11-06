const axios = require('axios');

const API_URL = 'http://localhost:3000/api/intelligent-chat';

const testQueries = [
  "How can you help my real estate business?",
  "What are your prices?",
  "₹25K sounds too cheap",
  "I run a coaching institute, can you help?"
];

async function testOptimizations() {
  console.log('🧪 Testing Phase 1 Optimizations\n');
  console.log('========================================\n');

  const results = {
    total: testQueries.length,
    aiSuggestions: 0,
    predictedSuggestions: 0,
    industryDetected: 0,
    objectionsDetected: 0,
    avgResponseTime: 0
  };

  let totalTime = 0;

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n📝 Test ${i + 1}/${testQueries.length}: "${query}"`);
    console.log('─'.repeat(60));

    const startTime = Date.now();

    try {
      const response = await axios.post(API_URL, { query });
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(1);
      totalTime += parseFloat(duration);

      console.log(`✅ Response time: ${duration}s`);
      console.log(`📊 Suggestions: ${response.data.suggestions?.length || 0}`);

      // Check logs for metrics (you'll need to check console output manually)
      console.log(`\n💡 Check console logs for:`);
      console.log(`   - Industry detection (🏢)`);
      console.log(`   - Objection detection (🚨)`);
      console.log(`   - Suggestion source (AI vs predicted)`);

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }

  results.avgResponseTime = (totalTime / testQueries.length).toFixed(1);

  console.log('\n\n========================================');
  console.log('📊 TEST SUMMARY');
  console.log('========================================');
  console.log(`Total queries: ${results.total}`);
  console.log(`Average response time: ${results.avgResponseTime}s`);
  console.log('\n⚠️  Manual metrics to check from logs:');
  console.log('   - AI-generated suggestions vs predicted fallback');
  console.log('   - Industry detection rate');
  console.log('   - Objection detection accuracy');
  console.log('\n✅ GOAL: AI suggestions should be 80%+ (3-4 out of 4 queries)');
}

testOptimizations();
