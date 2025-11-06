// routes/proposalRoutes.js
// Routes for sending service proposals via WhatsApp

const express = require('express');
const router = express.Router();
const sendWhatsAppProposal = require('../utils/sendWhatsAppProposal');
const { sendWhatsAppMarketingProposal } = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * Send service proposal via WhatsApp (Public endpoint)
 * POST /api/proposal/send
 *
 * Request body:
 * {
 *   phone: string (required) - Phone number with or without country code
 *   serviceName: string (required) - Name of the selected service
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   result?: object
 * }
 */
router.post('/send', async (req, res) => {
  try {
    const { phone, serviceName } = req.body;

    // Validate required fields
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    if (!serviceName) {
      return res.status(400).json({
        success: false,
        error: 'Service name is required'
      });
    }

    logger.info(`📋 Proposal request received for service: ${serviceName}, phone: ${phone}`);

    // Send proposal via WhatsApp
    const result = await sendWhatsAppProposal({
      phone,
      serviceName
    });

    // Handle result
    if (!result.ok) {
      logger.warn(`⚠️ Proposal send failed: ${result.error}`);
      return res.status(result.status || 500).json({
        success: false,
        error: result.error || 'Failed to send proposal',
        details: result.data
      });
    }

    logger.info(`✅ Proposal sent successfully for ${serviceName}`);
    res.json({
      success: true,
      message: 'Proposal sent on WhatsApp',
      result: result.data
    });

  } catch (error) {
    logger.error('Error sending proposal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * Send WhatsApp Marketing proposal via Email (Public endpoint)
 * POST /api/proposal/send-email
 *
 * Request body:
 * {
 *   email: string (required) - Email address to send the proposal to
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
router.post('/send-email', async (req, res) => {
  try {
    const { email } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format'
      });
    }

    logger.info(`📧 WhatsApp Marketing proposal email request received for: ${email}`);

    // Send proposal via email
    const result = await sendWhatsAppMarketingProposal(email);

    // Handle result
    if (!result) {
      logger.warn(`⚠️ Email proposal send failed for: ${email}`);
      return res.status(500).json({
        success: false,
        error: 'Failed to send proposal email'
      });
    }

    logger.info(`✅ WhatsApp Marketing proposal email sent successfully to: ${email}`);
    res.json({
      success: true,
      message: 'WhatsApp Marketing proposal sent successfully to your email'
    });

  } catch (error) {
    logger.error('Error sending email proposal:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * Health check endpoint for proposal service
 * GET /api/proposal/health
 */
router.get('/health', async (req, res) => {
  try {
    const hasApiKey = !!process.env.AISENSY_API_KEY;
    const orgSlug = process.env.AISENSY_ORG_SLUG || 'troika-tech-services';

    res.json({
      success: true,
      status: 'operational',
      configured: hasApiKey,
      orgSlug: hasApiKey ? orgSlug : 'not-configured',
      message: hasApiKey
        ? 'Proposal service is ready'
        : 'Proposal service requires AISENSY_API_KEY configuration'
    });
  } catch (error) {
    logger.error('Error checking proposal service health:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
