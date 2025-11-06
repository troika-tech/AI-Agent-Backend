const dotenv = require('dotenv');
dotenv.config();

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Test queries specifically designed to trigger real-time stats
const testQueries = [
  {
    name: 'Social Proof Query (How many clients)',
    query: 'How many clients do you have?',
    phone: '9999999999',
    expectStats: true,
    expectStatsType: 'client_count'
  },
  {
    name: 'Trust Query (Legit company)',
    query: 'How do I know you are a legit company?',
    phone: '9999999999',
    expectStats: true,
    expectStatsType: 'credibility'
  },
  {
    name: 'Experience Query (Track record)',
    query: 'Do you have a proven track record?',
    phone: '9999999999',
    expectStats: true,
    expectStatsType: 'experience'
  },
  {
    name: 'Reliability Query (Established)',
    query: 'Are you an established and reliable company?',
    phone: '9999999999',
    expectStats: true,
    expectStatsType: 'reliability'
  },
  {
    name: 'Generic Service Query (Control - No Stats)',
    query: 'What features does your AI Website service have?',
    phone: '9999999999',
    expectStats: false,
    expectStatsType: null
  }
];

async function testPhase3RealTimeStats() {
  console.log('🧪 Testing Phase 3: Real-Time Stats Integration\n');
  console.log('📊 Testing automatic stats injection for trust/credibility queries\n');
  console.log('='.repeat(80));

  let sessionId = null;
  const metrics = {
    statsIncluded: 0,
    statsDetected: 0,
    clientCountMentioned: 0,
    yearsMentioned: 0,
    ratingMentioned: 0,
    totalTime: 0
  };

  for (let i = 0; i < testQueries.length; i++) {
    const test = testQueries[i];

    console.log(`\n\n📝 Test ${i + 1}/${testQueries.length}: ${test.name}`);
    console.log('─'.repeat(80));
    console.log(`Query: "${test.query}"`);
    console.log(`Expected Stats: ${test.expectStats ? 'YES' : 'NO'}`);

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

        // Check for stats keywords in response
        const answer = response.data.answer.toLowerCase();
        const statsKeywords = {
          clientCount: ['6000', 'clients', 'businesses', 'customers'],
          years: ['13 years', 'years in business', 'founded 2012'],
          rating: ['4.8/5', '4.8', 'rating', 'star'],
          cities: ['47 cities', 'cities'],
          countries: ['9 countries', 'countries']
        };

        const foundStats = {
          clientCount: statsKeywords.clientCount.some(k => answer.includes(k)),
          years: statsKeywords.years.some(k => answer.includes(k)),
          rating: statsKeywords.rating.some(k => answer.includes(k)),
          cities: statsKeywords.cities.some(k => answer.includes(k)),
          countries: statsKeywords.countries.some(k => answer.includes(k))
        };

        const statsCount = Object.values(foundStats).filter(Boolean).length;
        const hasStats = statsCount >= 2;

        if (hasStats) {
          console.log(`✅ Stats detected in response (${statsCount} types)`);
          console.log(`   Stats found: ${Object.entries(foundStats).filter(([k, v]) => v).map(([k]) => k).join(', ')}`);
          metrics.statsIncluded++;

          if (foundStats.clientCount) metrics.clientCountMentioned++;
          if (foundStats.years) metrics.yearsMentioned++;
          if (foundStats.rating) metrics.ratingMentioned++;
        } else {
          console.log(`⚠️  No stats in response (found ${statsCount} types)`);
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
        console.log(`   📊 Real-time stats: Expected ${test.expectStats ? 'YES' : 'NO'}`);
        console.log(`   👥 Active clients count`);
        console.log(`   📅 Years in business`);

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
  console.log(`\n📊 Stats Inclusion:`);
  console.log(`   Stats-included responses: ${metrics.statsIncluded}/${testQueries.filter(t => t.expectStats).length} (expected: 4/4)`);
  console.log(`   Client count mentions: ${metrics.clientCountMentioned}`);
  console.log(`   Years in business mentions: ${metrics.yearsMentioned}`);
  console.log(`   Rating mentions: ${metrics.ratingMentioned}`);
  console.log('\n⚠️  MANUAL METRICS (check server logs):');
  console.log('   1. Real-time stats detection (4 queries should trigger stats)');
  console.log('   2. Stats cached after first fetch (should use cache)');
  console.log('   3. Current offers detection (if seasonal)');
  console.log('\n✅ SUCCESS CRITERIA:');
  console.log('   - 4/4 queries trigger stats inclusion');
  console.log('   - Stats appear in responses (6000+ clients, 13 years, 4.8/5)');
  console.log('   - Control query has NO stats');
  console.log('   - Cache working (second query uses cached stats)');
  console.log('='.repeat(80));
}

// Check if server is running first
axios.get(`${BASE_URL}/health`)
  .then(() => {
    console.log('✅ Server is running\n');
    return testPhase3RealTimeStats();
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
