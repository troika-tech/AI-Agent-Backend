const mongoose = require('mongoose');

const ConversationFlowSchema = new mongoose.Schema({
  // User identification
  user_phone: { 
    type: String, 
    required: true,
    index: true 
  },
  
  chatbot_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Chatbot',
    required: true,
    index: true 
  },
  
  session_id: { 
    type: String, 
    required: true,
    index: true 
  },
  
  // Current conversation state
  current_state: { 
    type: String, 
    default: 'initial',
    index: true 
  },
  
  // Button context
  last_button_context: {
    template_type: String, // 'buttons', 'list', 'cta'
    template_name: String, // 'services', 'pricing', etc.
    button_id: String,     // Last clicked button ID
    button_title: String,  // Last clicked button title
    timestamp: Date
  },
  
  // Conversation flow data
  flow_data: {
    selected_service: String,
    selected_pricing: String,
    user_preferences: [String],
    collected_data: mongoose.Schema.Types.Mixed,
    current_step: Number,
    total_steps: Number
  },
  
  // Button interaction history
  button_history: [{
    button_id: String,
    button_title: String,
    template_type: String,
    template_name: String,
    timestamp: { type: Date, default: Date.now },
    user_response: String
  }],
  
  // Conversation metadata
  conversation_start: { 
    type: Date, 
    default: Date.now 
  },
  
  last_interaction: { 
    type: Date, 
    default: Date.now 
  },
  
  // Status tracking
  status: { 
    type: String, 
    default: 'active',
    enum: ['active', 'completed', 'abandoned', 'paused']
  },
  
  // Completion tracking
  completed_flows: [String], // List of completed flow types
  abandoned_flows: [String], // List of abandoned flow types
  
  // Analytics
  total_interactions: { 
    type: Number, 
    default: 0 
  },
  
  button_click_count: { 
    type: Number, 
    default: 0 
  },
  
  // Expiration
  expires_at: { 
    type: Date, 
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
});

// Indexes for better performance
ConversationFlowSchema.index({ user_phone: 1, chatbot_id: 1, session_id: 1 });
ConversationFlowSchema.index({ current_state: 1, status: 1 });
ConversationFlowSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Update last interaction before saving
ConversationFlowSchema.pre('save', function(next) {
  this.last_interaction = new Date();
  this.total_interactions += 1;
  next();
});

// Method to add button interaction
ConversationFlowSchema.methods.addButtonInteraction = function(buttonData) {
  this.button_history.push({
    button_id: buttonData.id,
    button_title: buttonData.title,
    template_type: buttonData.template_type,
    template_name: buttonData.template_name,
    user_response: buttonData.user_response || ''
  });
  
  this.last_button_context = {
    template_type: buttonData.template_type,
    template_name: buttonData.template_name,
    button_id: buttonData.id,
    button_title: buttonData.title,
    timestamp: new Date()
  };
  
  this.button_click_count += 1;
  
  return this.save();
};

// Method to update conversation state
ConversationFlowSchema.methods.updateState = function(newState, flowData = {}) {
  this.current_state = newState;
  this.flow_data = { ...this.flow_data, ...flowData };
  return this.save();
};

// Method to complete a flow
ConversationFlowSchema.methods.completeFlow = function(flowType) {
  if (!this.completed_flows.includes(flowType)) {
    this.completed_flows.push(flowType);
  }
  this.status = 'completed';
  return this.save();
};

// Method to abandon a flow
ConversationFlowSchema.methods.abandonFlow = function(flowType) {
  if (!this.abandoned_flows.includes(flowType)) {
    this.abandoned_flows.push(flowType);
  }
  this.status = 'abandoned';
  return this.save();
};

// Method to reset conversation
ConversationFlowSchema.methods.resetConversation = function() {
  this.current_state = 'initial';
  this.last_button_context = {};
  this.flow_data = {};
  this.button_history = [];
  this.status = 'active';
  this.completed_flows = [];
  this.abandoned_flows = [];
  this.total_interactions = 0;
  this.button_click_count = 0;
  return this.save();
};

// Static method to find active conversation
ConversationFlowSchema.statics.findActiveConversation = function(userPhone, chatbotId, sessionId) {
  return this.findOne({
    user_phone: userPhone,
    chatbot_id: chatbotId,
    session_id: sessionId,
    status: 'active'
  });
};

// Static method to get conversation analytics
ConversationFlowSchema.statics.getAnalytics = function(chatbotId, startDate, endDate) {
  const match = { chatbot_id: chatbotId };
  
  if (startDate && endDate) {
    match.conversation_start = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalConversations: { $sum: 1 },
        activeConversations: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        completedConversations: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        abandonedConversations: {
          $sum: { $cond: [{ $eq: ['$status', 'abandoned'] }, 1, 0] }
        },
        totalButtonClicks: { $sum: '$button_click_count' },
        averageInteractions: { $avg: '$total_interactions' },
        mostClickedButtons: {
          $push: {
            button_id: '$last_button_context.button_id',
            count: '$button_click_count'
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('ConversationFlow', ConversationFlowSchema);
