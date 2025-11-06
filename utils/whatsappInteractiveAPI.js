const axios = require('axios');
const logger = require('./logger');

/**
 * Send quick reply buttons via WhatsApp
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @param {Array} buttons - Array of button objects {id, title}
 * @returns {boolean} - Success status
 */
async function sendQuickReplyButtons(phoneNumberId, to, message, buttons) {
  try {
    const accessToken = process.env.WHATSAPP_TOKEN;
    
    // Validate buttons (max 3)
    if (!buttons || buttons.length === 0 || buttons.length > 3) {
      throw new Error('Quick reply buttons must have 1-3 buttons');
    }

    const messageData = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'text',
          text: 'Quick Reply'
        },
        body: {
          text: message
        },
        action: {
          buttons: buttons.map((button, index) => ({
            type: 'reply',
            reply: {
              id: button.id || `btn_${index}`,
              title: button.title.length > 20 ? button.title.substring(0, 17) + '...' : button.title
            }
          }))
        }
      }
    };

    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      messageData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.messages && response.data.messages.length > 0) {
      logger.info(`Quick reply buttons sent successfully: ${response.data.messages[0].id}`);
      return true;
    } else {
      logger.warn(`Failed to send quick reply buttons. Response:`, response.data);
      return false;
    }
  } catch (error) {
    logger.error('Error sending quick reply buttons:', {
      error: error.response?.data || error.message,
      status: error.response?.status || 'unknown',
      phoneNumberId,
      to,
      message,
      buttons: buttons.map(b => ({ id: b.id, title: b.title }))
    });
    return false;
  }
}

/**
 * Send list message via WhatsApp
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @param {string} buttonText - Button text (e.g., "View Options")
 * @param {Array} sections - Array of section objects
 * @returns {boolean} - Success status
 */
async function sendListMessage(phoneNumberId, to, message, buttonText, sections) {
  try {
    const accessToken = process.env.WHATSAPP_TOKEN;
    
    // Validate sections (max 10 options total)
    const totalOptions = sections.reduce((sum, section) => sum + section.rows.length, 0);
    if (totalOptions === 0 || totalOptions > 10) {
      throw new Error('List message must have 1-10 options total');
    }

    const messageData = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'list',
        header: {
          type: 'text',
          text: 'Choose an Option'
        },
        body: {
          text: message
        },
        action: {
          button: buttonText.length > 20 ? buttonText.substring(0, 17) + '...' : buttonText,
          sections: sections.map(section => ({
            title: section.title,
            rows: section.rows.map(row => ({
              id: row.id,
              title: row.title.length > 24 ? row.title.substring(0, 21) + '...' : row.title,
              description: row.description ? (row.description.length > 72 ? row.description.substring(0, 69) + '...' : row.description) : undefined
            }))
          }))
        }
      }
    };

    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      messageData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`List message sent successfully: ${response.data.messages[0].id}`);
    return true;
  } catch (error) {
    logger.error('Error sending list message:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Send call-to-action buttons via WhatsApp
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @param {Array} buttons - Array of CTA button objects {type, text, url/phone}
 * @returns {boolean} - Success status
 */
async function sendCallToActionButtons(phoneNumberId, to, message, buttons) {
  try {
    const accessToken = process.env.WHATSAPP_TOKEN;
    
    // Validate buttons (max 2 for CTA)
    if (!buttons || buttons.length === 0 || buttons.length > 2) {
      throw new Error('Call-to-action buttons must have 1-2 buttons');
    }

    const messageData = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'text',
          text: 'Action Required'
        },
        body: {
          text: message
        },
        action: {
          buttons: buttons.map((button, index) => {
            const baseButton = {
              type: 'reply',
              reply: {
                id: button.id || `cta_${index}`,
                title: button.text.length > 20 ? button.text.substring(0, 17) + '...' : button.text
              }
            };
            return baseButton;
          })
        }
      }
    };

    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      messageData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`Call-to-action buttons sent successfully: ${response.data.messages[0].id}`);
    return true;
  } catch (error) {
    logger.error('Error sending call-to-action buttons:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Send location request button
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @returns {boolean} - Success status
 */
async function sendLocationRequest(phoneNumberId, to, message) {
  try {
    const accessToken = process.env.WHATSAPP_TOKEN;

    const messageData = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'text',
          text: 'Location Required'
        },
        body: {
          text: message
        },
        action: {
          buttons: [{
            type: 'reply',
            reply: {
              id: 'location_request',
              title: '📍 Share Location'
            }
          }]
        }
      }
    };

    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      messageData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`Location request sent successfully: ${response.data.messages[0].id}`);
    return true;
  } catch (error) {
    logger.error('Error sending location request:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Send phone number request button
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Message text
 * @returns {boolean} - Success status
 */
async function sendPhoneRequest(phoneNumberId, to, message) {
  try {
    const accessToken = process.env.WHATSAPP_TOKEN;

    const messageData = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'text',
          text: 'Contact Required'
        },
        body: {
          text: message
        },
        action: {
          buttons: [{
            type: 'reply',
            reply: {
              id: 'phone_request',
              title: '📞 Share Phone'
            }
          }]
        }
      }
    };

    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      messageData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    logger.info(`Phone request sent successfully: ${response.data.messages[0].id}`);
    return true;
  } catch (error) {
    logger.error('Error sending phone request:', error.response?.data || error.message);
    return false;
  }
}

module.exports = {
  sendQuickReplyButtons,
  sendListMessage,
  sendCallToActionButtons,
  sendLocationRequest,
  sendPhoneRequest
};
