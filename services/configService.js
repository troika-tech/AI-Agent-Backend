// services/configService.js
const ClientConfig = require("../models/ClientConfig");
const { wrap } = require("../utils/cache");

const ALLOWED_AUTH = new Set(["email", "whatsapp", "both"]);

function normalizeAuthMethod(value) {
  const v = (value || "").toString().toLowerCase().trim();
  return ALLOWED_AUTH.has(v) ? v : "email"; // default for clients
}

function normalizeFreeMessages(n) {
  const x = Number.isFinite(n) ? n : parseInt(n, 10);
  if (Number.isNaN(x)) return 1;
  // keep sane bounds without throwing
  return Math.max(0, Math.min(5, x));
}

async function getClientConfig(chatbotId) {
  const keyParts = ["cfg", String(chatbotId)];
  return wrap({
    keyParts,
    ttlSec: 300,
    fn: async () => {
      try {
        const cfg = await ClientConfig.findOne({ chatbot_id: chatbotId }).lean();

        if (!cfg) {
          console.warn(`No client config found for chatbotId: ${chatbotId}`);
          // Safe defaults when there is no document
          return {
            auth_method: "email",
            free_messages: 1,
            require_auth_text: "Sign in to continue.",
            link_intents: [],
            ui_suggestions: [],
          };
        }

        return {
          auth_method: normalizeAuthMethod(cfg.auth_method),
          free_messages: normalizeFreeMessages(cfg.free_messages),
          require_auth_text:
            (cfg.require_auth_text && String(cfg.require_auth_text).trim()) ||
            "Sign in to continue.",
          link_intents: Array.isArray(cfg.link_intents) ? cfg.link_intents : [],
          ui_suggestions: Array.isArray(cfg.ui_suggestions)
            ? cfg.ui_suggestions
            : [],
        };
      } catch (err) {
        console.error("MongoDB getClientConfig error:", err.message);
        // On error, still return safe defaults
        return {
          auth_method: "email",
          free_messages: 1,
          require_auth_text: "Sign in to continue.",
          link_intents: [],
          ui_suggestions: [],
        };
      }
    },
  });
}

module.exports = { getClientConfig };
