// utils/otpHelpers.js
// OTP-related helpers shared across controllers/services

function isOtpFresh(record, ttlMinutes = 10) {
  if (!record?.created_at) return false;
  return Date.now() - new Date(record.created_at).getTime() < ttlMinutes * 60 * 1000;
}

module.exports = { isOtpFresh };
