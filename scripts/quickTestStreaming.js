/**
 * Quick integration test for streaming endpoint
 * Loads the app directly without starting server
 */

require('dotenv').config();

// Mock necessary services before loading app
process.env.NODE_ENV = 'development';

const app = require('../app');
const http = require('http');

// Create a mock request to test routing
async function testStreamingRoute() {
  console.log('Testing streaming route registration...\n');

  // Get all registered routes
  const routes = [];

  function extractRoutes(stack, prefix = '') {
    stack.forEach(middleware => {
      if (middleware.route) {
        // Route middleware
        const methods = Object.keys(middleware.route.methods).join(', ').toUpperCase();
        routes.push({
          path: prefix + middleware.route.path,
          methods: methods
        });
      } else if (middleware.name === 'router') {
        // Router middleware
        const routerPrefix = middleware.regexp.source
          .replace('\\/?', '')
          .replace('(?=\\/|$)', '')
          .replace(/\\/g, '');

        if (middleware.handle.stack) {
          extractRoutes(middleware.handle.stack, routerPrefix);
        }
      }
    });
  }

  extractRoutes(app._router.stack);

  // Filter for troika routes
  const troikaRoutes = routes.filter(r => r.path.includes('troika'));

  console.log('=== Troika Routes Found ===');
  if (troikaRoutes.length === 0) {
    console.log('❌ No Troika routes found!');
    console.log('\nAll routes registered:');
    routes.forEach(r => console.log(`  ${r.methods} ${r.path}`));
  } else {
    troikaRoutes.forEach(route => {
      console.log(`✅ ${route.methods} ${route.path}`);
      if (route.path.includes('/stream')) {
        console.log('   ⚡ Streaming endpoint found!');
      }
    });
  }

  console.log('\n=== Testing Endpoint Directly ===');

  // Try to make a request to the app directly
  const request = require('supertest');

  try {
    const response = await request(app)
      .post('/api/troika/intelligent-chat/stream')
      .send({ query: 'test' })
      .set('Accept', 'text/event-stream');

    console.log(`Status: ${response.status}`);
    console.log(`Headers:`, response.headers['content-type']);

    if (response.status === 200) {
      console.log('✅ Streaming endpoint is accessible!');
      console.log('Response preview:', response.text?.substring(0, 200));
    } else {
      console.log('❌ Endpoint returned non-200 status');
      console.log('Body:', response.body);
    }
  } catch (error) {
    console.log('❌ Error testing endpoint:', error.message);
  }
}

testStreamingRoute()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
