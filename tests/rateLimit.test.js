const request = require('supertest');
process.env.NODE_ENV = 'test';
// Mount base /api to activate limiter
process.env.TEST_ROUTES = '/api';

const app = require('../app');

describe('Rate limiting with whitelist', () => {
  afterAll(() => {
    delete process.env.TEST_ROUTES;
  });

  it('blocks after threshold with 429 on non-whitelisted IP', async () => {
    // Send a burst of requests; the limiter is set to 100/min for /api
    // Make sequential requests to trigger rate limiting more reliably
    const responses = [];
    
    // Send 110 requests sequentially to ensure we exceed the limit
    for (let i = 0; i < 110; i++) {
      const response = await request(app).get('/api/healthcheck-' + i);
      responses.push(response);
      // Stop early if we already got a 429 to speed up the test
      if (response.status === 429) break;
    }
    
    const has429 = responses.some(r => r.status === 429);
    expect(has429).toBe(true);
  });

  it('skips rate limiting for whitelisted IP', async () => {
    // Use an IP that is in RATE_LIMIT_IP_WHITELIST (default includes 103.232.246.21)
    const whitelistedIp = (process.env.RATE_LIMIT_IP_WHITELIST || '103.232.246.21').split(',')[0].trim();
    const requests = Array.from({ length: 120 }, (_, i) => request(app)
      .get('/api/healthcheck-wl-' + i)
      .set('X-Forwarded-For', whitelistedIp));
    const responses = await Promise.all(requests);
    const has429 = responses.some(r => r.status === 429);
    expect(has429).toBe(false);
  });
});
