const { isOtpFresh } = require('../utils/otpHelpers');

describe('otpHelpers.isOtpFresh', () => {
  test('returns false when record missing or missing created_at', () => {
    expect(isOtpFresh(null)).toBe(false);
    expect(isOtpFresh({})).toBe(false);
  });

  test('returns true when within default TTL', () => {
    const rec = { created_at: new Date(Date.now() - 5 * 60 * 1000) };
    expect(isOtpFresh(rec)).toBe(true);
  });

  test('returns false when beyond TTL', () => {
    const rec = { created_at: new Date(Date.now() - 15 * 60 * 1000) };
    expect(isOtpFresh(rec)).toBe(false);
  });

  test('respects custom ttlMinutes', () => {
    const rec = { created_at: new Date(Date.now() - 11 * 60 * 1000) };
    expect(isOtpFresh(rec, 12)).toBe(true);
    expect(isOtpFresh(rec, 10)).toBe(false);
  });
});
