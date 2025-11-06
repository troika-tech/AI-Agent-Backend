/*
 * ==========================================
 * WhatsApp Chatbot Webhook Routes
 * ==========================================
 * COMMENTED OUT: No longer offering WhatsApp chatbot service
 * This entire file is commented out and can be removed later
 * ==========================================
 */

/*
const express = require("express");
const router = express.Router();
const {
  verifyWebhook,
  receiveMessage,
} = require("../controllers/whatsappWebhookController");

// GET /webhook - Webhook verification
router.get("/", verifyWebhook);

// POST /webhook - Receive WhatsApp messages
router.post("/", receiveMessage);

module.exports = router;
*/

// Export disabled router to prevent errors
const express = require("express");
const router = express.Router();

router.get("/", (req, res) => res.status(503).json({ error: "WhatsApp chatbot service is disabled" }));
router.post("/", (req, res) => res.status(503).json({ error: "WhatsApp chatbot service is disabled" }));

module.exports = router;
