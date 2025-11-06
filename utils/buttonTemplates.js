/**
 * Pre-defined button templates for common scenarios
 */

// Service selection buttons
const SERVICE_BUTTONS = [
  { id: 'ai_websites', title: '🌐 AI Websites' },
  { id: 'supa_agent', title: '🤖 Supa Agent' },
  { id: 'whatsapp_marketing', title: '📱 WhatsApp Marketing' }
];

// Pricing buttons
const PRICING_BUTTONS = [
  { id: 'ai_website_pricing', title: 'AI Website ₹25K' },
  { id: 'supa_agent_pricing', title: 'Supa Agent ₹15K' },
  { id: 'whatsapp_pricing', title: 'WhatsApp ₹70K' }
];

// Action buttons
const ACTION_BUTTONS = [
  { id: 'book_demo', title: '📅 Book Demo' },
  { id: 'get_quote', title: '💰 Get Quote' },
  { id: 'contact_sales', title: '📞 Contact Sales' }
];

// Information buttons
const INFO_BUTTONS = [
  { id: 'features', title: '✨ Features' },
  { id: 'pricing', title: '💰 Pricing' },
  { id: 'portfolio', title: '🎨 Portfolio' }
];

// Support buttons
const SUPPORT_BUTTONS = [
  { id: 'technical_support', title: '🔧 Technical' },
  { id: 'billing_support', title: '💳 Billing' },
  { id: 'general_inquiry', title: '❓ General' }
];

// Yes/No buttons
const YES_NO_BUTTONS = [
  { id: 'yes', title: '✅ Yes' },
  { id: 'no', title: '❌ No' }
];

// Confirmation buttons
const CONFIRM_BUTTONS = [
  { id: 'confirm', title: '✅ Confirm' },
  { id: 'cancel', title: '❌ Cancel' }
];

// List message templates
const SERVICE_LIST = {
  buttonText: 'View Services',
  sections: [{
    title: 'Our Services',
    rows: [
      {
        id: 'ai_websites',
        title: 'AI Websites',
        description: 'Complete website in 24 hours - ₹25,000'
      },
      {
        id: 'supa_agent',
        title: 'Supa Agent',
        description: '24/7 AI chatbot for your business - ₹15,000'
      },
      {
        id: 'whatsapp_marketing',
        title: 'WhatsApp Marketing',
        description: 'Bulk messaging campaigns - ₹70,000'
      },
      {
        id: 'rcs_messaging',
        title: 'RCS Messaging',
        description: 'Rich communication services'
      }
    ]
  }]
};

const PRICING_LIST = {
  buttonText: 'View Pricing',
  sections: [{
    title: 'Pricing Plans',
    rows: [
      {
        id: 'ai_website_basic',
        title: 'AI Website Basic',
        description: '5 pages - ₹25,000 + GST'
      },
      {
        id: 'ai_website_premium',
        title: 'AI Website Premium',
        description: '10 pages - ₹50,000 + GST'
      },
      {
        id: 'supa_agent_monthly',
        title: 'Supa Agent Monthly',
        description: 'Monthly subscription - ₹5,000'
      },
      {
        id: 'whatsapp_campaign',
        title: 'WhatsApp Campaign',
        description: '2 Lac messages - ₹70,800'
      }
    ]
  }]
};

const CONTACT_LIST = {
  buttonText: 'Contact Us',
  sections: [{
    title: 'Get in Touch',
    rows: [
      {
        id: 'book_call',
        title: '📞 Book a Call',
        description: 'Schedule a free consultation'
      },
      {
        id: 'send_email',
        title: '📧 Send Email',
        description: 'info@troikatech.in'
      },
      {
        id: 'visit_office',
        title: '🏢 Visit Office',
        description: 'Mira Road, Mumbai'
      },
      {
        id: 'whatsapp_chat',
        title: '💬 WhatsApp Chat',
        description: 'Continue this conversation'
      }
    ]
  }]
};

// Function to get button template by name
function getButtonTemplate(templateName) {
  const templates = {
    'services': SERVICE_BUTTONS,
    'pricing': PRICING_BUTTONS,
    'actions': ACTION_BUTTONS,
    'info': INFO_BUTTONS,
    'support': SUPPORT_BUTTONS,
    'yes_no': YES_NO_BUTTONS,
    'confirm': CONFIRM_BUTTONS
  };
  
  return templates[templateName] || [];
}

// Function to get list template by name
function getListTemplate(templateName) {
  const templates = {
    'services': SERVICE_LIST,
    'pricing': PRICING_LIST,
    'contact': CONTACT_LIST
  };
  
  return templates[templateName] || null;
}

// Function to create custom buttons
function createCustomButtons(buttonConfigs) {
  return buttonConfigs.map((config, index) => ({
    id: config.id || `custom_${index}`,
    title: config.title.length > 20 ? config.title.substring(0, 17) + '...' : config.title
  }));
}

// Function to create custom list
function createCustomList(buttonText, sections) {
  return {
    buttonText: buttonText.length > 20 ? buttonText.substring(0, 17) + '...' : buttonText,
    sections: sections.map(section => ({
      title: section.title,
      rows: section.rows.map(row => ({
        id: row.id,
        title: row.title.length > 24 ? row.title.substring(0, 21) + '...' : row.title,
        description: row.description ? (row.description.length > 72 ? row.description.substring(0, 69) + '...' : row.description) : undefined
      }))
    }))
  };
}

// Context-based button suggestions
function getContextualButtons(context, userMessage) {
  const message = userMessage.toLowerCase();
  
  // Service-related queries
  if (message.includes('service') || message.includes('offer') || message.includes('provide')) {
    return {
      type: 'buttons',
      template: 'services',
      message: '' // No extra message, buttons will appear directly
    };
  }
  
  // Pricing-related queries
  if (message.includes('price') || message.includes('cost') || message.includes('pricing')) {
    return {
      type: 'list',
      template: 'pricing',
      message: ''
    };
  }
  
  // Contact-related queries
  if (message.includes('contact') || message.includes('call') || message.includes('meet')) {
    return {
      type: 'list',
      template: 'contact',
      message: ''
    };
  }
  
  // Support-related queries
  if (message.includes('help') || message.includes('support') || message.includes('issue')) {
    return {
      type: 'buttons',
      template: 'support',
      message: ''
    };
  }
  
  // Confirmation queries
  if (message.includes('confirm') || message.includes('proceed') || message.includes('continue')) {
    return {
      type: 'buttons',
      template: 'confirm',
      message: ''
    };
  }
  
  // Default response
  return {
    type: 'buttons',
    template: 'actions',
    message: ''
  };
}

module.exports = {
  // Button templates
  SERVICE_BUTTONS,
  PRICING_BUTTONS,
  ACTION_BUTTONS,
  INFO_BUTTONS,
  SUPPORT_BUTTONS,
  YES_NO_BUTTONS,
  CONFIRM_BUTTONS,
  
  // List templates
  SERVICE_LIST,
  PRICING_LIST,
  CONTACT_LIST,
  
  // Helper functions
  getButtonTemplate,
  getListTemplate,
  createCustomButtons,
  createCustomList,
  getContextualButtons
};
