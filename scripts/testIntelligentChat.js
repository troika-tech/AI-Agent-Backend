const dotenv = require('dotenv');
const connectDB = require('../db');
const { init: initRedis } = require('../lib/redis');
const IntelligentResponseService = require('../services/intelligentResponseService');
const IntentDetectionService = require('../services/intentDetectionService');
const MarketIntelligenceVectorSearch = require('../services/marketIntelligenceVectorSearch');
const logger = require('../utils/logger');

dotenv.config();

// Test queries with different intelligence levels
const TEST_QUERIES = [
  // FAQ queries (Intelligence Level: NONE)
  {
    query: 'What is your phone number?',
    expectedLevel: 'NONE',
    category: 'FAQ'
  },
  {
    query: 'How can I contact Troika Tech?',
    expectedLevel: 'NONE',
    category: 'FAQ'
  },

  // Service inquiry (Intelligence Level: SUBTLE)
  {
    query: 'How can you help my business?',
    expectedLevel: 'SUBTLE',
    category: 'Service Inquiry'
  },
  {
    query: 'What services does Troika Tech offer?',
    expectedLevel: 'SUBTLE',
    category: 'Service Inquiry'
  },

  // Competitive queries (Intelligence Level: EXPLICIT)
  {
    query: 'How is Troika Tech better than Yellow.ai?',
    expectedLevel: 'EXPLICIT',
    category: 'Competitive'
  },
  {
    query: 'Compare your chatbot with Wix chatbot',
    expectedLevel: 'EXPLICIT',
    category: 'Competitive'
  },

  // Industry-specific (Intelligence Level: DATA_POINTS)
  {
    query: 'What solutions do you have for real estate businesses?',
    expectedLevel: 'DATA_POINTS',
    category: 'Industry-Specific'
  },
  {
    query: 'How can AI help in education sector?',
    expectedLevel: 'DATA_POINTS',
    category: 'Industry-Specific'
  },

  // Technology (Intelligence Level: RECENT_UPDATES)
  {
    query: 'What are the latest AI trends in chatbots?',
    expectedLevel: 'RECENT_UPDATES',
    category: 'Technology'
  },
  {
    query: 'Tell me about recent developments in AI for businesses',
    expectedLevel: 'RECENT_UPDATES',
    category: 'Technology'
  }
];

// Follow-up test
const FOLLOW_UP_TEST = [
  {
    query: 'What is Supa Agent?',
    followUps: [
      'Tell me more about its features',
      'What is the pricing?',
      'Can you give me a demo?'
    ]
  }
];

