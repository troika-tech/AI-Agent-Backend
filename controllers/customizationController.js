const Joi = require("joi");
const ChatbotCustomization = require("../models/ChatbotCustomization");
const { pick } = require("../utils/objectHelpers");

/* =========================
   Validation (Joi)
   ========================= */
const suggestionSchema = Joi.object({
  title: Joi.string().trim().allow(""),
  icon: Joi.string().trim().allow(""),
  iconBg: Joi.string().trim().allow(""),
  bgType: Joi.string().valid("solid", "gradient").default("solid"),
});

const bodySchema = Joi.object({
  fontFamily: Joi.string().trim(),
  headerBackground: Joi.string().trim(),
  headerStyleType: Joi.string().valid("solid", "gradient"),
  headerSubtitle: Joi.string().trim().allow(""),
  buttonColor: Joi.string().trim(),
  buttonStyleType: Joi.string().valid("solid", "gradient"),
  welcomeMessage: Joi.string().trim().allow(""),
  startingSuggestions: Joi.array().items(suggestionSchema).min(0).max(5),
  chatWindowBg: Joi.string().trim(),
  chatWindowBgType: Joi.string().valid("solid", "gradient", "image"),
  includeAudio: Joi.boolean(),
  includeSuggestionButton: Joi.boolean(),
}).min(1);

const allowedFields = [
  "fontFamily",
  "headerBackground",
  "headerStyleType",
  "headerSubtitle",
  "buttonColor",
  "buttonStyleType",
  "welcomeMessage",
  "startingSuggestions",
  "chatWindowBg",
  "chatWindowBgType",
  "includeAudio",
  "includeSuggestionButton",
];

/* =========================
   GET /customizations/:chatbotId
   Returns customization for a chatbot.
   If missing, creates one with schema defaults.
   ========================= */
exports.getCustomization = async (req, res) => {
  try {
    const { chatbotId } = req.params;
    if (!chatbotId) {
      return res.status(400).json({ success: false, message: "chatbotId is required in params." });
    }

    let doc = await ChatbotCustomization.findOne({ chatbotId }).lean();
    if (!doc) {
      const created = await ChatbotCustomization.create({ chatbotId });
      doc = created.toObject();
    }

    return res.status(200).json({ success: true, data: doc });
  } catch (err) {
    console.error("getCustomization error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =========================
   PUT /customizations/:chatbotId
   Upsert customization (create or update).
   Accepts partial payloads; replaces startingSuggestions if provided.
   ========================= */
exports.upsertCustomization = async (req, res) => {
  try {
    const { chatbotId } = req.params;
    if (!chatbotId) {
      return res.status(400).json({ success: false, message: "chatbotId is required in params." });
    }

    const { error, value } = bodySchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        details: error.details.map((d) => d.message),
      });
    }

  const update = pick(value, allowedFields);

    const doc = await ChatbotCustomization.findOneAndUpdate(
      { chatbotId },
      { $set: update, $setOnInsert: { chatbotId } },
      { new: true, upsert: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Customization saved",
      data: doc,
    });
  } catch (err) {
    console.error("upsertCustomization error:", err);
    if (err?.code === 11000) {
      return res.status(409).json({ success: false, message: "Duplicate customization for this chatbot." });
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =========================
   POST /customizations/:chatbotId/reset
   Resets to schema defaults.
   Implementation deletes any existing doc and creates a fresh one.
   ========================= */
exports.resetCustomizationToDefaults = async (req, res) => {
  try {
    const { chatbotId } = req.params;
    if (!chatbotId) {
      return res.status(400).json({ success: false, message: "chatbotId is required in params." });
    }

    await ChatbotCustomization.deleteOne({ chatbotId });
    const fresh = await ChatbotCustomization.create({ chatbotId });

    return res.status(200).json({
      success: true,
      message: "Customization reset to defaults",
      data: fresh,
    });
  } catch (err) {
    console.error("resetCustomizationToDefaults error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
