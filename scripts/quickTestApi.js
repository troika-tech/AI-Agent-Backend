const dotenv = require('dotenv');
dotenv.config();

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Set your chatbot ID for testing (optional - uses fallback KB if not provided)
const CHATBOT_ID = process.env.TEST_CHATBOT_ID || null;

async function testAPI() {
  console.log('🧪 Quick API Test for Intelligent Chat\n');
  console.log('Testing endpoint: POST /api/troika/intelligent-chat\n');

  if (CHATBOT_ID) {
    console.log(`Using chatbot ID: ${CHATBOT_ID}`);
  } else {
    console.log('No chatbot ID - using fallback KB');
  }
  console.log('');

  const testQueries = [
    {
      name: 'FAQ Query (NONE)',
      query: 'What is your phone number?',
      phone: '9999999999'
    },
    {
      name: 'Service Inquiry (SUBTLE)',
      query: 'How can you help my business?',
      phone: '9999999999'
    },
    {
      name: 'Competitive Query (EXPLICIT)',
      query: 'How is Troika Tech better than Yellow.ai?',
      phone: '9999999999'
    }
  ];

  let sessionId = null; // Track session across requests

  for (const test of testQueries) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Test: ${test.name}`);
    console.log(`Query: "${test.query}"`);
    console.log('='.repeat(80));

    try {
      // Minimal payload - exactly like frontend
      const requestData = {
        query: test.query,
        phone: test.phone
      };

      // Add optional fields if available
      if (CHATBOT_ID) requestData.chatbotId = CHATBOT_ID;
      if (sessionId) requestData.sessionId = sessionId;

      const response = await axios.post(`${BASE_URL}/api/troika/intelligent-chat`, requestData, {
        timeout: 30000
      });

      if (response.data.success) {
        // Save session ID for next request
        sessionId = response.data.data.sessionId;

        console.log('\n✅ Success!');
        console.log(`Intelligence Level: ${response.data.data.intelligenceLevel}`);
        console.log(`Intent Category: ${response.data.data.intent.category}`);
        console.log(`Intelligence Items Used: ${response.data.data.intelligenceUsed}`);
        console.log(`Session ID: ${sessionId}`);

        if (response.data.data.citations.length > 0) {
          console.log(`\nCitations (${response.data.data.citations.length}):`);
          response.data.data.citations.forEach((c, i) => {
            console.log(`  ${i + 1}. ${c.source}: ${c.title}`);
          });
        }

        console.log(`\nAnswer (first 200 chars):`);
        console.log(response.data.data.answer.substring(0, 200) + '...');
      } else {
        console.log('❌ Failed:', response.data.message);
      }

    } catch (error) {
      console.log('❌ Error:', error.response?.data?.message || error.message);
    }

    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ API test completed!');
  console.log('='.repeat(80));
}

// Check if server is running first
axios.get(`${BASE_URL}/health`)
  .then(() => {
    console.log('✅ Server is running\n');
    return testAPI();
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
