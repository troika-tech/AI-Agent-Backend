// utils/sendConversationTranscript.js
// Specialized WhatsApp template sender for conversation transcripts

const sendWhatsAppTemplate = require('./sendWhatsAppTemplate');
const logger = require('./logger');

/**
 * Send conversation transcript via WhatsApp template
 * @param {String} phone - User phone number
 * @param {String} pdfUrl - S3 URL of the PDF
 * @param {String} sessionId - Session ID
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Result object
 */
async function sendConversationTranscript(phone, pdfUrl, sessionId, options = {}) {
  try {
    const {
      templateName = 'chatsummarytemp',
      campaignName = 'chatsummarytempsumm',
      companyName = 'Troika Tech Services'
    } = options;

    // Prepare template parameters (AiSensy format with placeholders)
    const templateParams = [
      '$FirstName'           // Placeholder that will be replaced by paramsFallbackValue
    ];

    // Prepare media object for PDF document
    const media = {
      url: pdfUrl,
      filename: 'Chat-Summary.pdf'
    };

    logger.info(`📱 Sending conversation transcript via WhatsApp to ${phone}`);
    logger.info(`📄 PDF URL: ${pdfUrl}`);
    logger.info(`🆔 Session ID: ${sessionId}`);

    const result = await sendWhatsAppTemplate({
      phone: phone,
      campaignName: campaignName,
      templateParams: templateParams,
      media: media,
      source: 'Conversation Transcript Service',
      attributes: {
        sessionId: sessionId,
        documentType: 'chatsummarytemp',
        generatedAt: new Date().toISOString()
      },
      paramsFallbackValue: {
        FirstName: companyName
      }
    });

    if (result.ok) {
      logger.info(`✅ Conversation transcript sent successfully to ${phone}`);
      return {
        success: true,
        message: 'Conversation transcript sent successfully',
        sessionId: sessionId,
        phone: phone,
        pdfUrl: pdfUrl
      };
    } else {
      logger.error(`❌ Failed to send conversation transcript: ${result.error}`);
      return {
        success: false,
        error: result.error,
        sessionId: sessionId,
        phone: phone
      };
    }

  } catch (error) {
    logger.error('Error sending conversation transcript:', error);
    return {
      success: false,
      error: error.message,
      sessionId: sessionId,
      phone: phone
    };
  }
}

/**
 * Send conversation transcript with custom message
 * @param {String} phone - User phone number
 * @param {String} pdfUrl - S3 URL of the PDF
 * @param {String} sessionId - Session ID
 * @param {String} customMessage - Custom message to include
 * @returns {Promise<Object>} - Result object
 */
async function sendConversationTranscriptWithMessage(phone, pdfUrl, sessionId, customMessage) {
  try {
    const result = await sendConversationTranscript(phone, pdfUrl, sessionId);

    if (result.success) {
      // Send additional text message with custom content
      const textMessage = `📄 ${customMessage}\n\nYour conversation transcript has been generated and sent as a PDF document.\n\nSession ID: ${sessionId}`;

      // You can add a text message here if needed
      logger.info(`📝 Custom message prepared: ${textMessage}`);
    }

    return result;

  } catch (error) {
    logger.error('Error sending conversation transcript with message:', error);
    return {
      success: false,
      error: error.message,
      sessionId: sessionId,
      phone: phone
    };
  }
}

/**
 * Test conversation transcript sending (for debugging)
 * @param {String} phone - User phone number
 * @param {String} testPdfUrl - Test PDF URL
 * @returns {Promise<Object>} - Result object
 */
async function testConversationTranscript(phone, testPdfUrl = 'https://example.com/test.pdf') {
  const testSessionId = `test-${Date.now()}`;

  logger.info(`🧪 Testing conversation transcript sending to ${phone}`);

  return await sendConversationTranscript(phone, testPdfUrl, testSessionId);
}

module.exports = {
  sendConversationTranscript,
  sendConversationTranscriptWithMessage,
  testConversationTranscript
};
