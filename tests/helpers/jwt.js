const jwt = require('jsonwebtoken');

function signToken(payload = {}, opts = {}) {
  const secret = process.env.JWT_SECRET || 'testsecret';
  const defaultClaims = { id: 'u1', email: 'user@test.com', role: 'user' };
  const claims = { ...defaultClaims, ...payload };
  const options = { expiresIn: opts.expiresIn || '1h' };
  return jwt.sign(claims, secret, options);
}

function userToken(overrides = {}) {
  return signToken({ role: 'user', ...overrides });
}

function adminToken(overrides = {}) {
  return signToken({ role: 'admin', ...overrides });
}

function superAdminToken(overrides = {}) {
  return signToken({ role: 'admin', isSuperAdmin: true, ...overrides });
}

module.exports = {
  signToken,
  userToken,
  adminToken,
  superAdminToken,
};
