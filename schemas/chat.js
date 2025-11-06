const { Joi, objectId, email, phoneNumber } = require("../middleware/validation");

// POST /api/chat/query
const chatBody = Joi.object({
  query: Joi.string().trim().min(1).max(5000).required(),
  chatbotId: objectId().required().label("chatbotId"),
  sessionId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).optional(),
  email: email().optional().allow(null, ""),
  phone: phoneNumber().optional().allow(null, ""),
  name: Joi.string().trim().optional().allow(null, ""),
  enableTTS: Joi.boolean().optional(),
  language: Joi.string().optional().allow(null, ""),
  context: Joi.object().optional(),
});

module.exports = {
  chat: { body: chatBody },
};
