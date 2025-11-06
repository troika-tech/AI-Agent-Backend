// utils/sendWhatsAppOtp.js
const axios = require("axios");

const sendWhatsAppOtp = async (phone, otp) => {
  const payload = {
    apiKey: process.env.AISENSY_API_KEY, // Store in .env
    campaignName: "Signup OTP Campaign",
    destination: `91${phone}`, // without + sign
    userName: "Troika Tech Services",
    templateParams: [otp],
    source: "Supa Agent",
    media: {},
    buttons: [
      {
        type: "button",
        sub_type: "url",
        index: 0,
        parameters: [
          {
            type: "text",
            text: otp,
          },
        ],
      },
    ],
    carouselCards: [],
    location: {},
    attributes: {},
  };

  try {
    const res = await axios.post(
      "https://backend.api-wa.co/campaign/troika-tech-services/api/v2",
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    return res.status === 200;
  } catch (err) {
    console.error("❌ WhatsApp OTP Error:", err.response?.data || err.message);
    return false;
  }
};



module.exports = sendWhatsAppOtp;
