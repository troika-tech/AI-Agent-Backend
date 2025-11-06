const bcrypt = require('bcrypt');
const adminService = require('../services/adminService');
const Admin = require('../models/Admin');

describe('adminService edge cases', () => {
  describe('createAdmin', () => {
    it('returns conflict when admin with email exists', async () => {
      const password = await bcrypt.hash('x', 10);
      await Admin.create({ name: 'A', email: 'exists@example.com', password_hash: password });
      const res = await adminService.createAdmin({ name: 'A', email: 'exists@example.com', password: '123' });
      expect(res).toEqual({ conflict: true });
    });

    it('propagates DB save failure', async () => {
      // Spy on save to force a rejection on the next instance
      const saveSpy = jest.spyOn(Admin.prototype, 'save').mockImplementationOnce(() => Promise.reject(new Error('DB down')));
      await expect(
        adminService.createAdmin({ name: 'B', email: 'b@example.com', password: 'secret' })
      ).rejects.toThrow('DB down');
      saveSpy.mockRestore();
    });
  });

  describe('editAdmin', () => {
    it('returns updated:false when user not found', async () => {
      const res = await adminService.editAdmin('64b9b4c53e8a2f7c6c6c6c6c', { name: 'New' });
      expect(res).toEqual({ updated: false });
    });
  });

  describe('toggleSuperAdmin', () => {
    it('returns notFound when admin id does not exist', async () => {
      const res = await adminService.toggleSuperAdmin('64b9b4c53e8a2f7c6c6c6c6c');
      expect(res).toEqual({ notFound: true });
    });
  });
});
