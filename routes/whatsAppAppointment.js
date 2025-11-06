const express = require('express');
const router = express.Router();
const VerifiedUser = require('../models/VerifiedUser');
const mongoose = require('mongoose');
const sendWhatsAppAppointment = require('../utils/sendWhatsAppAppointment');
const { validateBody } = require('../utils/validationHelpers');

// POST /api/whatsapp-appointment/send
// Mirrors the style of /api/whatsapp-otp/send but stateless and without OTP store.
// Body: { phone, chatbotId, params?: string[] }
router.post('/send', async (req, res) => {
  if (!validateBody(req, res)) return;

  const { phone, chatbotId, params } = req.body || {};

  if (!phone || !chatbotId) {
    return res.status(400).json({ success: false, error: 'Phone and Chatbot ID are required' });
  }

  if (!mongoose.Types.ObjectId.isValid(String(chatbotId))) {
    return res.status(400).json({ success: false, error: 'Invalid chatbotId' });
  }

  // Ensure user is verified for this chatbot, similar to OTP verify flow's VerifiedUser logging.
  const exists = await VerifiedUser.exists({
    phone,
    chatbot_id: new mongoose.Types.ObjectId(String(chatbotId)),
  });

  if (!exists) {
    return res.status(403).json({ success: false, error: 'User not verified for this chatbot' });
  }

  const sent = await sendWhatsAppAppointment(phone, Array.isArray(params) ? params : []);
  if (sent) {
    return res.json({ success: true, message: 'Appointment template sent via WhatsApp' });
  }
  return res.status(502).json({ success: false, message: 'Failed to send appointment template' });
});

module.exports = router;
