const bcrypt = require('bcrypt');
const adminService = require('../services/adminService');
const Admin = require('../models/Admin');
const Company = require('../models/Company');

describe('adminService.login', () => {
  test('admin login returns token and role=admin', async () => {
    const password = await bcrypt.hash('secret', 10);
    const admin = await Admin.create({ name: 'Root', email: 'root@example.com', password_hash: password, isSuperAdmin: true });
    const res = await adminService.login({ email: 'root@example.com', password: 'secret' });
    expect(res.role).toBe('admin');
    expect(res).toHaveProperty('token');
    expect(res.user.email).toBe('root@example.com');
  });

  test('company login returns token and role=user', async () => {
    const password = await bcrypt.hash('secret', 10);
    const comp = await Company.create({ name: 'Acme', email: 'acme@example.com', password_hash: password, url: 'https://acme.test' });
    const res = await adminService.login({ email: 'acme@example.com', password: 'secret' });
    expect(res.role).toBe('user');
    expect(res).toHaveProperty('token');
    expect(res.user.email).toBe('acme@example.com');
  });
});
