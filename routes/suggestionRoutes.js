// routes/suggestionsRoutes.js

const express = require("express");
const router = express.Router();
const ClientConfig = require("../models/ClientConfig");
const { validateBody } = require("../utils/validationHelpers");

// ✅ GET: Fetch UI suggestions for a chatbot
router.get("/:chatbotId", async (req, res) => {
  try {
    const config = await ClientConfig.findOne({ chatbot_id: req.params.chatbotId });

    if (!config) return res.json([]);
    return res.json(config.ui_suggestions || []);
  } catch (err) {
    console.error("Failed to fetch suggestions", err);
    res.status(500).json({ error: "Server error while fetching suggestions" });
  }
});

// ✅ POST: Set initial UI suggestions (upsert)
router.post("/:chatbotId", async (req, res) => {
  if (!validateBody(req, res)) return;

  const { suggestions } = req.body;

  if (!Array.isArray(suggestions)) {
    return res.status(400).json({ error: "Suggestions must be an array" });
  }

  try {
    const updated = await ClientConfig.findOneAndUpdate(
      { chatbot_id: req.params.chatbotId },
      { $set: { ui_suggestions: suggestions } },
      { new: true, upsert: true }
    );

    return res.json({
      message: "Suggestions created or updated successfully",
      ui_suggestions: updated.ui_suggestions,
    });
  } catch (err) {
    console.error("POST error", err);
    res.status(500).json({ error: "Failed to save suggestions" });
  }
});

// ✅ PUT: Update UI suggestions only (existing chatbot config)
router.put("/:chatbotId", async (req, res) => {
  if (!validateBody(req, res)) return;

  const { suggestions } = req.body;

  if (!Array.isArray(suggestions)) {
    return res.status(400).json({ error: "Suggestions must be an array" });
  }

  try {
    const existing = await ClientConfig.findOne({ chatbot_id: req.params.chatbotId });

    if (!existing) {
      return res.status(404).json({ error: "ClientConfig not found for this chatbotId" });
    }

    existing.ui_suggestions = suggestions;
    await existing.save();

    return res.json({
      message: "Suggestions updated successfully",
      ui_suggestions: existing.ui_suggestions,
    });
  } catch (err) {
    console.error("PUT error", err);
    res.status(500).json({ error: "Failed to update suggestions" });
  }
});

module.exports = router;
