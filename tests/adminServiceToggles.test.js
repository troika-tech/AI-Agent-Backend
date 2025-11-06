const bcrypt = require('bcrypt');
const adminService = require('../services/adminService');
const Admin = require('../models/Admin');

describe('adminService toggles and listing', () => {
  test('toggleSuperAdmin flips the flag', async () => {
    const password = await bcrypt.hash('pw', 10);
    const admin = await Admin.create({ name: 'Mod', email: 'mod@example.com', password_hash: password, isSuperAdmin: false });
    const first = await adminService.toggleSuperAdmin(admin._id);
    expect(first).toEqual({ isSuperAdmin: true });
    const second = await adminService.toggleSuperAdmin(admin._id);
    expect(second).toEqual({ isSuperAdmin: false });
  });

  test('getAllAdmins returns lean list with testField', async () => {
    const password = await bcrypt.hash('pw', 10);
    await Admin.create({ name: 'A', email: 'a1@example.com', password_hash: password, isSuperAdmin: true });
    await Admin.create({ name: 'B', email: 'b2@example.com', password_hash: password, isSuperAdmin: false });
    const list = await adminService.getAllAdmins();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(2);
    // Each item should include a testField injected by service
    expect(list[0]).toHaveProperty('testField');
  });
});
