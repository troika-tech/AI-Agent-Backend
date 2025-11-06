const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const VerifiedUser = require('../models/VerifiedUser');
const sendWhatsAppTemplate = require('../utils/sendWhatsAppTemplate');
const { validateBody } = require('../utils/validationHelpers');

// POST /api/booking/confirm
// Stateless confirmation: verifies user is verified for chatbot, then sends template.
// Body: { phone: string, chatbotId: string (ObjectId), templateName?: string, params?: string[] }
// Optionally include appointment details in params order as per AiSensy template.
router.post('/confirm', async (req, res) => {
  if (!validateBody(req, res)) return;

  try {
    const { phone, chatbotId, templateName, params } = req.body || {};

    if (!phone || !chatbotId) {
      return res.status(400).json({ success: false, error: 'phone and chatbotId are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(String(chatbotId))) {
      return res.status(400).json({ success: false, error: 'Invalid chatbotId' });
    }

    // Check VerifiedUser existence (stateless; no sessions required)
    const verified = await VerifiedUser.exists({
      phone,
      chatbot_id: new mongoose.Types.ObjectId(String(chatbotId)),
    });

    if (!verified) {
      return res.status(403).json({ success: false, error: 'User not verified for this chatbot' });
    }

    // Send template via AiSensy
    const result = await sendWhatsAppTemplate({
      phone,
      campaignName: templateName || process.env.AISENSY_BOOKING_TEMPLATE || 'Appointment Confirmation',
      templateParams: Array.isArray(params) ? params : [],
      source: 'Booking Confirmation',
    });

    if (!result.ok) {
      return res.status(502).json({ success: false, error: result.error || 'Failed to send template', status: result.status, data: result.data });
    }

    return res.json({ success: true, message: 'Confirmation sent', status: result.status, data: result.data });
  } catch (err) {
    console.error('booking.confirm error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

module.exports = router;
