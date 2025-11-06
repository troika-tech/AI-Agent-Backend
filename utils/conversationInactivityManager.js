// utils/conversationInactivityManager.js
// Manages 30-second inactivity timers for WhatsApp conversations
// Sends conversation transcript PDF when user doesn't interact

const logger = require('./logger');
const Message = require('../models/Message');
const generatePDFBuffer = require('../pdf/historyPDFBuffer');
const uploadToS3 = require('./s3Uploader');
const sendWhatsAppTemplate = require('./sendWhatsAppTemplate');

class ConversationInactivityManager {
  constructor() {
    this.activeTimers = new Map(); // sessionId -> timer
    this.inactivityTimeout = 30000; // 30 seconds
  }

  /**
   * Start or reset inactivity timer for a conversation
   * @param {String} sessionId - Session ID
   * @param {String} phone - User phone number
   * @param {String} chatbotId - Chatbot ID
   */
  startInactivityTimer(sessionId, phone, chatbotId) {
    // Clear existing timer if any
    this.clearInactivityTimer(sessionId);

    logger.info(`⏰ Starting 30s inactivity timer for session: ${sessionId}`);

    const timer = setTimeout(async () => {
      try {
        await this.handleInactivity(sessionId, phone, chatbotId);
      } catch (error) {
        logger.error('Error handling inactivity:', error);
      }
    }, this.inactivityTimeout);

    this.activeTimers.set(sessionId, timer);
  }

  /**
   * Clear inactivity timer for a session
   * @param {String} sessionId - Session ID
   */
  clearInactivityTimer(sessionId) {
    const timer = this.activeTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.activeTimers.delete(sessionId);
      logger.info(`⏰ Cleared inactivity timer for session: ${sessionId}`);
    }
  }

  /**
   * Reset timer when user interacts
   * @param {String} sessionId - Session ID
   * @param {String} phone - User phone number
   * @param {String} chatbotId - Chatbot ID
   */
  resetInactivityTimer(sessionId, phone, chatbotId) {
    this.startInactivityTimer(sessionId, phone, chatbotId);
  }

  /**
   * Handle user inactivity - generate and send PDF
   * @param {String} sessionId - Session ID
   * @param {String} phone - User phone number
   * @param {String} chatbotId - Chatbot ID
   */
  async handleInactivity(sessionId, phone, chatbotId) {
    try {
      logger.info(`📄 Generating conversation transcript for inactive session: ${sessionId}`);

      // Fetch conversation messages
      const messages = await Message.find({
        chatbot_id: chatbotId,
        session_id: sessionId,
        phone: phone
      })
      .sort({ timestamp: 1 })
      .lean();

      if (messages.length === 0) {
        logger.warn(`No messages found for session: ${sessionId}`);
        return;
      }

      // Format messages for PDF
      const formattedMessages = messages.map(msg => ({
        sender: msg.sender === 'user' ? 'User' : 'Assistant',
        text: msg.content,
        timestamp: msg.timestamp
      }));

      // Generate PDF
      const pdfBuffer = await generatePDFBuffer({
        messages: formattedMessages,
        sessionId: sessionId,
        phone: phone,
        generatedAt: new Date()
      });

      // Upload to S3
      const s3Key = `conversation-transcripts/${sessionId}-${Date.now()}.pdf`;
      const s3Url = await uploadToS3(pdfBuffer, s3Key);

      if (!s3Url) {
        logger.error('Failed to upload PDF to S3');
        return;
      }

      // Send WhatsApp template with PDF
      await this.sendConversationTranscript(phone, s3Url, sessionId);

      logger.info(`✅ Conversation transcript sent successfully for session: ${sessionId}`);

    } catch (error) {
      logger.error('Error handling inactivity:', error);
    }
  }

  /**
   * Send conversation transcript via WhatsApp template
   * @param {String} phone - User phone number
   * @param {String} pdfUrl - S3 URL of the PDF
   * @param {String} sessionId - Session ID
   */
  async sendConversationTranscript(phone, pdfUrl, sessionId) {
    try {
      const result = await sendWhatsAppTemplate({
        phone: phone,
        campaignName: 'Document_Template',
        templateParams: [
          'Troika Tech Services', // FirstName parameter
          'Troika Tech Services'  // Second parameter (matching your template)
        ],
        media: {
          type: 'document',
          url: pdfUrl,
          filename: 'Chat-Summary.pdf'
        }
      });

      if (result.ok) {
        logger.info(`📱 WhatsApp template sent successfully to ${phone}`);
      } else {
        logger.error(`❌ Failed to send WhatsApp template: ${result.error}`);
      }

    } catch (error) {
      logger.error('Error sending WhatsApp template:', error);
    }
  }

  /**
   * Get active timer count (for monitoring)
   */
  getActiveTimerCount() {
    return this.activeTimers.size;
  }

  /**
   * Clear all timers (for cleanup)
   */
  clearAllTimers() {
    for (const [sessionId, timer] of this.activeTimers) {
      clearTimeout(timer);
      logger.info(`⏰ Cleared timer for session: ${sessionId}`);
    }
    this.activeTimers.clear();
  }
}

// Export singleton instance
module.exports = new ConversationInactivityManager();
