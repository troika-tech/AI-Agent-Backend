const Joi = require("joi");
const logger = require("../utils/logger");

// Common helpers
const objectId = () => Joi.string().hex().length(24).messages({
  "string.base": "{#label} must be a string",
  "string.hex": "{#label} must be a valid hex string",
  "string.length": "{#label} must be 24 characters (Mongo ObjectId)",
});

const phoneNumber = () =>
  Joi.string()
    .trim()
    .pattern(/^\+?[0-9]{7,15}$/)
    .messages({
      "string.pattern.base": "{#label} must be a valid phone number",
    });

const email = () =>
  Joi.string()
    .trim()
    .email({ tlds: { allow: false } })
    .messages({ "string.email": "{#label} must be a valid email" });

// Formats Joi error details into a compact shape
function formatErrors(error) {
  return (error?.details || []).map((d) => ({
    field: d.path?.join(".") || "",
    message: d.message.replace(/\"/g, "\'"),
    type: d.type,
  }));
}

// Generic validator middleware factory
// Usage: validate({ body: schema, query: schema, params: schema, headers: schema })
function validate(schemas = {}) {
  const segments = ["body", "query", "params", "headers"];
  const options = {
    abortEarly: false,
    allowUnknown: true, // don't fail on extra keys
    stripUnknown: true, // remove unknown keys for cleanliness
    convert: true, // coerce types (e.g., strings to numbers/booleans)
  };

  return (req, res, next) => {
    try {
      for (const seg of segments) {
        const schema = schemas[seg];
        if (!schema) continue;

        const { error, value } = schema.validate(req[seg], options);
        if (error) {
          const details = formatErrors(error);
          logger.warn("Validation failed", { segment: seg, details });
          return res.status(400).json({ status: 400, error: "Validation error", details });
        }
        req[seg] = value; // assign sanitized value
      }
      return next();
    } catch (err) {
      logger.error("Validation middleware crashed", { err });
      return res.status(500).json({ status: 500, error: "Internal validation error" });
    }
  };
}

module.exports = {
  validate,
  // expose common validators for reuse in schemas
  Joi,
  objectId,
  phoneNumber,
  email,
};
