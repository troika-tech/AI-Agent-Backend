/**
 * Test script for the /api/user/leads endpoint
 *
 * Usage:
 * 1. Make sure backend server is running (npm start)
 * 2. Get a valid token from localStorage in the browser
 * 3. Run: node test-leads-endpoint.js YOUR_TOKEN_HERE
 */

const http = require('http');

// Get token from command line argument
const token = process.argv[2];

if (!token) {
  console.error('❌ Error: Please provide a token as argument');
  console.log('Usage: node test-leads-endpoint.js YOUR_TOKEN_HERE');
  console.log('\nTo get your token:');
  console.log('1. Open browser DevTools (F12)');
  console.log('2. Go to Console tab');
  console.log('3. Type: localStorage.getItem("token")');
  console.log('4. Copy the token (without quotes)');
  process.exit(1);
}

console.log('🔍 Testing /api/user/leads endpoint...\n');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/user/leads?page=1&limit=10&dateRange=30days',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  console.log(`📡 Status Code: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);
  console.log('');

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const jsonData = JSON.parse(data);
      console.log('✅ Response received successfully!\n');
      console.log('📦 Full Response:');
      console.log(JSON.stringify(jsonData, null, 2));
      console.log('\n');

      // Analyze the response structure
      if (jsonData.success) {
        console.log('✅ Success: true');

        if (jsonData.data) {
          console.log('✅ Data object exists');
          console.log(`   - Leads count: ${jsonData.data.leads?.length || 0}`);
          console.log(`   - Total: ${jsonData.data.total || 0}`);
          console.log(`   - Current Page: ${jsonData.data.currentPage || 'N/A'}`);
          console.log(`   - Total Pages: ${jsonData.data.totalPages || 'N/A'}`);

          if (jsonData.data.leads && jsonData.data.leads.length > 0) {
            console.log('\n📞 Sample Lead:');
            console.log(JSON.stringify(jsonData.data.leads[0], null, 2));
          } else {
            console.log('\n⚠️  No leads found in database');
            console.log('   This is normal if you haven\'t added any phone verification data yet.');
          }
        } else {
          console.log('⚠️  Warning: No data object in response');
        }
      } else {
        console.log('❌ Success: false');
        console.log(`   Message: ${jsonData.message || 'Unknown error'}`);
      }

      console.log('\n✅ Test completed successfully!');
    } catch (e) {
      console.error('❌ Error parsing JSON response:', e.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request failed:', e.message);
  console.log('\n🔧 Troubleshooting:');
  console.log('1. Make sure backend server is running: cd chatbot-backend && npm start');
  console.log('2. Check if port 5000 is available: netstat -ano | findstr :5000');
  console.log('3. Verify the token is valid (not expired)');
});

req.end();
