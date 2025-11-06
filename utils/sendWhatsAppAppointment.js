// utils/sendWhatsAppAppointment.js
// Mirrors sendWhatsAppOtp.js style, but for the approved AiSensy template: "appointment"
const axios = require('axios');

const sendWhatsAppAppointment = async (phone, templateParams = []) => {
  const payload = {
    apiKey: process.env.AISENSY_API_KEY, // Store in .env
    campaignName: 'Appointment Test',
    destination: `91${phone}`, // without + sign
    userName: 'Troika Tech Services',
    templateParams,
    source: 'Supa Agent',
    media: {},
    buttons: [],
    carouselCards: [],
    location: {},
    attributes: {},
  };

  try {
    const res = await axios.post(
      'https://backend.api-wa.co/campaign/troika-tech-services/api/v2',
      payload,
      { headers: { 'Content-Type': 'application/json' } }
    );

    return res.status === 200;
  } catch (err) {
    console.error('❌ WhatsApp Appointment Error:', err.response?.data || err.message);
    return false;
  }
};

module.exports = sendWhatsAppAppointment;
