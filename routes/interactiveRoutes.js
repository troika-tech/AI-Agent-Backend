const express = require('express');
const router = express.Router();
const {
  getConversationAnalytics,
  getConversationFlow,
  resetConversationFlow,
  getButtonStats,
  getFlowTemplates
} = require('../controllers/interactiveController');

// Get conversation analytics
router.get('/analytics', getConversationAnalytics);

// Get conversation flow for a user
router.get('/flow/:phone', getConversationFlow);

// Reset conversation flow for a user
router.post('/flow/:phone/reset', resetConversationFlow);

// Get button click statistics
router.get('/buttons/stats', getButtonStats);

// Get conversation flow templates
router.get('/templates', getFlowTemplates);

module.exports = router;
