const request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.TEST_ROUTES = '/api/user';
const app = require('../app');

describe('User Routes Auth Guard', () => {
  afterAll(() => {
    delete process.env.TEST_ROUTES;
  });

  it('GET /api/user/company -> 401 without token', async () => {
    const res = await request(app).get('/api/user/company');
    expect([401, 403]).toContain(res.status);
  });
});
