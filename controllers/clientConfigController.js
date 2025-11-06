// controllers/clientConfigController.js
const ClientConfig = require("../models/ClientConfig");
const { key, del } = require("../utils/cache");
const logger = require("../utils/logger");

/**
 * GET /:id/config
 * Return a minimal, frontend-friendly config payload for a chatbot.
 */
exports.getClientConfig = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "chatbot id required" });

    const config = await ClientConfig.findOne({ chatbot_id: id }).lean();
    if (!config) {
      return res.status(404).json({ message: "Config not found for this chatbot" });
    }

    // Return only the fields the frontend needs. Use defaults for safety.
    return res.status(200).json({
      auth_method: config.auth_method || "email",
      free_messages: typeof config.free_messages === "number" ? config.free_messages : 1,
      require_auth_text: config.require_auth_text || "Sign in to continue.",
      link_intents: Array.isArray(config.link_intents) ? config.link_intents : [],
      ui_suggestions: Array.isArray(config.ui_suggestions) ? config.ui_suggestions : [],
      chatbot_logo: config.chatbot_logo || "https://raw.githubusercontent.com/troika-tech/Asset/refs/heads/main/Supa%20Agent%20new.png",
    });
  } catch (err) {
    logger.error(`Get config error: ${err.message}`);
    return res.status(500).json({ message: "Error fetching client config" });
  }
};

/**
 * PUT /:id/config
 * Update (or create) client config. We sanitize link_intents and coerce free_messages.
 */
exports.updateClientConfig = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "chatbot id required" });

    const updateData = { ...req.body };

    // Sanitize link_intents: only keep valid entries
    if (Array.isArray(updateData.link_intents)) {
      updateData.link_intents = updateData.link_intents
        .map((intent) => {
          if (
            !intent ||
            typeof intent.intent !== "string" ||
            !Array.isArray(intent.keywords) ||
            typeof intent.link !== "string"
          ) {
            return null;
          }
          return {
            intent: intent.intent.trim(),
            keywords: intent.keywords.map((k) => String(k || "").trim()).filter(Boolean),
            link: intent.link.trim(),
          };
        })
        .filter(Boolean);
    }

    // Validate/coerce free_messages: number + clamp to [0, 10] (adjust max as you like)
    if (updateData.free_messages !== undefined) {
      const n = Number(updateData.free_messages);
      if (Number.isNaN(n) || !Number.isFinite(n)) {
        updateData.free_messages = 1;
      } else {
        // enforce integer and sensible bounds
        const min = 0;
        const max = 10;
        updateData.free_messages = Math.max(min, Math.min(max, Math.floor(n)));
      }
    }

    // Trim simple string fields if present
    if (typeof updateData.require_auth_text === "string") {
      updateData.require_auth_text = updateData.require_auth_text.trim();
    }
    if (typeof updateData.auth_method === "string") {
      const allowed = ["email", "whatsapp"];
      updateData.auth_method = allowed.includes(updateData.auth_method) ? updateData.auth_method : "email";
    }
    if (typeof updateData.chatbot_logo === "string") {
      updateData.chatbot_logo = updateData.chatbot_logo.trim();
    }

    const config = await ClientConfig.findOneAndUpdate(
      { chatbot_id: id },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    // Invalidate cached client config for this chatbot
    try {
      const cacheKey = key("cfg", String(id));
      const removed = await del(cacheKey);
      if (process.env.LOG_CACHE === "true") {
        logger.info(`[cache] DEL ${cacheKey} removed=${removed}`);
      }
    } catch (invErr) {
      if (process.env.LOG_CACHE === "true") {
        logger.warn(`[cache] DEL failed for cfg:${id} - ${invErr.message}`);
      }
    }

    return res.status(200).json({ message: "Client config saved", config });
  } catch (err) {
    logger.error(`Update config error: ${err.message}`);
    return res.status(500).json({ message: "Error updating client config" });
  }
};
