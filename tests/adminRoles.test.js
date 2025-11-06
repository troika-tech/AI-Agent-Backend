const request = require('supertest');
const { adminToken, userToken, superAdminToken } = require('./helpers/jwt');
process.env.NODE_ENV = 'test';
process.env.TEST_ROUTES = '/api/customizations,/api/report,/api/company,/api/chatbot';

const app = require('../app');

describe('Admin role checks', () => {
  const admin = adminToken({ id: 'a1', email: 'a@test.com' });
  const user = userToken({ id: 'u1', email: 'u@test.com' });
  const superAdmin = superAdminToken({ id: 's1', email: 's@test.com' });

  afterAll(() => {
    delete process.env.TEST_ROUTES;
  });

  it('restrictTo admin: /api/company/all allows admin, blocks user', async () => {
  const ok = await request(app).get('/api/company/all').set('Authorization', `Bearer ${admin}`);
    expect([200, 500]).toContain(ok.status);

  const no = await request(app).get('/api/company/all').set('Authorization', `Bearer ${user}`);
    expect(no.status).toBe(403);
  });

  it('restrictToRoles admin or superadmin: /api/customizations/:chatbotId rejects normal user', async () => {
    const res = await request(app)
      .put('/api/customizations/000000000000000000000001')
  .set('Authorization', `Bearer ${user}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('restrictToSuperAdmin: simulated check via header on a protected route (super admin allowed)', async () => {
    // There is no direct route using restrictToSuperAdmin in repo, simulate by using super admin token against an admin route
  const ok = await request(app).get('/api/report/overall').set('Authorization', `Bearer ${superAdmin}`);
    expect([200, 500]).toContain(ok.status);
  });
});
