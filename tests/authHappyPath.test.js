const request = require('supertest');
const { adminToken } = require('./helpers/jwt');
process.env.NODE_ENV = 'test';
process.env.TEST_ROUTES = '/api/company';

const app = require('../app');

describe('Auth Middleware Happy Path', () => {
  afterAll(() => {
    delete process.env.TEST_ROUTES;
  });

  it('allows access with valid admin JWT to a protected route', async () => {
  const token = adminToken({ id: 'u1', email: 'admin@test.com' });
    const res = await request(app)
      .get('/api/company/all')
      .set('Authorization', `Bearer ${token}`);
    // Handler may require DB, but we only assert auth layer passes to reach controller (not 401/403)
    expect([200, 500]).toContain(res.status);
  });
});