async function testIntelligentChat() {
  try {
    console.log('🧪 Testing Intelligent Chat System\n');
    console.log('='.repeat(80));

    // Connect to database
    await connectDB();
    logger.info('Connected to database');

    // Initialize Redis
    await initRedis();
    logger.info('Redis initialized');

    // Initialize services
    const intelligentResponseService = new IntelligentResponseService();
    const intentDetectionService = new IntentDetectionService();
    const vectorSearchService = new MarketIntelligenceVectorSearch();

    // Check vector search index status
    console.log('\n📊 Checking Vector Search Index Status...\n');
    const indexStatus = await vectorSearchService.checkIndexStatus();
    console.log('Index Status:', indexStatus);

    if (!indexStatus.ready) {
      console.log('\n⚠️  Warning: Vector search index is not ready.');
      console.log('   Run: npm run db:intelligence:vector');
      console.log('   This test will continue but semantic search may not work.\n');
    }

    // Test 1: Intent Detection
    console.log('\n' + '='.repeat(80));
    console.log('TEST 1: Intent Detection');
    console.log('='.repeat(80) + '\n');

    for (const testCase of TEST_QUERIES) {
      console.log(`Query: "${testCase.query}"`);

      const analysis = await intentDetectionService.analyzeQuery(testCase.query);

      console.log(`  Expected Level: ${testCase.expectedLevel}`);
      console.log(`  Detected Level: ${analysis.intelligenceLevel}`);
      console.log(`  Category: ${analysis.primary.category}`);
      console.log(`  Keywords: ${analysis.keywords.join(', ') || 'none'}`);

      const match = analysis.intelligenceLevel === testCase.expectedLevel;
      console.log(`  Result: ${match ? '✅ PASS' : '❌ FAIL'}\n`);
    }

    // Test 2: Intelligent Response Generation (sample)
    console.log('\n' + '='.repeat(80));
    console.log('TEST 2: Intelligent Response Generation (Sample)');
    console.log('='.repeat(80) + '\n');

    const sampleQueries = [
      TEST_QUERIES[2], // Service inquiry
      TEST_QUERIES[4], // Competitive
      TEST_QUERIES[6]  // Industry-specific
    ];

    for (const testCase of sampleQueries) {
      console.log(`\n📝 Query: "${testCase.query}"`);
      console.log(`   Category: ${testCase.category}\n`);

      try {
        const response = await intelligentResponseService.generateResponse({
          query: testCase.query,
          context: {}
        });

        console.log(`   Intelligence Level: ${response.intelligenceLevel}`);
        console.log(`   Intelligence Items Used: ${response.intelligenceUsed}`);
        console.log(`   Session ID: ${response.sessionId}`);

        if (response.citations.length > 0) {
          console.log(`   Citations: ${response.citations.length} sources`);
          response.citations.slice(0, 2).forEach(citation => {
            console.log(`     - ${citation.source}: ${citation.title}`);
          });
        }

        console.log(`\n   Answer Preview (first 200 chars):`);
        console.log(`   ${response.answer.substring(0, 200)}...`);
        console.log(`\n   ✅ Response generated successfully`);

      } catch (error) {
        console.log(`\n   ❌ Error: ${error.message}`);
      }
    }

    // Test 3: Follow-up Conversation
    console.log('\n' + '='.repeat(80));
    console.log('TEST 3: Follow-up Conversation');
    console.log('='.repeat(80) + '\n');

    const conversationTest = FOLLOW_UP_TEST[0];
    console.log(`Initial Query: "${conversationTest.query}"\n`);

    try {
      // First query
      const initialResponse = await intelligentResponseService.generateResponse({
        query: conversationTest.query,
        context: {}
      });

      console.log(`Session ID: ${initialResponse.sessionId}`);
      console.log(`Initial Answer (first 150 chars): ${initialResponse.answer.substring(0, 150)}...\n`);

      // Follow-up queries
      for (let i = 0; i < conversationTest.followUps.length; i++) {
        const followUpQuery = conversationTest.followUps[i];
        console.log(`Follow-up ${i + 1}: "${followUpQuery}"`);

        const followUpResponse = await intelligentResponseService.generateResponse({
          query: followUpQuery,
          sessionId: initialResponse.sessionId,
          context: {}
        });

        console.log(`  Is Follow-up Detected: ${followUpResponse.metadata.isFollowUp}`);
        console.log(`  Has Context: ${followUpResponse.metadata.hasContext}`);
        console.log(`  Answer (first 150 chars): ${followUpResponse.answer.substring(0, 150)}...`);
        console.log(`  ✅ Follow-up handled\n`);

        // Small delay between follow-ups
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.log(`❌ Error in conversation test: ${error.message}`);
    }

    // Test 4: Vector Search (if index is ready)
    if (indexStatus.ready) {
      console.log('\n' + '='.repeat(80));
      console.log('TEST 4: Semantic Vector Search');
      console.log('='.repeat(80) + '\n');

      const searchQuery = 'AI chatbot trends';
      console.log(`Search Query: "${searchQuery}"\n`);

      try {
        const searchResults = await vectorSearchService.hybridSearch(searchQuery, {}, 5);

        console.log(`Results Found: ${searchResults.total}`);
        console.log(`  Vector Results: ${searchResults.vectorCount}`);
        console.log(`  Keyword Results: ${searchResults.keywordCount}\n`);

        if (searchResults.results.length > 0) {
          console.log('Top 3 Results:');
          searchResults.results.slice(0, 3).forEach((result, index) => {
            console.log(`  ${index + 1}. ${result.title}`);
            console.log(`     Source: ${result.source}`);
            console.log(`     Type: ${result.type}`);
            console.log(`     Score: ${result.searchScore?.toFixed(4) || 'N/A'}`);
            console.log('');
          });
          console.log('✅ Vector search working');
        } else {
          console.log('⚠️  No results found (index may be empty)');
        }

      } catch (error) {
        console.log(`❌ Error in vector search: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ All tests completed!');
    console.log('='.repeat(80) + '\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testIntelligentChat();
