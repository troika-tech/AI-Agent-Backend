// routes/conversationTranscriptRoutes.js
// Routes for testing and managing conversation transcript functionality

const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const conversationInactivityManager = require('../utils/conversationInactivityManager');
const { sendConversationTranscript, testConversationTranscript } = require('../utils/sendConversationTranscript');
const { checkS3Access, listPDFs } = require('../utils/s3Uploader');
const Message = require('../models/Message');
const Chatbot = require('../models/Chatbot');
const generatePDFBuffer = require('../pdf/historyPDFBuffer');
const uploadToS3 = require('../utils/s3Uploader');
const logger = require('../utils/logger');

/**
 * Test conversation transcript sending
 * POST /api/conversation-transcript/test
 */
router.post('/test', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { phone, testPdfUrl } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    logger.info(`🧪 Testing conversation transcript for phone: ${phone}`);

    const result = await testConversationTranscript(phone, testPdfUrl);

    res.json({
      success: true,
      message: 'Test completed',
      result: result
    });

  } catch (error) {
    logger.error('Error testing conversation transcript:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate and send conversation transcript for a specific session (Public endpoint)
 * POST /api/conversation-transcript/send
 */
router.post('/send', async (req, res) => {
  try {
    const { sessionId, phone, chatbotId, customMessage, chatHistory } = req.body;

    if (!sessionId || !phone || !chatbotId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID, phone, and chatbot ID are required'
      });
    }

    logger.info(`📄 Generating conversation transcript for session: ${sessionId}`);

    let messages = [];

    // First try to fetch from database
    try {
      // Build query - make phone optional to handle cases where messages don't have phone
      const query = {
        chatbot_id: chatbotId,
        session_id: sessionId
      };

      // Only add phone to query if it's provided and not null/undefined
      if (phone && phone !== 'null' && phone !== 'undefined') {
        query.phone = phone;
      }

      logger.info(`🔍 Querying database with:`, {
        chatbotId,
        sessionId,
        hasPhone: !!query.phone,
        phone: query.phone ? '***' + phone.slice(-4) : 'not-included'
      });

      messages = await Message.find(query)
        .sort({ timestamp: 1 })
        .lean();

      logger.info(`📊 Found ${messages.length} messages in database for session: ${sessionId}`);

      // If we got messages, log first and last for debugging
      if (messages.length > 0) {
        logger.info(`   First message: ${messages[0].content.substring(0, 50)}...`);
        logger.info(`   Last message: ${messages[messages.length - 1].content.substring(0, 50)}...`);
      }
    } catch (dbError) {
      logger.warn(`⚠️ Database query failed: ${dbError.message}`);
      logger.error('Query error details:', dbError.stack);
    }

    // If no messages in database, use frontend chat history
    if (messages.length === 0 && chatHistory && Array.isArray(chatHistory)) {
      logger.info(`📱 Using frontend chat history (${chatHistory.length} messages)`);
      messages = chatHistory.map(msg => ({
        sender: msg.sender === 'user' ? 'user' : 'bot',
        content: msg.text || msg.content,
        timestamp: msg.timestamp || new Date()
      }));
    }

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No messages found for this session. Please ensure you have a conversation before sending the transcript.'
      });
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
    const s3Url = await uploadToS3.uploadToS3(pdfBuffer, s3Key);

    if (!s3Url) {
      return res.status(500).json({
        success: false,
        error: 'Failed to upload PDF to S3'
      });
    }

    // Send WhatsApp template
    const result = await sendConversationTranscript(phone, s3Url, sessionId);

    res.json({
      success: true,
      message: 'Conversation transcript sent successfully',
      result: result,
      s3Url: s3Url,
      messageCount: messages.length
    });

  } catch (error) {
    logger.error('Error sending conversation transcript:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get inactivity timer status
 * GET /api/conversation-transcript/timers
 */
router.get('/timers', protect, restrictTo('admin'), async (req, res) => {
  try {
    const activeTimerCount = conversationInactivityManager.getActiveTimerCount();

    res.json({
      success: true,
      activeTimers: activeTimerCount,
      message: `Currently ${activeTimerCount} active inactivity timers`
    });

  } catch (error) {
    logger.error('Error getting timer status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Clear all inactivity timers
 * DELETE /api/conversation-transcript/timers
 */
router.delete('/timers', protect, restrictTo('admin'), async (req, res) => {
  try {
    conversationInactivityManager.clearAllTimers();

    res.json({
      success: true,
      message: 'All inactivity timers cleared'
    });

  } catch (error) {
    logger.error('Error clearing timers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Check S3 connectivity (Public endpoint)
 * GET /api/conversation-transcript/s3-status
 */
router.get('/s3-status', async (req, res) => {
  try {
    const isAccessible = await checkS3Access();

    res.json({
      success: true,
      s3Accessible: isAccessible,
      message: isAccessible ? 'S3 is accessible' : 'S3 is not accessible'
    });

  } catch (error) {
    logger.error('Error checking S3 status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List PDFs in S3 bucket
 * GET /api/conversation-transcript/pdfs
 */
router.get('/pdfs', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { prefix = 'conversation-transcripts/', limit = 50 } = req.query;
    const pdfs = await listPDFs(prefix);

    const limitedPdfs = pdfs.slice(0, parseInt(limit));

    res.json({
      success: true,
      pdfs: limitedPdfs,
      count: limitedPdfs.length,
      total: pdfs.length
    });

  } catch (error) {
    logger.error('Error listing PDFs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get conversation history for a session (Public endpoint)
 * GET /api/conversation-transcript/history/:sessionId
 */
router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { phone, chatbotId } = req.query;

    if (!phone || !chatbotId) {
      return res.status(400).json({
        success: false,
        error: 'Phone and chatbot ID are required'
      });
    }

    const messages = await Message.find({
      chatbot_id: chatbotId,
      session_id: sessionId,
      phone: phone
    })
    .sort({ timestamp: 1 })
    .lean();

    res.json({
      success: true,
      sessionId: sessionId,
      messageCount: messages.length,
      messages: messages
    });

  } catch (error) {
    logger.error('Error getting conversation history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
