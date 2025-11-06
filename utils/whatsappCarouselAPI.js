const axios = require('axios');
const logger = require('./logger');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_API_URL = `https://graph.facebook.com/v20.0`;

/**
 * Send custom carousel message matching reference design
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} headerText - Header text for the carousel
 * @param {string} bodyText - Body text for the carousel
 * @param {Array} products - Array of product objects
 * @returns {Promise<boolean>} - Success status
 */
async function sendCarouselMessage(phoneNumberId, to, headerText, bodyText, products) {
  try {
    if (!WHATSAPP_TOKEN) {
      throw new Error('WHATSAPP_TOKEN is not configured');
    }

    if (!products || products.length === 0) {
      throw new Error('No products provided for carousel');
    }

    // Limit to 4 products for better UX (like reference images)
    const carouselProducts = products.slice(0, 4);

    // Send separate cards for each product (truly swipeable)
    let allSent = true;
    
    for (let i = 0; i < carouselProducts.length; i++) {
      const product = carouselProducts[i];
      
      // Create product card text
      const cardText = `🏷️ ${product.title}\n\n${product.description || 'Discover our premium collection'}\n\n💰 ${product.price}\n📏 Sizes: ${product.sizes || 'Various'}\n🎨 Colors: ${product.colors || 'Various'}`;

      // Send individual product card as image message
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "image",
        image: {
          link: product.image || "https://via.placeholder.com/400x300?text=Product+Image",
          caption: cardText
        }
      };

      try {
        const response = await axios.post(
          `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
          payload,
          {
            headers: {
              'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.data && response.data.messages && response.data.messages.length > 0) {
          logger.info(`🎠 Product card ${i + 1} sent to ${to}`, {
            messageId: response.data.messages[0].id,
            productTitle: product.title,
            phoneNumberId
          });
        } else {
          allSent = false;
        }
      } catch (error) {
        logger.error(`Error sending product card ${i + 1}:`, error);
        allSent = false;
      }

      // Small delay between messages to avoid rate limiting
      if (i < carouselProducts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return allSent;

  } catch (error) {
    logger.error('Error sending separate product cards:', {
      error: error.response?.data || error.message,
      status: error.response?.status,
      phoneNumberId,
      to,
      productCount: products?.length || 0
    });
    return false;
  }
}

/**
 * Send carousel message using template (for approved templates)
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} templateName - Name of the approved template
 * @param {Array} products - Array of product objects
 * @returns {Promise<boolean>} - Success status
 */
async function sendCarouselTemplate(phoneNumberId, to, templateName, products) {
  try {
    if (!WHATSAPP_TOKEN) {
      throw new Error('WHATSAPP_TOKEN is not configured');
    }

    // Limit to 10 products (WhatsApp maximum)
    const carouselProducts = products.slice(0, 10);

    // Create carousel cards for template - FIXED FORMAT
    const cards = carouselProducts.map((product, index) => ({
      components: [
        {
          type: "HEADER",
          example: {
            header_url: [product.image || "https://via.placeholder.com/400x300?text=Product+Image"]
          }
        },
        {
          type: "BODY",
          text: `${product.title}\n\n💰 ${product.price}\n📏 Sizes: ${product.sizes || 'Various'}\n🎨 Colors: ${product.colors || 'Various'}\n✨ ${(product.similarity * 100).toFixed(1)}% match`
        },
        {
          type: "BUTTONS",
          buttons: [
            {
              type: "QUICK_REPLY",
              text: "View Details"
            },
            {
              type: "URL",
              text: "Buy Now",
              url: `https://azafashions.com/products/${product.productId || index}`,
              example: [product.productId || `product_${index}`]
            }
          ]
        }
      ]
    }));

    // Create the template message payload - CORRECT FORMAT
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "interactive",
      interactive: {
        type: "product_list",
        header: {
          type: "text",
          text: `🛍️ Found ${carouselProducts.length} Products`
        },
        body: {
          text: `Here are the best matching products for your search!`
        },
        action: {
          sections: [
            {
              title: "Products",
              product_items: carouselProducts.map((product, index) => ({
                product_retailer_id: product.productId || `product_${index}`
              }))
            }
          ]
        }
      }
    };

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.messages && response.data.messages.length > 0) {
      logger.info(`🎠 Carousel template sent to ${to}`, {
        messageId: response.data.messages[0].id,
        templateName,
        productCount: carouselProducts.length,
        phoneNumberId
      });
      return true;
    } else {
      throw new Error('Invalid response from WhatsApp API');
    }

  } catch (error) {
    logger.error('Error sending carousel template:', {
      error: error.response?.data || error.message,
      status: error.response?.status,
      phoneNumberId,
      to,
      templateName,
      productCount: products?.length || 0
    });
    return false;
  }
}

module.exports = {
  sendCarouselMessage,
  sendCarouselTemplate
};
