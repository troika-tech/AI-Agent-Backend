const axios = require("axios");
const logger = require("./logger");

const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v20.0";

/**
 * Send image message via WhatsApp Business API
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} imageUrl - URL of the image to send
 * @param {string} caption - Optional caption for the image
 * @returns {Promise<boolean>} - Success status
 */
async function sendImageMessage(phoneNumberId, to, imageUrl, caption = "") {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "image",
      image: {
        link: imageUrl
      }
    };

    // Add caption if provided
    if (caption && caption.trim()) {
      payload.image.caption = caption.substring(0, 1024); // WhatsApp caption limit
    }

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data.messages && response.data.messages[0]) {
      logger.info(`✅ Image sent successfully to ${to}`, {
        messageId: response.data.messages[0].id,
        imageUrl: imageUrl
      });
      return true;
    } else {
      logger.error("❌ Failed to send image:", response.data);
      return false;
    }
  } catch (error) {
    logger.error("❌ Error sending image:", error.response?.data || error.message);
    return false;
  }
}

/**
 * Send multiple images as separate messages
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {Array} images - Array of image objects with url and caption
 * @returns {Promise<boolean>} - Success status
 */
async function sendMultipleImages(phoneNumberId, to, images) {
  try {
    let allSent = true;
    
    for (const image of images) {
      const sent = await sendImageMessage(
        phoneNumberId, 
        to, 
        image.url, 
        image.caption || ""
      );
      
      if (!sent) {
        allSent = false;
      }
      
      // Small delay between images to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return allSent;
  } catch (error) {
    logger.error("❌ Error sending multiple images:", error);
    return false;
  }
}

/**
 * Send image with text message (text first, then image)
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} textMessage - Text message to send first
 * @param {string} imageUrl - URL of the image to send
 * @param {string} imageCaption - Optional caption for the image
 * @returns {Promise<boolean>} - Success status
 */
async function sendTextWithImage(phoneNumberId, to, textMessage, imageUrl, imageCaption = "") {
  try {
    // First send the text message
    const textSent = await sendTextMessage(phoneNumberId, to, textMessage);
    
    if (!textSent) {
      logger.warn("Text message failed, but continuing with image");
    }
    
    // Small delay between text and image
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Then send the image
    const imageSent = await sendImageMessage(phoneNumberId, to, imageUrl, imageCaption);
    
    return textSent && imageSent;
  } catch (error) {
    logger.error("❌ Error sending text with image:", error);
    return false;
  }
}

/**
 * Send text message (helper function)
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Text message
 * @returns {Promise<boolean>} - Success status
 */
async function sendTextMessage(phoneNumberId, to, message) {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "text",
      text: {
        body: message
      }
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.messages && response.data.messages[0];
  } catch (error) {
    logger.error("❌ Error sending text message:", error.response?.data || error.message);
    return false;
  }
}

module.exports = {
  sendImageMessage,
  sendMultipleImages,
  sendTextWithImage,
  sendTextMessage
};
