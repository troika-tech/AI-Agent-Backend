const { Joi } = require("../middleware/validation");

// Query params for pagination/filtering in GET /api/user/messages
const getUserMessagesQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).default(20),
  email: Joi.string().email({ tlds: { allow: false } }).optional(),
  phone: Joi.string().trim().optional(),
  is_guest: Joi.string().valid("true", "false").optional(),
  session_id: Joi.string().trim().optional(),
});

// Params for GET /api/user/messages/:email/pdf
const emailParam = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
});

// Params for GET /api/user/messages/phone/:phone/pdf
const phoneParam = Joi.object({
  phone: Joi.string().trim().required(),
});

module.exports = {
  getUserMessages: { query: getUserMessagesQuery },
  emailParam: { params: emailParam },
  phoneParam: { params: phoneParam },
};
