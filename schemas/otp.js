const { Joi, objectId, email } = require("../middleware/validation");

// POST /api/otp/request-otp
const requestOtpBody = Joi.object({
  email: email().required(),
});

// POST /api/otp/verify-otp
const verifyOtpBody = Joi.object({
  email: email().required(),
  otp: Joi.string().trim().length(6).pattern(/^[0-9]{6}$/).required(),
  chatbotId: objectId().required().label("chatbotId"),
  sessionId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).optional(),
});

// GET /api/otp/check-session?email=&chatbotId=
const checkSessionQuery = Joi.object({
  email: email().required(),
  chatbotId: objectId().required(),
});

module.exports = {
  requestOtp: { body: requestOtpBody },
  verifyOtp: { body: verifyOtpBody },
  checkSession: { query: checkSessionQuery },
};
