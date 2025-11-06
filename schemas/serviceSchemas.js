// schemas/serviceSchemas.js
// Centralized Joi schemas for service-layer validation
const { Joi, objectId, email } = require("../middleware/validation");

const processAnswerQuerySchema = Joi.object({
  query: Joi.string().trim().min(1).required(),
  chatbotId: objectId().required().label("chatbotId"),
  sessionId: Joi.string().trim().optional(),
  email: email().optional().allow(null, ""),
  phone: Joi.string().optional().allow(null, ""),
  name: Joi.string().trim().optional().allow(null, ""),
});

const getMessagesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).default(20),
  email: email().optional(),
  phone: Joi.string().trim().optional(),
  is_guest: Joi.alternatives(Joi.boolean(), Joi.string().valid("true", "false")).optional(),
  session_id: Joi.string().trim().optional(),
  dateRange: Joi.string().valid("all", "7days", "30days", "90days", "custom").optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
});

module.exports = {
  processAnswerQuerySchema,
  getMessagesSchema,
};
