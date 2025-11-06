const dotenv = require('dotenv');
dotenv.config();

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Test queries specifically designed to trigger objection handling
const testQueries = [
  {
    name: 'Price Too Low Objection',
    query: '₹25K sounds too cheap, is quality compromised?',
    phone: '9999999999',
    expectObjection: 'price_too_low',
    expectHandlers: true
  },
  {
    name: 'AI Quality Concern',
    query: 'Can AI really build quality websites? Sounds generic',
    phone: '9999999999',
    expectObjection: 'ai_quality_concern',
    expectHandlers: true
  },
  {
    name: 'Support Concern',
    query: 'What if I need changes later?',
    phone: '9999999999',
    expectObjection: 'support_concern',
    expectHandlers: true
  },
  {
    name: 'Speed Concern',
    query: 'How can you deliver in 4 hours? Sounds rushed',
    phone: '9999999999',
    expectObjection: 'time_concern',
    expectHandlers: true
  },
  {
    name: 'Trust Concern',
    query: 'How do I know this is legit and not a scam?',
    phone: '9999999999',
    expectObjection: 'trust_concern',
    expectHandlers: true
  },
  {
    name: 'No Objection (Control)',
    query: 'Tell me about your AI Website service',
    phone: '9999999999',
    expectObjection: null,
    expectHandlers: false
  }
];

async function testPhase2ObjectionHandling() {
  console.log('🧪 Testing Phase 2: Objection Handling System\n');
  console.log('📊 Testing objection detection and proof-based responses\n');
  console.log('='.repeat(80));

  let sessionId = null;
  const metrics = {
    objectionsDetected: 0,
    handlersRetrieved: 0,
    proofBasedResponses: 0,
    totalTime: 0
  };

  for (let i = 0; i < testQueries.length; i++) {
    const test = testQueries[i];

    console.log(`\n\n📝 Test ${i + 1}/${testQueries.length}: ${test.name}`);
    console.log('─'.repeat(80));
    console.log(`Query: "${test.query}"`);
    console.log(`Expected Objection: ${test.expectObjection || 'none'}`);

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

      if (response.data) {
        sessionId = response.data.sessionId;

        console.log(`\n✅ Response time: ${duration}s`);
        console.log(`💡 Suggestions: ${response.data.suggestions?.length || 0}`);

        // Check for proof keywords in response
        const answer = response.data.answer.toLowerCase();
        const proofKeywords = [
          '4.8/5', 'rating', '6000+', 'clients', '13 years', 'founded 2012',
          'case study', 'example', 'real estate', 'education', 'pharma',
          'inquiries doubled', '3x more', '4x engagement', '60% signups',
          'proof', 'track record', 'proven'
        ];

        const proofCount = proofKeywords.filter(keyword => answer.includes(keyword)).length;
        const hasProof = proofCount >= 2;

        if (hasProof) {
          console.log(`✅ Proof-based response detected (${proofCount} proof points)`);
          metrics.proofBasedResponses++;
        } else {
          console.log(`⚠️  No clear proof points in response`);
        }

        console.log(`\n📝 Answer (first 300 chars):`);
        console.log(response.data.answer.substring(0, 300) + '...');

        if (response.data.suggestions && response.data.suggestions.length > 0) {
          console.log(`\n💭 Suggestions:`);
          response.data.suggestions.forEach((s, idx) => {
            console.log(`   ${idx + 1}. ${s}`);
          });
        }

        console.log(`\n⚠️  Check server logs for:`);
        console.log(`   🚨 Objection detection: Expected "${test.expectObjection || 'none'}"`);
        console.log(`   📋 Objection handlers: Expected ${test.expectHandlers ? 'YES' : 'NO'}`);

      } else {
        console.log('❌ Failed: No response data');
      }

    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }

    // Wait between requests
    if (i < testQueries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const avgResponseTime = (metrics.totalTime / testQueries.length).toFixed(1);

  console.log('\n\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total queries: ${testQueries.length}`);
  console.log(`Average response time: ${avgResponseTime}s`);
  console.log(`Proof-based responses: ${metrics.proofBasedResponses}/${testQueries.length - 1} (excluding control)`);
  console.log('\n⚠️  MANUAL METRICS (check server logs):');
  console.log('   1. Objection detection accuracy (5 out of 6 queries should detect)');
  console.log('   2. Objection handlers retrieved (should fetch 3-5 handlers per objection)');
  console.log('   3. Proof points injected into responses');
  console.log('\n✅ SUCCESS CRITERIA:');
  console.log('   - 5/5 objection queries detected correctly');
  console.log('   - Handlers retrieved for all objection queries');
  console.log('   - 80%+ proof-based responses (4/5 objection queries)');
  console.log('   - Control query has NO objection detected');
  console.log('='.repeat(80));
}

// Check if server is running first
axios.get(`${BASE_URL}/health`)
  .then(() => {
    console.log('✅ Server is running\n');
    return testPhase2ObjectionHandling();
  })
  .catch(err => {
    console.error('❌ Server is not running. Please start the server first:');
    console.error('   npm run dev\n');
    process.exit(1);
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
