const mongoose = require('mongoose');

const intelligentIntentSchema = new mongoose.Schema({
  intentKeyword: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    unique: true
  },
  intentCategory: {
    type: String,
    enum: ['faq', 'service_inquiry', 'competitive', 'industry_specific', 'technology'],
    required: true,
    index: true
  },
  intelligenceLevel: {
    type: String,
    enum: ['NONE', 'SUBTLE', 'DATA_POINTS', 'EXPLICIT', 'RECENT_UPDATES'],
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  description: {
    type: String
  },
  matchCount: {
    type: Number,
    default: 0
  },
  lastMatchedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes
intelligentIntentSchema.index({ intentCategory: 1, isActive: 1 });
intelligentIntentSchema.index({ intelligenceLevel: 1, isActive: 1 });

// Method to increment match count
intelligentIntentSchema.methods.recordMatch = async function() {
  this.matchCount += 1;
  this.lastMatchedAt = new Date();
  await this.save();
};

// Static method to find matching intent
intelligentIntentSchema.statics.findMatchingIntent = async function(userQuery) {
  const normalizedQuery = userQuery.toLowerCase().trim();

  // Find active intents
  const intents = await this.find({ isActive: true });

  // Simple keyword matching (can be enhanced with fuzzy matching)
  for (const intent of intents) {
    if (normalizedQuery.includes(intent.intentKeyword)) {
      return intent;
    }
  }

  return null;
};

// Static method to seed initial intents
intelligentIntentSchema.statics.seedIntents = async function() {
  const intents = [
    // FAQ Intents (Intelligence Level: NONE)
    { intentKeyword: 'phone number', intentCategory: 'faq', intelligenceLevel: 'NONE', description: 'User asking for phone number' },
    { intentKeyword: 'contact', intentCategory: 'faq', intelligenceLevel: 'NONE', description: 'User asking for contact info' },
    { intentKeyword: 'email', intentCategory: 'faq', intelligenceLevel: 'NONE', description: 'User asking for email' },
    { intentKeyword: 'address', intentCategory: 'faq', intelligenceLevel: 'NONE', description: 'User asking for address' },
    { intentKeyword: 'hours', intentCategory: 'faq', intelligenceLevel: 'NONE', description: 'User asking for business hours' },

    // Service Inquiry Intents (Intelligence Level: SUBTLE)
    { intentKeyword: 'how can you help', intentCategory: 'service_inquiry', intelligenceLevel: 'SUBTLE', description: 'General service inquiry' },
    { intentKeyword: 'what services', intentCategory: 'service_inquiry', intelligenceLevel: 'SUBTLE', description: 'Asking about services' },
    { intentKeyword: 'tell me about your company', intentCategory: 'service_inquiry', intelligenceLevel: 'SUBTLE', description: 'Company overview request' },
    { intentKeyword: 'why should i choose you', intentCategory: 'service_inquiry', intelligenceLevel: 'SUBTLE', description: 'Asking for differentiators' },
    { intentKeyword: 'what do you do', intentCategory: 'service_inquiry', intelligenceLevel: 'SUBTLE', description: 'General inquiry' },
    { intentKeyword: 'your solutions', intentCategory: 'service_inquiry', intelligenceLevel: 'SUBTLE', description: 'Solutions inquiry' },

    // Competitive Intents (Intelligence Level: EXPLICIT)
    { intentKeyword: 'compare with', intentCategory: 'competitive', intelligenceLevel: 'EXPLICIT', description: 'Direct comparison request' },
    { intentKeyword: 'why you over', intentCategory: 'competitive', intelligenceLevel: 'EXPLICIT', description: 'Competitive advantage inquiry' },
    { intentKeyword: 'difference between', intentCategory: 'competitive', intelligenceLevel: 'EXPLICIT', description: 'Difference inquiry' },
    { intentKeyword: 'better than', intentCategory: 'competitive', intelligenceLevel: 'EXPLICIT', description: 'Superiority inquiry' },
    { intentKeyword: 'vs ', intentCategory: 'competitive', intelligenceLevel: 'EXPLICIT', description: 'Versus comparison' },
    { intentKeyword: 'yellow.ai', intentCategory: 'competitive', intelligenceLevel: 'EXPLICIT', description: 'Yellow.ai mention' },
    { intentKeyword: 'wix', intentCategory: 'competitive', intelligenceLevel: 'EXPLICIT', description: 'Wix mention' },

    // Industry-Specific Intents (Intelligence Level: DATA_POINTS)
    { intentKeyword: 'real estate', intentCategory: 'industry_specific', intelligenceLevel: 'DATA_POINTS', description: 'Real estate inquiry' },
    { intentKeyword: 'education', intentCategory: 'industry_specific', intelligenceLevel: 'DATA_POINTS', description: 'Education sector inquiry' },
    { intentKeyword: 'retail', intentCategory: 'industry_specific', intelligenceLevel: 'DATA_POINTS', description: 'Retail inquiry' },
    { intentKeyword: 'e-commerce', intentCategory: 'industry_specific', intelligenceLevel: 'DATA_POINTS', description: 'E-commerce inquiry' },
    { intentKeyword: 'healthcare', intentCategory: 'industry_specific', intelligenceLevel: 'DATA_POINTS', description: 'Healthcare inquiry' },
    { intentKeyword: 'political campaign', intentCategory: 'industry_specific', intelligenceLevel: 'DATA_POINTS', description: 'Political campaign inquiry' },

    // Technology Intents (Intelligence Level: RECENT_UPDATES)
    { intentKeyword: 'latest ai trends', intentCategory: 'technology', intelligenceLevel: 'RECENT_UPDATES', description: 'AI trends inquiry' },
    { intentKeyword: 'what\'s new', intentCategory: 'technology', intelligenceLevel: 'RECENT_UPDATES', description: 'New developments inquiry' },
    { intentKeyword: 'industry updates', intentCategory: 'technology', intelligenceLevel: 'RECENT_UPDATES', description: 'Industry updates inquiry' },
    { intentKeyword: 'recent developments', intentCategory: 'technology', intelligenceLevel: 'RECENT_UPDATES', description: 'Recent tech developments' }
  ];

  for (const intent of intents) {
    await this.findOneAndUpdate(
      { intentKeyword: intent.intentKeyword },
      intent,
      { upsert: true, new: true }
    );
  }

  console.log(`Seeded ${intents.length} intelligent intents`);
};

const IntelligentIntent = mongoose.model('IntelligentIntent', intelligentIntentSchema);

module.exports = IntelligentIntent;
