/*
 * ==========================================
 * WhatsApp Chatbot Webhook Controller
 * ==========================================
 * COMMENTED OUT: No longer offering WhatsApp chatbot service
 * This entire file is commented out and can be removed later
 * ==========================================
 */

/*
const axios = require("axios");
const logger = require("../utils/logger");
const Chatbot = require("../models/Chatbot");
const Message = require("../models/Message");
const { sendWhatsAppMessage, sendButtons, sendList, sendCallToAction, sendLocation, sendPhone, sendTextWithImage, sendImageMessage } = require("../utils/sendWhatsAppMessage");
const { sendCarouselMessage, sendCarouselTemplate } = require("../utils/whatsappCarouselAPI");
const { generateStreamingAnswer } = require("../services/chatService");
const { getContextualButtons, getButtonTemplate, getListTemplate } = require("../utils/buttonTemplates");
const { getImageSearchTerm, searchImages, getServiceImage } = require("../services/imageSearchService");
const ConversationFlow = require("../models/ConversationFlow");
const { v4: uuidv4 } = require("uuid");
const conversationInactivityManager = require("../utils/conversationInactivityManager");

/**
 * Get streaming answer for WhatsApp (internal streaming, complete response to WhatsApp)
 */


/**
 * Verify webhook for Meta WhatsApp Business API
 * GET /webhook
 */
/*
async function verifyWebhook(req, res) {
  try {
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    logger.info("🔍 Webhook verification attempt", {
      mode,
      hasToken: !!token,
      hasChallenge: !!challenge,
    });

    if (mode && token) {
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        logger.info("✅ Webhook verified successfully");
        return res.status(200).send(challenge);
      } else {
        logger.warn("❌ Verification failed: Token mismatch");
        return res.sendStatus(403);
      }
    }

    logger.warn("❌ Verification failed: Missing mode or token");
    return res.sendStatus(403);
  } catch (error) {
    logger.error("Webhook verification error:", error);
    return res.sendStatus(500);
  }
}

/**
 * Receive incoming WhatsApp messages
 * POST /webhook
 */
