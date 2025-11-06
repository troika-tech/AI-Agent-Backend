const axios = require("axios");
const logger = require("./logger");
const {
  sendQuickReplyButtons,
  sendListMessage,
  sendCallToActionButtons,
  sendLocationRequest,
  sendPhoneRequest
} = require("./whatsappInteractiveAPI");
const {
  sendImageMessage,
  sendTextWithImage,
  sendMultipleImages
} = require("./whatsappImageAPI");

/**
 * Send WhatsApp message using Meta WhatsApp Business API
 * @param {string} phoneNumberId - WhatsApp Business Phone Number ID
 * @param {string} to - Recipient phone number (with country code)
 * @param {string} message - Message text to send
 * @returns {Promise<boolean>} - Success status
 */
async function sendWhatsAppMessage(phoneNumberId, to, message) {
  // Mock mode for testing
  if (process.env.NODE_ENV === "test" || process.env.MOCK_WHATSAPP === "true") {
    logger.info(`[MOCK WHATSAPP] To: ${to}, Message: ${message}`);
    return true;
  }

  if (!process.env.WHATSAPP_TOKEN) {
    logger.error("WHATSAPP_TOKEN not configured");
    return false;
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  try {
    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to,
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    logger.info(`✅ WhatsApp message sent to ${to}`);
    return true;
  } catch (error) {
    logger.error(
      `❌ WhatsApp send error: ${error.response?.data?.error?.message || error.message}`
    );
    return false;
  }
}


/**
 * Send quick reply buttons via WhatsApp
 * @param {string} phoneNumberId - WhatsApp Business Phone Number ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @param {Array} buttons - Array of button objects
 * @returns {Promise<boolean>} - Success status
 */
async function sendButtons(phoneNumberId, to, message, buttons) {
  if (process.env.NODE_ENV === "test" || process.env.MOCK_WHATSAPP === "true") {
    logger.info(`[MOCK WHATSAPP] Buttons to: ${to}, Message: ${message}, Buttons: ${buttons.length}`);
    return true;
  }
  return await sendQuickReplyButtons(phoneNumberId, to, message, buttons);
}

/**
 * Send list message via WhatsApp
 * @param {string} phoneNumberId - WhatsApp Business Phone Number ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @param {string} buttonText - Button text
 * @param {Array} sections - Array of section objects
 * @returns {Promise<boolean>} - Success status
 */
async function sendList(phoneNumberId, to, message, buttonText, sections) {
  if (process.env.NODE_ENV === "test" || process.env.MOCK_WHATSAPP === "true") {
    logger.info(`[MOCK WHATSAPP] List to: ${to}, Message: ${message}, Options: ${sections.length}`);
    return true;
  }
  return await sendListMessage(phoneNumberId, to, message, buttonText, sections);
}

/**
 * Send call-to-action buttons via WhatsApp
 * @param {string} phoneNumberId - WhatsApp Business Phone Number ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @param {Array} buttons - Array of CTA button objects
 * @returns {Promise<boolean>} - Success status
 */
async function sendCallToAction(phoneNumberId, to, message, buttons) {
  if (process.env.NODE_ENV === "test" || process.env.MOCK_WHATSAPP === "true") {
    logger.info(`[MOCK WHATSAPP] CTA to: ${to}, Message: ${message}, Buttons: ${buttons.length}`);
    return true;
  }
  return await sendCallToActionButtons(phoneNumberId, to, message, buttons);
}

/**
 * Send location request via WhatsApp
 * @param {string} phoneNumberId - WhatsApp Business Phone Number ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @returns {Promise<boolean>} - Success status
 */
async function sendLocation(phoneNumberId, to, message) {
  if (process.env.NODE_ENV === "test" || process.env.MOCK_WHATSAPP === "true") {
    logger.info(`[MOCK WHATSAPP] Location request to: ${to}, Message: ${message}`);
    return true;
  }
  return await sendLocationRequest(phoneNumberId, to, message);
}

/**
 * Send phone request via WhatsApp
 * @param {string} phoneNumberId - WhatsApp Business Phone Number ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @returns {Promise<boolean>} - Success status
 */
async function sendPhone(phoneNumberId, to, message) {
  if (process.env.NODE_ENV === "test" || process.env.MOCK_WHATSAPP === "true") {
    logger.info(`[MOCK WHATSAPP] Phone request to: ${to}, Message: ${message}`);
    return true;
  }
  return await sendPhoneRequest(phoneNumberId, to, message);
}

module.exports = {
  sendWhatsAppMessage,
  sendButtons,
  sendList,
  sendCallToAction,
  sendLocation,
  sendPhone,
  sendImageMessage,
  sendTextWithImage,
  sendMultipleImages
};
