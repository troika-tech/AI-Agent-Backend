const ConversationFlow = require('../models/ConversationFlow');
const logger = require('../utils/logger');

/**
 * Get conversation analytics
 * GET /api/interactive/analytics
 */
async function getConversationAnalytics(req, res) {
  try {
    const { chatbotId, startDate, endDate } = req.query;

    if (!chatbotId) {
      return res.status(400).json({ error: 'chatbotId is required' });
    }

    const analytics = await ConversationFlow.getAnalytics(chatbotId, startDate, endDate);
    
    res.json({
      analytics: analytics[0] || {
        totalConversations: 0,
        activeConversations: 0,
        completedConversations: 0,
        abandonedConversations: 0,
        totalButtonClicks: 0,
        averageInteractions: 0,
        mostClickedButtons: []
      }
    });
  } catch (error) {
    logger.error('Error getting conversation analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get conversation flow for a user
 * GET /api/interactive/flow/:phone
 */
async function getConversationFlow(req, res) {
  try {
    const { phone } = req.params;
    const { chatbotId, sessionId } = req.query;

    if (!chatbotId || !sessionId) {
      return res.status(400).json({ error: 'chatbotId and sessionId are required' });
    }

    const flow = await ConversationFlow.findActiveConversation(phone, chatbotId, sessionId);
    
    if (!flow) {
      return res.status(404).json({ error: 'No active conversation found' });
    }

    res.json({
      flow: {
        id: flow._id,
        currentState: flow.current_state,
        lastButtonContext: flow.last_button_context,
        flowData: flow.flow_data,
        buttonHistory: flow.button_history,
        totalInteractions: flow.total_interactions,
        buttonClickCount: flow.button_click_count,
        status: flow.status,
        createdAt: flow.conversation_start,
        lastInteraction: flow.last_interaction
      }
    });
  } catch (error) {
    logger.error('Error getting conversation flow:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Reset conversation flow for a user
 * POST /api/interactive/flow/:phone/reset
 */
async function resetConversationFlow(req, res) {
  try {
    const { phone } = req.params;
    const { chatbotId, sessionId } = req.body;

    if (!chatbotId || !sessionId) {
      return res.status(400).json({ error: 'chatbotId and sessionId are required' });
    }

    const flow = await ConversationFlow.findActiveConversation(phone, chatbotId, sessionId);
    
    if (!flow) {
      return res.status(404).json({ error: 'No active conversation found' });
    }

    await flow.resetConversation();

    res.json({
      message: 'Conversation flow reset successfully',
      flow: {
        id: flow._id,
        currentState: flow.current_state,
        status: flow.status
      }
    });
  } catch (error) {
    logger.error('Error resetting conversation flow:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get button click statistics
 * GET /api/interactive/buttons/stats
 */
async function getButtonStats(req, res) {
  try {
    const { chatbotId, startDate, endDate } = req.query;

    if (!chatbotId) {
      return res.status(400).json({ error: 'chatbotId is required' });
    }

    const match = { chatbot_id: chatbotId };
    
    if (startDate && endDate) {
      match.conversation_start = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const stats = await ConversationFlow.aggregate([
      { $match: match },
      { $unwind: '$button_history' },
      {
        $group: {
          _id: '$button_history.button_id',
          buttonTitle: { $first: '$button_history.button_title' },
          clickCount: { $sum: 1 },
          templateType: { $first: '$button_history.template_type' },
          templateName: { $first: '$button_history.template_name' }
        }
      },
      { $sort: { clickCount: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      buttonStats: stats.map(stat => ({
        buttonId: stat._id,
        buttonTitle: stat.buttonTitle,
        clickCount: stat.clickCount,
        templateType: stat.templateType,
        templateName: stat.templateName
      }))
    });
  } catch (error) {
    logger.error('Error getting button stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get conversation flow templates
 * GET /api/interactive/templates
 */
async function getFlowTemplates(req, res) {
  try {
    const templates = {
      serviceSelection: {
        name: 'Service Selection Flow',
        description: 'Guide users through service selection',
        steps: [
          'Welcome message with service buttons',
          'Service details with action buttons',
          'Pricing information with list',
          'Contact options with CTA buttons'
        ]
      },
      leadCapture: {
        name: 'Lead Capture Flow',
        description: 'Collect lead information step by step',
        steps: [
          'Interest identification',
          'Contact information collection',
          'Requirements gathering',
          'Follow-up scheduling'
        ]
      },
      support: {
        name: 'Support Flow',
        description: 'Provide structured support options',
        steps: [
          'Issue categorization',
          'Specific problem identification',
          'Solution provision',
          'Escalation if needed'
        ]
      }
    };

    res.json({ templates });
  } catch (error) {
    logger.error('Error getting flow templates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getConversationAnalytics,
  getConversationFlow,
  resetConversationFlow,
  getButtonStats,
  getFlowTemplates
};