async function receiveMessage(req, res) {
  try {
    const data = req.body;

    // Quick acknowledgment to Meta
    res.sendStatus(200);

    // Log the entire webhook payload for debugging
    logger.info("📥 Webhook received:", JSON.stringify(data, null, 2));

    if (!data.object) {
      logger.info("No object in webhook data");
      return;
    }

    const entry = data.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // Process different message types
    if (!message) {
      logger.info("No message found in webhook - this might be a status update or other event");
      logger.info("Webhook data structure:", {
        hasEntry: !!entry,
        hasChanges: !!changes,
        hasValue: !!value,
        hasMessages: !!(value?.messages),
        messageCount: value?.messages?.length || 0
      });
      return;
    }

    const from = message.from; // User phone number
    const phoneNumberId = value.metadata.phone_number_id;
    const messageType = message.type;

    logger.info(`📩 WhatsApp ${messageType} message from ${from}`);

    // Handle different message types
    let userMessage = '';

    if (messageType === 'text') {
      userMessage = message.text.body;
      logger.info(`Text message: ${userMessage}`);
    } else if (messageType === 'interactive') {
      // Handle button clicks and interactive messages
      const interactive = message.interactive;
      if (interactive.type === 'button_reply') {
        userMessage = `[BUTTON_CLICK] ${interactive.button_reply.id}: ${interactive.button_reply.title}`;
        logger.info(`Button clicked: ${interactive.button_reply.id} - ${interactive.button_reply.title}`);
      } else if (interactive.type === 'list_reply') {
        userMessage = `[LIST_SELECT] ${interactive.list_reply.id}: ${interactive.list_reply.title}`;
        logger.info(`List item selected: ${interactive.list_reply.id} - ${interactive.list_reply.title}`);
      }
    } else {
      logger.info(`Unsupported message type: ${messageType}`);
      return;
    }

    // Find chatbot by phoneNumberId
    logger.info(`🔍 Looking for chatbot with phoneNumberId: ${phoneNumberId}`);
    const chatbot = await Chatbot.findOne({ phoneNumberId }).lean();

    if (!chatbot) {
      logger.warn(`❌ Chatbot not found for phoneNumberId: ${phoneNumberId}`);
      await sendWhatsAppMessage(
        phoneNumberId,
        from,
        "❌ Chatbot configuration not found. Please contact support."
      );
      return;
    }

    logger.info(`🤖 Matched chatbot: ${chatbot.name} (${chatbot._id})`);

    // Create or use session ID based on phone number
    const sessionId = `whatsapp-${from}`;

    // Start/Reset inactivity timer when user sends a message
    conversationInactivityManager.resetInactivityTimer(sessionId, from, chatbot._id);
    logger.info(`⏰ Inactivity timer reset for user message in session: ${sessionId}`);

    // Fetch conversation history (last 10 messages)
    const history = await Message.find({
      chatbot_id: chatbot._id,
      phone: from,
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    const conversationHistory = history
      .reverse()
      .map((msg) => ({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      }));

    logger.info(`📚 Retrieved ${conversationHistory.length} history messages`);

    // Send immediate response indicator based on query type
    let indicatorMessage = "💭 Processing your request...";
    
    // Determine indicator message based on query content
    const lowerQuery = userMessage.toLowerCase();
    if (lowerQuery.includes('product') || lowerQuery.includes('collection') || lowerQuery.includes('show') || lowerQuery.includes('find')) {
      indicatorMessage = "🔍 Searching for your products...";
    } else if (lowerQuery.includes('price') || lowerQuery.includes('cost') || lowerQuery.includes('pricing')) {
      indicatorMessage = "💰 Looking up pricing information...";
    } else if (lowerQuery.includes('contact') || lowerQuery.includes('call') || lowerQuery.includes('phone')) {
      indicatorMessage = "📞 Finding contact details...";
    } else if (lowerQuery.includes('service') || lowerQuery.includes('help') || lowerQuery.includes('what')) {
      indicatorMessage = "📋 Checking our services...";
    } else if (lowerQuery.includes('order') || lowerQuery.includes('buy') || lowerQuery.includes('purchase')) {
      indicatorMessage = "🛒 Preparing order information...";
    }

    // Send immediate indicator message
    try {
      await sendWhatsAppMessage(phoneNumberId, from, indicatorMessage);
      logger.info(`📤 Sent indicator message: ${indicatorMessage}`);
    } catch (indicatorError) {
      logger.warn('Failed to send indicator message:', indicatorError.message);
    }

    // Process message using the existing /query/stream endpoint
    let botResponse;
    let result = { productFeatureEnabled: false, productContext: "", answer: "" };
    try {
      logger.info("🚀 Using /query/stream endpoint for WhatsApp integration");
      
      // Generate a valid UUID for sessionId (always generate new one for WhatsApp)
      const validSessionId = require('crypto').randomUUID();
      
      const requestPayload = {
        query: userMessage,
        chatbotId: chatbot._id.toString(),
        sessionId: validSessionId, // Use valid UUID
        email: null,
        phone: from,
        language: 'en-IN',
        enableTTS: false // No audio for WhatsApp - we need text response
      };

      // Call the existing streaming endpoint internally using axios
      const streamResponse = await axios.post('http://localhost:5000/api/chat/query/stream', requestPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN || 'internal'}` // Internal token if needed
        },
        responseType: 'stream' // Important for SSE
      });

      // Process the SSE stream
      result = await new Promise((resolve, reject) => {
        let fullText = '';
        let suggestions = [];
        let productContext = '';
        let productFeatureEnabled = false;
        let buffer = '';

        streamResponse.data.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if ((data.type === 'text' && data.content) || (data.content && !data.type)) {
                  fullText += data.content;
                } else if (data.type === 'suggestions' && data.suggestions) {
                  suggestions = data.suggestions;
                } else if ((data.type === 'productContext' && data.context) || (data.context && data.productFeatureEnabled)) {
                  productContext = data.context;
                  productFeatureEnabled = data.productFeatureEnabled || true;
                } else if (data.type === 'complete') {
                  // Stream complete, resolve with results
                  resolve({
                    answer: fullText.trim() || "I'm here to help! How can I assist you?",
                    suggestions: suggestions,
                    productContext: productContext,
                    productFeatureEnabled: productFeatureEnabled
                  });
                }
              } catch (parseError) {
                // Skip invalid JSON lines
                continue;
              }
            }
          }
        });

        streamResponse.data.on('end', () => {
          resolve({
            answer: fullText.trim() || "I'm here to help! How can I assist you?",
            suggestions: suggestions,
            productContext: productContext,
            productFeatureEnabled: productFeatureEnabled
          });
        });

        streamResponse.data.on('error', (error) => {
          reject(error);
        });
      });

      // Send completion message before the actual response
      let completionMessage = "✅ Here's what I found:";
      
      // Customize completion message based on response type
      if (result.productFeatureEnabled && result.productContext) {
        completionMessage = "🛍️ Here are your products:";
      } else if (lowerQuery.includes('price') || lowerQuery.includes('cost')) {
        completionMessage = "💰 Here's the pricing information:";
      } else if (lowerQuery.includes('contact') || lowerQuery.includes('call')) {
        completionMessage = "📞 Here are the contact details:";
      } else if (lowerQuery.includes('service') || lowerQuery.includes('help')) {
        completionMessage = "📋 Here's what we offer:";
      }

      try {
        await sendWhatsAppMessage(phoneNumberId, from, completionMessage);
        logger.info(`✅ Sent completion message: ${completionMessage}`);
      } catch (completionError) {
        logger.warn('Failed to send completion message:', completionError.message);
      }

      // Clean up markdown formatting for WhatsApp
      botResponse = (result.answer || "I'm here to help! How can I assist you?")
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
        .replace(/\*(.*?)\*/g, '$1')      // Remove italic markdown
        .replace(/\n\s*\*\s/g, '\n- ')    // Convert * to - for lists
        .replace(/^\*\s/gm, '- ');        // Convert * to - at start of lines
    } catch (error) {
      logger.error("❌ Streaming chat processing error:", error);
      logger.error("❌ Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      botResponse = "⚠️ Sorry, I couldn't process your message right now. Please try again.";
      result = { productFeatureEnabled: false, productContext: "" };
    }

    // Save user message
    await Message.create({
      chatbot_id: chatbot._id,
      session_id: sessionId,
      phone: from,
      sender: "user",
      content: userMessage,
      timestamp: new Date(),
    });

    // Save bot response
    await Message.create({
      chatbot_id: chatbot._id,
      session_id: sessionId,
      phone: from,
      sender: "bot",
      content: botResponse,
      timestamp: new Date(),
    });

    logger.info("💾 Messages saved to database");

    // Handle conversation flow and button interactions
    let conversationFlow = await ConversationFlow.findActiveConversation(from, chatbot._id, sessionId);
    if (!conversationFlow) {
      conversationFlow = new ConversationFlow({
        user_phone: from,
        chatbot_id: chatbot._id,
        session_id: sessionId,
        current_state: 'initial'
      });
      await conversationFlow.save();
    }

    // Check for button interactions
    let buttonResponse = null;
    if (userMessage.includes('[BUTTON_CLICK]') || userMessage.includes('[LIST_SELECT]')) {
      const buttonId = userMessage.includes('[BUTTON_CLICK]') 
        ? userMessage.split(':')[0].replace('[BUTTON_CLICK] ', '')
        : userMessage.split(':')[0].replace('[LIST_SELECT] ', '');
      
      const buttonTitle = userMessage.split(':')[1]?.trim() || '';
      
      // Add button interaction to conversation flow
      await conversationFlow.addButtonInteraction({
        id: buttonId,
        title: buttonTitle,
        template_type: 'buttons',
        template_name: 'services',
        user_response: userMessage
      });

      // Handle specific button responses
      buttonResponse = await handleButtonResponse(buttonId, buttonTitle, conversationFlow, chatbot);
    }

    // Send response via WhatsApp
    let sent = false;
    
    // Check if user is asking about contact information
    const contactKeywords = [
      'contact', 'call', 'phone', 'email', 'address', 'location', 'reach', 'connect',
      'speak', 'talk', 'meet', 'visit', 'office', 'headquarters', 'support', 'help',
      'assistance', 'get in touch', 'reach out', 'contact details', 'phone number',
      'email address', 'where are you', 'how to reach', 'communication'
    ];
    
    const userMessageLower = userMessage.toLowerCase();
    const shouldAddRedirectionButtons = contactKeywords.some(keyword => 
      userMessageLower.includes(keyword)
    );

    // Check if we should show Quick Reply buttons (limit repetition)
    const botReplyCount = await Message.countDocuments({
      chatbot_id: chatbot._id,
      phone: from,
      sender: "bot"
    });

    // Get last Quick Reply sent count from conversation flow
    let lastQuickReplyCount = 0;
    if (conversationFlow && conversationFlow.history) {
      const lastQuickReply = conversationFlow.history
        .filter(h => h.event_type === 'quick_reply_sent')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      
      if (lastQuickReply && lastQuickReply.details) {
        lastQuickReplyCount = lastQuickReply.details.bot_reply_count || 0;
      }
    }

    const shouldShowQuickReply = (botReplyCount - lastQuickReplyCount) >= 10;

    // Handle button responses first
    if (buttonResponse) {
      sent = await buttonResponse;
    } else {
      // Check if we have products to display
      if (result.productFeatureEnabled && result.productContext) {
        try {
          // Parse products from context
          const productSections = result.productContext.split('\n\n');
          const products = [];
          
          for (const section of productSections) {
            if (section.includes('PRODUCT:')) {
              const lines = section.split('\n');
              const product = {};
              
              lines.forEach(line => {
                if (line.startsWith('PRODUCT:')) {
                  product.title = line.replace('PRODUCT:', '').trim();
                } else if (line.startsWith('PRICE:')) {
                  product.price = line.replace('PRICE:', '').trim();
                } else if (line.startsWith('SIZES:')) {
                  product.sizes = line.replace('SIZES:', '').trim();
                } else if (line.startsWith('COLORS:')) {
                  product.colors = line.replace('COLORS:', '').trim();
                } else if (line.startsWith('MATERIALS:')) {
                  product.materials = line.replace('MATERIALS:', '').trim();
                } else if (line.startsWith('IMAGE:')) {
                  product.image = line.replace('IMAGE:', '').trim();
                } else if (line.startsWith('SIMILARITY:')) {
                  product.similarity = line.replace('SIMILARITY:', '').trim();
                }
              });
              
              if (product.title && product.image) {
                products.push(product);
              }
            }
          }
          
          if (products.length > 0) {
            // Send each product as individual interactive message with image (like original)
            try {
              logger.info(`🛍️ Parsed ${products.length} products, sending individual messages...`);
              
              // Send each product as a separate interactive message for detailed view
              for (let i = 0; i < Math.min(products.length, 5); i++) {
                const product = products[i];
                
                // Create detailed product description
                let description = `💰 Price: ${product.price}`;
                if (product.sizes) description += `\n📏 Sizes: ${product.sizes}`;
                if (product.colors) description += `\n🎨 Colors: ${product.colors}`;
                if (product.materials) description += `\n🧵 Materials: ${product.materials}`;
                
                // Send product as interactive message with image
                await sendInteractiveMessageWithImage(
                  phoneNumberId, 
                  from, 
                  product.image,
                  `${product.title}\n\n${description}`, 
                  [
                    { id: 'view_details', title: 'View Details' },
                    { id: 'buy_now', title: 'Buy Now' },
                    { id: 'contact_sales', title: 'Contact Sales' }
                  ]
                );
                
                logger.info(`🛍️ Sent individual product ${i + 1}/${products.length}: ${product.title}`);
                
                // Add small delay between products
                if (i < products.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 1000));
                }
              }
              
              sent = true;
              logger.info(`🛍️ Successfully sent ${products.length} individual products for query: "${userMessage}"`);
              
              // Store all products for reference
              conversationFlow.currentProducts = products;
              await conversationFlow.save();
              
            } catch (productError) {
              logger.error('❌ Error sending individual products:', productError);
              // Fallback to text message if interactive messages fail
              let allProductsInfo = `🛍️ Found ${products.length} Products for "${userMessage}"\n\n`;
              products.forEach((p, index) => {
                allProductsInfo += `*${index + 1}. ${p.title}*\nPrice: ${p.price}\nSizes: ${p.sizes}\nColors: ${p.colors}\nMaterials: ${p.materials}\nImage: ${p.image}\n\n`;
              });
              await sendWhatsAppMessage(phoneNumberId, from, allProductsInfo);
              sent = true;
              logger.info(`📝 Text fallback sent with ${products.length} products for query: "${userMessage}"`);
            }
          }
        } catch (error) {
          logger.error("❌ Error displaying products:", error);
        }
      }
      
      // If products were sent, skip the regular response
      if (!sent) {
        // Check if we need to send buttons or list
      const contextualButtons = getContextualButtons('services', userMessage);
      let needsButtons = false;
      let needsList = false;
      
      if (userMessage.includes('service') || userMessage.includes('offer') || userMessage.includes('provide') || 
          userMessage.includes('what do you') || userMessage.includes('help') || userMessage.includes('options')) {
        needsButtons = true;
      } else if (userMessage.includes('price') || userMessage.includes('cost') || userMessage.includes('pricing') || 
                 userMessage.includes('plan') || userMessage.includes('package')) {
        needsList = true;
      } else if (botResponse.includes('[SEND_BUTTONS]')) {
        needsButtons = true;
        botResponse = botResponse.replace(/\[SEND_BUTTONS\]/g, '');
      } else if (botResponse.includes('[SEND_LIST]')) {
        needsList = true;
        botResponse = botResponse.replace(/\[SEND_LIST\]/g, '');
      }
      
            // Send single interactive message with image, text, and buttons
            if (botResponse.trim()) {
              if (needsButtons && shouldShowQuickReply) {
                // COMMENTED OUT: Get image for the interactive message (using Pexels)
                // const imageResult = await getAutomaticImage(userMessage, botResponse, conversationFlow);

                // For now, skip image and just send buttons without image
                if (false) { // imageResult.success && imageResult.image) {
                  // Get service buttons (keep all 3 buttons)
                  const serviceButtons = getButtonTemplate(contextualButtons.template);
                  
                  // Add redirection button if contact query detected
                  let allButtons = [...serviceButtons];
                  if (shouldAddRedirectionButtons) {
                    // Get random redirection button for contact queries (no emojis in button text)
                    const redirectionButtons = [
                      { id: 'website_redirect', title: 'Website', url: 'https://troikatech.in', emoji: '🌐' },
                      { id: 'whatsapp_redirect', title: 'WhatsApp', url: 'https://wa.me/919821211755', emoji: '📱' },
                      { id: 'instagram_redirect', title: 'Instagram', url: 'https://www.instagram.com/troikatechindia/', emoji: '📸' },
                      { id: 'linkedin_redirect', title: 'LinkedIn', url: 'https://www.linkedin.com/company/troika-tech/', emoji: '💼' }
                    ];
                    const randomIndex = Math.floor(Math.random() * redirectionButtons.length);
                    const randomButton = redirectionButtons[randomIndex];
                    
                    // Debug logging
                    logger.info(`🎲 Random button selected: ${randomButton.title} (index: ${randomIndex})`);
                    
                    // Send interactive message with image header, text body, and URL button
                    sent = await sendInteractiveMessageWithUrlButton(phoneNumberId, from, imageResult.image.url, botResponse, randomButton);
                  } else {
                    // Send single interactive message with image header and service buttons
                    sent = await sendInteractiveMessageWithImage(phoneNumberId, from, imageResult.image.url, botResponse, allButtons);
                  }
                  logger.info('🎯 Sending single interactive message with image and buttons');
                  
                  // Record Quick Reply sent in conversation flow
                  if (conversationFlow) {
                    await conversationFlow.addButtonInteraction({
                      event_type: 'quick_reply_sent',
                      bot_reply_count: botReplyCount,
                      timestamp: new Date()
                    });
                  }
                } else {
                  // Fallback to text without image (Pexels commented out)
                  sent = await sendWhatsAppMessage(phoneNumberId, from, botResponse);
                }
              } else if (needsList) {
                // For lists, use the current approach
                const listTemplate = getListTemplate(contextualButtons.template);
                if (listTemplate) {
                  sent = await sendList(phoneNumberId, from, botResponse, listTemplate.buttonText, listTemplate.sections);
                  logger.info('🎯 Sending list message');
                } else {
                  // Fallback to text without image (Pexels commented out)
                  sent = await sendWhatsAppMessage(phoneNumberId, from, botResponse);
                }
              } else {
                // Check if contact query detected - add redirection button
                if (shouldAddRedirectionButtons) {
                  // COMMENTED OUT: Get image for the interactive message (using Pexels)
                  // const imageResult = await getAutomaticImage(userMessage, botResponse, conversationFlow);

                  // For now, skip image and just send text with redirection button
                  if (false) { // imageResult.success && imageResult.image) {
                    // Get random redirection button (no emojis in button text)
                    const redirectionButtons = [
                      { id: 'website_redirect', title: 'Website', url: 'https://troikatech.in', emoji: '🌐' },
                      { id: 'whatsapp_redirect', title: 'WhatsApp', url: 'https://wa.me/919821211755', emoji: '📱' },
                      { id: 'instagram_redirect', title: 'Instagram', url: 'https://www.instagram.com/troikatechindia/', emoji: '📸' },
                      { id: 'linkedin_redirect', title: 'LinkedIn', url: 'https://www.linkedin.com/company/troika-tech/', emoji: '💼' }
                    ];
                    const randomIndex = Math.floor(Math.random() * redirectionButtons.length);
                    const randomButton = redirectionButtons[randomIndex];
                    
                    // Debug logging
                    logger.info(`🎲 Random button selected: ${randomButton.title} (index: ${randomIndex})`);
                    
                    // Send interactive message with image header, text body, and URL button
                    sent = await sendInteractiveMessageWithUrlButton(phoneNumberId, from, imageResult.image.url, botResponse, randomButton);
                    logger.info('🎯 Sending interactive message with image and URL redirect button for contact query');
                  } else {
                    // Fallback to text without image (Pexels commented out)
                    sent = await sendWhatsAppMessage(phoneNumberId, from, botResponse);
                  }
                } else {
                  // No buttons needed, just send text without image (Pexels commented out)
                  sent = await sendWhatsAppMessage(phoneNumberId, from, botResponse);
                }
              }
            }
      }
    }

    if (sent) {
      logger.info(`✅ Response sent to ${from}`);
      
      // Start/Reset inactivity timer for conversation transcript
      conversationInactivityManager.resetInactivityTimer(sessionId, from, chatbot._id);
      logger.info(`⏰ Inactivity timer reset for session: ${sessionId}`);
    } else {
      logger.error(`❌ Failed to send response to ${from}`);
    }
  } catch (error) {
    logger.error("❌ Error in receiveMessage:", error);
  }
}

/**
 * Handle button response based on button ID and context
 * @param {string} buttonId - Button ID that was clicked
 * @param {string} buttonTitle - Button title that was clicked
 * @param {Object} conversationFlow - Conversation flow object
 * @param {Object} chatbot - Chatbot object
 * @returns {Promise<boolean>} - Success status
 */
async function handleButtonResponse(buttonId, buttonTitle, conversationFlow, chatbot) {
  try {
    const phoneNumberId = chatbot.phoneNumberId;
    const userPhone = conversationFlow.user_phone;
    
    // Update conversation state based on button clicked
    await conversationFlow.updateState('button_interaction', {
      last_button: buttonId,
      last_button_title: buttonTitle
    });

    // Handle redirection buttons
    if (buttonId.includes('_redirect')) {
      const redirectionUrls = {
        'website_redirect': 'https://troikatech.in',
        'whatsapp_redirect': 'https://wa.me/919821211755',
        'instagram_redirect': 'https://www.instagram.com/troikatechindia/',
        'linkedin_redirect': 'https://www.linkedin.com/company/troika-tech/'
      };
      
      const url = redirectionUrls[buttonId];
      if (url) {
        // Send call-to-action button for direct redirect
        return await sendRedirectionCallToAction(phoneNumberId, userPhone);
      }
    }

    // Handle specific button responses
    switch (buttonId) {
      case 'ai_websites':
        await conversationFlow.updateState('service_selected', { selected_service: 'ai_websites' });
        return await sendButtons(phoneNumberId, userPhone, 
          "🌐 AI Websites - Complete solution in 24 hours!\n\nFeatures:\n• 5 pages included\n• Mobile responsive\n• SEO optimized\n• 1 year hosting", 
          getButtonTemplate('actions')
        );
        
      case 'supa_agent':
        await conversationFlow.updateState('service_selected', { selected_service: 'supa_agent' });
        return await sendButtons(phoneNumberId, userPhone, 
          "🤖 Supa Agent - 24/7 AI chatbot for your business!\n\nFeatures:\n• Instant responses\n• Lead qualification\n• Multi-language support\n• Easy integration", 
          getButtonTemplate('actions')
        );
        
      case 'whatsapp_marketing':
        await conversationFlow.updateState('service_selected', { selected_service: 'whatsapp_marketing' });
        return await sendList(phoneNumberId, userPhone, 
          "📱 WhatsApp Marketing - Reach customers directly!\n\nChoose a plan:", 
          "View Plans", 
          getListTemplate('pricing').sections
        );
        
      case 'book_demo':
        await conversationFlow.updateState('demo_requested', { action: 'book_demo' });
        return await sendButtons(phoneNumberId, userPhone, 
          "📅 Great! Let's schedule your demo.\n\nWhen would you prefer?", 
          [
            { id: 'morning', title: '🌅 Morning (9-12 PM)' },
            { id: 'afternoon', title: '☀️ Afternoon (12-5 PM)' },
            { id: 'evening', title: '🌆 Evening (5-8 PM)' }
          ]
        );
        
      case 'get_quote':
        await conversationFlow.updateState('quote_requested', { action: 'get_quote' });
        return await sendButtons(phoneNumberId, userPhone, 
          "💰 I'll prepare a custom quote for you!\n\nWhich service are you interested in?", 
          getButtonTemplate('services')
        );
        
      case 'contact_sales':
        await conversationFlow.updateState('sales_contact', { action: 'contact_sales' });
        return await sendButtons(phoneNumberId, userPhone, 
          "📞 Our sales team will contact you shortly!\n\nHow would you like to be contacted?", 
          [
            { id: 'whatsapp_call', title: '📱 WhatsApp Call' },
            { id: 'phone_call', title: '📞 Phone Call' },
            { id: 'email', title: '📧 Email' }
          ]
        );
        
      case 'features':
        return await sendList(phoneNumberId, userPhone, 
          "✨ Here are the key features of our services:", 
          "View Details", 
          [
            {
              title: "AI Websites",
              rows: [
                { id: 'responsive', title: 'Mobile Responsive', description: 'Works on all devices' },
                { id: 'seo', title: 'SEO Optimized', description: 'Better search rankings' },
                { id: 'fast', title: 'Fast Loading', description: 'Optimized performance' }
              ]
            }
          ]
        );
        
      case 'pricing':
        return await sendList(phoneNumberId, userPhone, 
          "💰 Here are our pricing options:", 
          "View Plans", 
          getListTemplate('pricing').sections
        );
        
      // Product carousel buttons
      case 'view_all_products':
        return await handleViewAllProducts(phoneNumberId, userPhone, conversationFlow);
        
      case 'search_again':
        return await sendButtons(phoneNumberId, userPhone, 
          "🔍 What would you like to search for?", 
          [
            { id: 'search_products', title: 'Search Products' },
            { id: 'view_services', title: 'View Services' },
            { id: 'contact_sales', title: 'Contact Sales' }
          ]
        );
        
      // Product selection (no longer needed with separate cards)
      case 'product_0':
      case 'product_1':
      case 'product_2':
      case 'product_3':
      case 'product_4':
      case 'product_5':
      case 'product_6':
      case 'product_7':
      case 'product_8':
      case 'product_9':
        return await sendButtons(phoneNumberId, userPhone, 
          "📱 Product details are now shown as separate cards!\n\nSearch for products to see them displayed individually.", 
          [
            { id: 'search_products', title: 'Search Products' },
            { id: 'view_services', title: 'View Services' },
            { id: 'contact_sales', title: 'Contact Sales' }
          ]
        );
        
      // Custom carousel swipe navigation
      case 'swipe_right':
        return await handleSwipeRight(phoneNumberId, userPhone, conversationFlow);
        
      case 'swipe_left':
        return await handleSwipeLeft(phoneNumberId, userPhone, conversationFlow);
        
      case 'view_details':
        return await sendButtons(phoneNumberId, userPhone, 
          "📋 Product Details\n\nFor detailed specifications, pricing, and availability, please visit our website or contact our sales team.", 
          [
            { id: 'visit_website', title: 'Visit Website' },
            { id: 'contact_sales', title: 'Contact Sales' },
            { id: 'back_to_products', title: 'Back to Products' }
          ]
        );
        
      case 'buy_now':
        return await sendButtons(phoneNumberId, userPhone, 
          "🛒 Ready to Purchase!\n\nTo complete your purchase, please contact our sales team or visit our website.", 
          [
            { id: 'contact_sales', title: 'Contact Sales' },
            { id: 'visit_website', title: 'Visit Website' },
            { id: 'back_to_products', title: 'Back to Products' }
          ]
        );
        
      case 'back_to_products':
        return await handleNextProduct(phoneNumberId, userPhone, conversationFlow);
        
      default:
        // Default response for unknown buttons
        return await sendButtons(phoneNumberId, userPhone, 
          "Thanks for your interest! How can I help you further?", 
          getButtonTemplate('actions')
        );
    }
  } catch (error) {
    logger.error('Error handling button response:', error);
    return false;
  }
}

/**
 * Send text with automatic image in a single message
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} userMessage - User's message
 * @param {string} botResponse - Bot's response
 * @param {Object} conversationFlow - Conversation flow object
 * @returns {Promise<boolean>} - Success status
 */
// COMMENTED OUT: Function to send text with automatic image (using Pexels)
// async function sendTextWithAutomaticImage(phoneNumberId, to, userMessage, botResponse, conversationFlow) {
//   try {
//     // First, get the appropriate image
//     const imageResult = await getAutomaticImage(userMessage, botResponse, conversationFlow);
    
//     if (imageResult.success && imageResult.image) {
//       // Send image with text as caption (this makes them appear more connected)
//       const imageSent = await sendImageMessage(phoneNumberId, to, imageResult.image.url, botResponse);
//       
//       if (imageSent) {
//         logger.info(`🖼️ Text with image sent to ${to}`, {
//           context: imageResult.context,
//           searchTerm: imageResult.searchTerm,
//           imageUrl: imageResult.image.url
//         });
//         return true;
//       } else {
//         // Fallback to text only if image fails
//         return await sendWhatsAppMessage(phoneNumberId, to, botResponse);
//       }
//     } else {
//       // No image found, send text only
//       return await sendWhatsAppMessage(phoneNumberId, to, botResponse);
//     }
//   } catch (error) {
//     logger.error("❌ Error sending text with automatic image:", error);
//     // Fallback to text only
//     return await sendWhatsAppMessage(phoneNumberId, to, botResponse);
//   }
// }

/**
 * Get automatic image based on user message and bot response
 * @param {string} userMessage - User's message
 * @param {string} botResponse - Bot's response
 * @param {Object} conversationFlow - Conversation flow object
 * @returns {Promise<Object>} - Image result with success status, image, and caption
 */
async function getAutomaticImage(userMessage, botResponse, conversationFlow) {
  try {
    // Determine context for image search
    let context = 'general';
    
    // Check conversation flow state
    if (conversationFlow && conversationFlow.current_state && conversationFlow.history) {
      if (conversationFlow.current_state.includes('service_selected')) {
        const service = conversationFlow.history
          .find(h => h.event_type === 'state_change' && h.details && h.details.selected_service)
          ?.details?.selected_service;
        if (service) context = service;
      }
    }
    
    // Check for specific keywords in user message or bot response
    const message = (userMessage + ' ' + botResponse).toLowerCase();
    if (message.includes('ai website') || message.includes('website')) {
      context = 'ai_websites';
    } else if (message.includes('supa agent') || message.includes('chatbot')) {
      context = 'supa_agent';
    } else if (message.includes('whatsapp') || message.includes('marketing')) {
      context = 'whatsapp_marketing';
    } else if (message.includes('price') || message.includes('cost') || message.includes('pricing')) {
      context = 'pricing';
    } else if (message.includes('feature') || message.includes('capability')) {
      context = 'features';
    } else if (message.includes('demo') || message.includes('presentation')) {
      context = 'demo';
    } else if (message.includes('contact') || message.includes('call')) {
      context = 'contact';
    }
    
    // Get appropriate search term
    const searchTerm = getImageSearchTerm(userMessage, botResponse, context);
    
    // Search for images
    const imageResult = await searchImages(searchTerm, 1, context);
    
    if (imageResult.success && imageResult.images && imageResult.images.length > 0) {
      const image = imageResult.images[0];
      
      // Create a relevant caption
      let caption = "";
      if (context === 'ai_websites') {
        caption = "🌐 Modern AI-powered websites that convert visitors into customers!";
      } else if (context === 'supa_agent') {
        caption = "🤖 24/7 AI assistant that never sleeps and always helps your customers!";
      } else if (context === 'whatsapp_marketing') {
        caption = "📱 Reach your customers directly with WhatsApp Marketing!";
      } else if (context === 'pricing') {
        caption = "💰 Transparent pricing for all our services!";
      } else {
        caption = "✨ Troika Tech - AI Created, Human Perfected!";
      }
      
      return {
        success: true,
        image: image,
        caption: caption,
        context: context,
        searchTerm: searchTerm
      };
    } else {
      return {
        success: false,
        message: `No suitable image found for search term: ${searchTerm}`
      };
    }
  } catch (error) {
    logger.error("❌ Error getting automatic image:", error);
    return {
      success: false,
      message: "Image search failed"
    };
  }
}

/**
 * Send single interactive message with image header, text body, and URL button (direct redirect)
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} imageUrl - URL of the image
 * @param {string} textBody - Text content
 * @param {Object} urlButton - Button object with id, title, and url
 * @returns {Promise<boolean>} - Success status
 */
async function sendInteractiveMessageWithUrlButton(phoneNumberId, to, imageUrl, textBody, urlButton) {
  try {
    const accessToken = process.env.WHATSAPP_TOKEN;
    if (!accessToken) {
      logger.error("WhatsApp Access Token is not set.");
      return false;
    }

    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "interactive",
      interactive: {
        type: "cta_url",
        header: {
          type: "image",
          image: {
            link: imageUrl
          }
        },
        body: {
          text: `🎯 ${textBody}`
            .replace(/\*\*(.*?)\*\*/g, '*$1*') // Convert **bold** to *bold*
            .replace(/\n\n/g, '\n') // Remove double line breaks
            .replace(/\n/g, '\n\n') // Add proper spacing
            .replace(/^\s*-\s/gm, '• ') // Convert dashes to bullets
            .replace(/^\s*\d+\.\s/gm, '• ') // Convert numbers to bullets
            + `\n\n${urlButton.emoji} Connect with us on ${urlButton.title}`
        },
        action: {
          name: "cta_url",
          parameters: {
            display_text: urlButton.title, // Clean title without emojis
            url: urlButton.url
          }
        },
        footer: {
          text: "✨ Click to connect instantly!"
        }
      }
    };

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.data && response.data.messages && response.data.messages.length > 0) {
      logger.info(`🎯 Interactive message with URL button sent to ${to}`, {
        messageId: response.data.messages[0].id,
        imageUrl: imageUrl,
        buttonTitle: urlButton.title,
        buttonUrl: urlButton.url
      });
      return true;
    } else {
      logger.warn(`❌ Failed to send interactive message with URL button to ${to}. Response:`, response.data);
      return false;
    }
  } catch (error) {
    logger.error("❌ Error sending interactive message with URL button:", error.response ? error.response.data : error.message);
    return false;
  }
}

/**
 * Send single interactive message with image header, text body, and buttons
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} imageUrl - URL of the image
 * @param {string} textBody - Text content
 * @param {Array} buttons - Array of button objects
 * @returns {Promise<boolean>} - Success status
 */
async function sendInteractiveMessageWithImage(phoneNumberId, to, imageUrl, textBody, buttons) {
  try {
    const accessToken = process.env.WHATSAPP_TOKEN;
    if (!accessToken) {
      logger.error("WhatsApp Access Token is not set.");
      return false;
    }

    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "interactive",
      interactive: {
        type: "button",
        header: {
          type: "image",
          image: {
            link: imageUrl
          }
        },
        body: {
          text: textBody
            .replace(/\*\*(.*?)\*\*/g, '*$1*') // Convert **bold** to *bold*
            .replace(/\n\n/g, '\n') // Remove double line breaks
            .replace(/\n/g, '\n\n') // Add proper spacing
            .replace(/^\s*-\s/gm, '• ') // Convert dashes to bullets
            .replace(/^\s*\d+\.\s/gm, '• ') // Convert numbers to bullets
        },
        action: {
          buttons: buttons.map(btn => {
            if (btn.url) {
              // URL button for redirection
              return {
                type: "reply",
                reply: {
                  id: btn.id,
                  title: btn.title
                }
              };
            } else {
              // Regular reply button
              return {
                type: "reply",
                reply: {
                  id: btn.id,
                  title: btn.title
                }
              };
            }
          })
        }
      }
    };

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.data && response.data.messages && response.data.messages.length > 0) {
      logger.info(`🎯 Interactive message with image sent to ${to}`, {
        messageId: response.data.messages[0].id,
        imageUrl: imageUrl
      });
      return true;
    } else {
      logger.warn(`❌ Failed to send interactive message to ${to}. Response:`, response.data);
      return false;
    }
  } catch (error) {
    logger.error("❌ Error sending interactive message with image:", error.response ? error.response.data : error.message);
    return false;
  }
}

/**
 * Send redirection call-to-action button (direct redirect)
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 */
async function sendRedirectionCallToAction(phoneNumberId, to) {
  try {
    const accessToken = process.env.WHATSAPP_TOKEN;
    if (!accessToken) {
      logger.error("WhatsApp Access Token is not set.");
      return false;
    }

    // Get random redirection button
    const redirectionButtons = [
      { id: 'website_redirect', title: '🌐 Website', url: 'https://troikatech.in' },
      { id: 'whatsapp_redirect', title: '📱 WhatsApp', url: 'https://wa.me/919821211755' },
      { id: 'instagram_redirect', title: '📸 Instagram', url: 'https://www.instagram.com/troikatechindia/' },
      { id: 'linkedin_redirect', title: '💼 LinkedIn', url: 'https://www.linkedin.com/company/troika-tech/' }
    ];
    const randomButton = redirectionButtons[Math.floor(Math.random() * redirectionButtons.length)];

    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

    // Use call-to-action for direct redirect (no header)
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: {
          text: "Connect with us" // Only body text, no header
        },
        action: {
          name: "cta_url",
          parameters: {
            display_text: randomButton.title,
            url: randomButton.url
          }
        }
      }
    };

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.data && response.data.messages && response.data.messages.length > 0) {
      logger.info(`🔗 Redirection call-to-action sent to ${to}`, {
        messageId: response.data.messages[0].id,
        button: randomButton.title,
        url: randomButton.url
      });
      return true;
    } else {
      logger.warn(`❌ Failed to send redirection call-to-action to ${to}. Response:`, response.data);
      return false;
    }
  } catch (error) {
    logger.error("❌ Error sending redirection call-to-action:", error.response ? error.response.data : error.message);
    return false;
  }
}

/**
 * Send custom redirection button (different style from quick reply)
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} message - Button message
 * @param {Object} button - Button object with id, title, url
 */
async function sendCustomRedirectionButton(phoneNumberId, to, message, button) {
  try {
    const accessToken = process.env.WHATSAPP_TOKEN;
    if (!accessToken) {
      logger.error("WhatsApp Access Token is not set.");
      return false;
    }

    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

    // Use call-to-action button style (different from quick reply)
    const payload = {
      messaging_product: "whatsapp",
      to: to,
      type: "interactive",
      interactive: {
        type: "cta_url", // Call-to-action with URL
        header: {
          type: "text",
          text: "🔗 Connect with us"
        },
        body: {
          text: message
        },
        action: {
          name: "cta_url",
          parameters: {
            display_text: button.title,
            url: button.url
          }
        }
      }
    };

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.data && response.data.messages && response.data.messages.length > 0) {
      logger.info(`🔗 Custom redirection button sent to ${to}`, {
        messageId: response.data.messages[0].id,
        button: button.title,
        url: button.url
      });
      return true;
    } else {
      logger.warn(`❌ Failed to send custom redirection button to ${to}. Response:`, response.data);
      return false;
    }
  } catch (error) {
    logger.error("❌ Error sending custom redirection button:", error.response ? error.response.data : error.message);
    return false;
  }
}

/**
 * Send redirection buttons (appears after 3+ bot replies)
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 */
async function sendRedirectionButtons(phoneNumberId, to) {
  try {
    // Define the 4 redirection buttons
    const redirectionButtons = [
      {
        id: 'website_redirect',
        title: '🌐 Website',
        url: 'https://troikatech.in'
      },
      {
        id: 'whatsapp_redirect',
        title: '📱 WhatsApp',
        url: 'https://wa.me/919821211755'
      },
      {
        id: 'instagram_redirect',
        title: '📸 Instagram',
        url: 'https://www.instagram.com/troikatechindia/'
      },
      {
        id: 'linkedin_redirect',
        title: '💼 LinkedIn',
        url: 'https://www.linkedin.com/company/troika-tech/'
      }
    ];
    
    // Randomly select 1 button to send (one at a time)
    const shuffledButtons = redirectionButtons.sort(() => 0.5 - Math.random());
    const selectedButtons = shuffledButtons.slice(0, 1);
    
    // Convert to WhatsApp button format
    const buttons = selectedButtons.map(btn => ({
      id: btn.id,
      title: btn.title
    }));
    
    // Send custom redirection button (different from regular quick reply)
    const selectedButton = selectedButtons[0];
    const message = `🔗 ${selectedButton.title}`;
    const buttonSent = await sendCustomRedirectionButton(phoneNumberId, to, message, selectedButton);
    
    if (!buttonSent) {
      logger.error("❌ Failed to send redirection button, retrying...");
      // Retry once more
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      await sendCustomRedirectionButton(phoneNumberId, to, message, selectedButton);
    }
    
    logger.info(`🔗 Redirection buttons sent to ${to}`, {
      buttons: selectedButtons.map(btn => btn.title)
    });
    
  } catch (error) {
    logger.error("❌ Error sending redirection buttons:", error);
  }
}

/**
 * Send automatic image response based on user message and bot response
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} to - Recipient phone number
 * @param {string} userMessage - User's message
 * @param {string} botResponse - Bot's response
 * @param {Object} conversationFlow - Conversation flow object
 */
async function sendAutomaticImage(phoneNumberId, to, userMessage, botResponse, conversationFlow) {
  try {
    // Determine context for image search
    let context = 'general';
    
    // Check conversation flow state
    if (conversationFlow && conversationFlow.current_state && conversationFlow.history) {
      if (conversationFlow.current_state.includes('service_selected')) {
        const service = conversationFlow.history
          .find(h => h.event_type === 'state_change' && h.details && h.details.selected_service)
          ?.details?.selected_service;
        if (service) context = service;
      }
    }
    
    // Check for specific keywords in user message or bot response
    const message = (userMessage + ' ' + botResponse).toLowerCase();
    if (message.includes('ai website') || message.includes('website')) {
      context = 'ai_websites';
    } else if (message.includes('supa agent') || message.includes('chatbot')) {
      context = 'supa_agent';
    } else if (message.includes('whatsapp') || message.includes('marketing')) {
      context = 'whatsapp_marketing';
    } else if (message.includes('price') || message.includes('cost') || message.includes('pricing')) {
      context = 'pricing';
    } else if (message.includes('feature') || message.includes('capability')) {
      context = 'features';
    } else if (message.includes('demo') || message.includes('presentation')) {
      context = 'demo';
    } else if (message.includes('contact') || message.includes('call')) {
      context = 'contact';
    }
    
    // Get appropriate search term
    const searchTerm = getImageSearchTerm(userMessage, botResponse, context);
    
    // Search for images
    const imageResult = await searchImages(searchTerm, 1, context);
    
    if (imageResult.success && imageResult.images && imageResult.images.length > 0) {
      const image = imageResult.images[0];
      
      // Create a relevant caption
      let caption = "";
      if (context === 'ai_websites') {
        caption = "🌐 Modern AI-powered websites that convert visitors into customers!";
      } else if (context === 'supa_agent') {
        caption = "🤖 24/7 AI assistant that never sleeps and always helps your customers!";
      } else if (context === 'whatsapp_marketing') {
        caption = "📱 Reach your customers directly with WhatsApp Marketing!";
      } else if (context === 'pricing') {
        caption = "💰 Transparent pricing for all our services!";
      } else {
        caption = "✨ Troika Tech - AI Created, Human Perfected!";
      }
      
      // Send image with caption
      const imageSent = await sendImageMessage(phoneNumberId, to, image.url, caption);
      
      if (imageSent) {
        logger.info(`🖼️ Automatic image sent to ${to}`, {
          searchTerm,
          context,
          imageUrl: image.url
        });
      } else {
        logger.warn(`❌ Failed to send automatic image to ${to}`);
      }
    } else {
      logger.info(`No suitable image found for search term: ${searchTerm}`);
    }
  } catch (error) {
    logger.error("❌ Error sending automatic image:", error);
  }
}

/**
 * Handle product selection from list
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} userPhone - User's phone number
 * @param {Object} conversationFlow - Conversation flow object
 * @param {string} buttonId - Button ID (product_0, product_1, etc.)
 * @returns {Promise<boolean>} - Success status
 */
async function handleProductSelection(phoneNumberId, userPhone, conversationFlow, buttonId) {
  try {
    if (!conversationFlow.currentProducts || conversationFlow.currentProducts.length === 0) {
      return await sendButtons(phoneNumberId, userPhone, 
        "📱 No products available.\n\nWould you like to search for products?", 
        [
          { id: 'search_products', title: 'Search Products' },
          { id: 'view_services', title: 'View Services' },
          { id: 'contact_sales', title: 'Contact Sales' }
        ]
      );
    }

    // Extract product index from button ID (product_0 -> 0, product_1 -> 1, etc.)
    const productIndex = parseInt(buttonId.replace('product_', ''));
    const product = conversationFlow.currentProducts[productIndex];

    if (!product) {
      return await sendButtons(phoneNumberId, userPhone, 
        "📱 Product not found.\n\nWould you like to search for products?", 
        [
          { id: 'search_products', title: 'Search Products' },
          { id: 'view_services', title: 'View Services' },
          { id: 'contact_sales', title: 'Contact Sales' }
        ]
      );
    }

    // Create detailed product description
    let description = `💰 Price: ${product.price}`;
    if (product.sizes) description += `\n📏 Sizes: ${product.sizes}`;
    if (product.colors) description += `\n🎨 Colors: ${product.colors}`;
    if (product.materials) description += `\n🧵 Materials: ${product.materials}`;
    description += `\n\n✨ ${(product.similarity * 100).toFixed(1)}% match`;
    description += `\n\n📱 Product ${productIndex + 1} of ${conversationFlow.currentProducts.length}`;

    // Send detailed product view
    const sent = await sendInteractiveMessageWithImage(
      phoneNumberId, 
      userPhone, 
      product.image,
      `${product.title}\n\n${description}`, 
      [
        { id: 'view_details', title: 'View Details' },
        { id: 'buy_now', title: 'Buy Now' },
        { id: 'contact_sales', title: 'Contact Sales' }
      ]
    );

    if (sent) {
      logger.info(`🛍️ Product ${productIndex + 1} details sent to ${userPhone}`);
    }

    return sent;
  } catch (error) {
    logger.error('Error handling product selection:', error);
    return false;
  }
}

/**
 * Handle swipeable product selection from list
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} userPhone - User's phone number
 * @param {Object} conversationFlow - Conversation flow object
 * @param {string} buttonId - Button ID (e.g., 'product_0')
 * @returns {Promise<boolean>} - Success status
 */
async function handleSwipeableProductSelection(phoneNumberId, userPhone, conversationFlow, buttonId) {
  try {
    if (!conversationFlow.currentProducts || conversationFlow.currentProducts.length === 0) {
      return await sendButtons(phoneNumberId, userPhone, 
        "📱 No products available.\n\nWould you like to search for products?", 
        [
          { id: 'search_products', title: 'Search Products' },
          { id: 'view_services', title: 'View Services' },
          { id: 'contact_sales', title: 'Contact Sales' }
        ]
      );
    }

    const productIndex = parseInt(buttonId.replace('product_', ''));
    const product = conversationFlow.currentProducts[productIndex];

    if (!product) {
      return await sendButtons(phoneNumberId, userPhone, 
        "📱 Product not found.\n\nWould you like to search for products?", 
        [
          { id: 'search_products', title: 'Search Products' },
          { id: 'view_services', title: 'View Services' },
          { id: 'contact_sales', title: 'Contact Sales' }
        ]
      );
    }

    // Create detailed product description
    let description = `🏷️ ${product.title}\n\n${product.description || 'Discover our premium collection'}\n\n💰 ${product.price}\n📏 Sizes: ${product.sizes || 'Various'}\n🎨 Colors: ${product.colors || 'Various'}\n✨ ${(product.similarity * 100).toFixed(1)}% match\n\n📱 Product ${productIndex + 1} of ${conversationFlow.currentProducts.length}`;

    // Send as image message with caption (like carousel)
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: userPhone,
      type: "image",
      image: {
        link: product.image || "https://via.placeholder.com/400x300?text=Product+Image",
        caption: description
      }
    };

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.messages && response.data.messages.length > 0) {
      logger.info(`🎠 Swipeable product ${productIndex + 1} details sent to ${userPhone}`);
      return true;
    } else {
      throw new Error('Invalid response from WhatsApp API');
    }

  } catch (error) {
    logger.error('Error handling swipeable product selection:', error);
    return false;
  }
}

/**
 * Handle view all products from carousel
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} userPhone - User's phone number
 * @param {Object} conversationFlow - Conversation flow object
 * @returns {Promise<boolean>} - Success status
 */
async function handleViewAllProducts(phoneNumberId, userPhone, conversationFlow) {
  try {
    if (!conversationFlow.currentProducts || conversationFlow.currentProducts.length === 0) {
      return await sendButtons(phoneNumberId, userPhone, 
        "📱 No products available.\n\nWould you like to search for products?", 
        [
          { id: 'search_products', title: 'Search Products' },
          { id: 'view_services', title: 'View Services' },
          { id: 'contact_sales', title: 'Contact Sales' }
        ]
      );
    }

    const products = conversationFlow.currentProducts;
    
    // Send each product as a separate interactive message for detailed view
    for (let i = 0; i < Math.min(products.length, 5); i++) {
      const product = products[i];
      
      // Create detailed product description
      let description = `💰 Price: ${product.price}`;
      if (product.sizes) description += `\n📏 Sizes: ${product.sizes}`;
      if (product.colors) description += `\n🎨 Colors: ${product.colors}`;
      if (product.materials) description += `\n🧵 Materials: ${product.materials}`;
      description += `\n\n✨ ${(product.similarity * 100).toFixed(1)}% match`;
      description += `\n\n📱 Product ${i + 1} of ${products.length}`;
      
      // Send product as interactive message
      await sendInteractiveMessageWithImage(
        phoneNumberId, 
        userPhone, 
        product.image,
        `${product.title}\n\n${description}`, 
        [
          { id: 'view_details', title: 'View Details' },
          { id: 'buy_now', title: 'Buy Now' },
          { id: 'contact_sales', title: 'Contact Sales' }
        ]
      );
      
      // Add small delay between products
      if (i < products.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    logger.info(`🛍️ Sent ${products.length} products in detailed view`);
    return true;
  } catch (error) {
    logger.error('Error handling view all products:', error);
    return false;
  }
}

/**
 * Handle swipe right navigation for custom carousel
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} userPhone - User's phone number
 * @param {Object} conversationFlow - Conversation flow object
 * @returns {Promise<boolean>} - Success status
 */
async function handleSwipeRight(phoneNumberId, userPhone, conversationFlow) {
  try {
    if (!conversationFlow.currentProducts || conversationFlow.currentProducts.length === 0) {
      return await sendButtons(phoneNumberId, userPhone, 
        "📱 No more products available.\n\nWould you like to search for something else?", 
        [
          { id: 'search_products', title: 'Search Products' },
          { id: 'view_services', title: 'View Services' },
          { id: 'contact_sales', title: 'Contact Sales' }
        ]
      );
    }

    // Get current product index
    const currentIndex = conversationFlow.currentProductIndex || 0;
    const totalProducts = conversationFlow.currentProducts.length;
    const nextIndex = (currentIndex + 1) % totalProducts; // Loop back to first if at end
    const product = conversationFlow.currentProducts[nextIndex];

    // Create carousel text matching reference design
    const carouselText = `🏷️ ${product.title}\n\n${product.description || 'Discover our premium collection'}\n\n💰 ${product.price}\n📏 Sizes: ${product.sizes || 'Various'}\n🎨 Colors: ${product.colors || 'Various'}\n✨ ${(product.similarity * 100).toFixed(1)}% match\n\n📱 ${nextIndex + 1}/${totalProducts}`;

    // Create swipe navigation buttons (overlaid on image)
    const buttons = [
      {
        type: "reply",
        reply: {
          id: "swipe_left",
          title: "←"
        }
      },
      {
        type: "reply",
        reply: {
          id: "swipe_right",
          title: "→"
        }
      },
      {
        type: "reply",
        reply: {
          id: "view_details",
          title: "View Details"
        }
      }
    ];

    // Send updated carousel with next product
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: userPhone,
      type: "interactive",
      interactive: {
        type: "button",
        header: {
          type: "image",
          image: {
            link: product.image || "https://via.placeholder.com/400x300?text=Product+Image"
          }
        },
        body: {
          text: carouselText
        },
        action: {
          buttons: buttons
        }
      }
    };

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.messages && response.data.messages.length > 0) {
      // Update conversation flow with new index
      conversationFlow.currentProductIndex = nextIndex;
      await conversationFlow.save();
      
      logger.info(`🎠 Carousel swipe right: Product ${nextIndex + 1} of ${totalProducts} sent to ${userPhone}`);
      return true;
    } else {
      throw new Error('Invalid response from WhatsApp API');
    }

  } catch (error) {
    logger.error('Error handling swipe right navigation:', error);
    return false;
  }
}

/**
 * Handle swipe left navigation for custom carousel
 * @param {string} phoneNumberId - WhatsApp phone number ID
 * @param {string} userPhone - User's phone number
 * @param {Object} conversationFlow - Conversation flow object
 * @returns {Promise<boolean>} - Success status
 */
async function handleSwipeLeft(phoneNumberId, userPhone, conversationFlow) {
  try {
    if (!conversationFlow.currentProducts || conversationFlow.currentProducts.length === 0) {
      return await sendButtons(phoneNumberId, userPhone, 
        "📱 No products available.\n\nWould you like to search for something else?", 
        [
          { id: 'search_products', title: 'Search Products' },
          { id: 'view_services', title: 'View Services' },
          { id: 'contact_sales', title: 'Contact Sales' }
        ]
      );
    }

    // Get current product index
    const currentIndex = conversationFlow.currentProductIndex || 0;
    const totalProducts = conversationFlow.currentProducts.length;
    const prevIndex = currentIndex === 0 ? totalProducts - 1 : currentIndex - 1; // Loop to last if at first
    const product = conversationFlow.currentProducts[prevIndex];

    // Create carousel text matching reference design
    const carouselText = `🏷️ ${product.title}\n\n${product.description || 'Discover our premium collection'}\n\n💰 ${product.price}\n📏 Sizes: ${product.sizes || 'Various'}\n🎨 Colors: ${product.colors || 'Various'}\n✨ ${(product.similarity * 100).toFixed(1)}% match\n\n📱 ${prevIndex + 1}/${totalProducts}`;

    // Create swipe navigation buttons (overlaid on image)
    const buttons = [
      {
        type: "reply",
        reply: {
          id: "swipe_left",
          title: "←"
        }
      },
      {
        type: "reply",
        reply: {
          id: "swipe_right",
          title: "→"
        }
      },
      {
        type: "reply",
        reply: {
          id: "view_details",
          title: "View Details"
        }
      }
    ];

    // Send updated carousel with previous product
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: userPhone,
      type: "interactive",
      interactive: {
        type: "button",
        header: {
          type: "image",
          image: {
            link: product.image || "https://via.placeholder.com/400x300?text=Product+Image"
          }
        },
        body: {
          text: carouselText
        },
        action: {
          buttons: buttons
        }
      }
    };

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.messages && response.data.messages.length > 0) {
      // Update conversation flow with new index
      conversationFlow.currentProductIndex = prevIndex;
      await conversationFlow.save();
      
      logger.info(`🎠 Carousel swipe left: Product ${prevIndex + 1} of ${totalProducts} sent to ${userPhone}`);
      return true;
    } else {
      throw new Error('Invalid response from WhatsApp API');
    }

  } catch (error) {
    logger.error('Error handling swipe left navigation:', error);
    return false;
  }
}

module.exports = {
  verifyWebhook: (req, res) => res.status(503).json({ error: "WhatsApp chatbot service is disabled" }),
  receiveMessage: (req, res) => res.status(503).json({ error: "WhatsApp chatbot service is disabled" }),
  handleButtonResponse: () => Promise.resolve(false)
};
*/

// Export disabled functions to prevent errors if routes are accidentally enabled
module.exports = {
  verifyWebhook: (req, res) => res.status(503).json({ error: "WhatsApp chatbot service is disabled" }),
  receiveMessage: (req, res) => res.status(503).json({ error: "WhatsApp chatbot service is disabled" }),
  handleButtonResponse: () => Promise.resolve(false)
};
