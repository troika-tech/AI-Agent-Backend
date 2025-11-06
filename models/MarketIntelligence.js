const mongoose = require('mongoose');

const marketIntelligenceSchema = new mongoose.Schema({
  // Classification
  type: {
    type: String,
    enum: ['competitor', 'industry_news', 'tech_update', 'market_trend', 'troika_advantage', 'case_study', 'objection_handler', 'competitive_comparison'],
    required: true,
    index: true
  },
  category: [{
    type: String,
    index: true
  }],

  // Source Information
  source: {
    type: String,
    required: true
  },
  sourceUrl: {
    type: String,
    required: true
  },
  sourceType: {
    type: String,
    enum: ['website', 'news', 'social', 'blog', 'internal'],
    required: false // Made optional for Troika-specific intelligence
  },

  // Content
  title: {
    type: String,
    required: true
  },
  rawContent: {
    type: String,
    required: false // Made optional for summary-only documents
  },
  summary: {
    type: String
  },
  keyTakeaways: [{
    type: String
  }],

  // Relevance Mapping
  relevantServices: [{
    type: String,
    enum: ['Supa Agent', 'AI Websites', 'WhatsApp Marketing', 'Video Agent', 'Calling Agent', 'RCS Messaging', 'SuperScan']
  }],
  relevantIndustries: [{
    type: String,
    enum: ['Real Estate', 'Retail', 'Education', 'Healthcare', 'Pharma', 'Politics', 'E-commerce', 'Fashion', 'NGO', 'all', 'real estate', 'education', 'retail', 'healthcare', 'pharma', 'fintech', 'finance', 'manufacturing', 'fmcg']
  }],
  competitorMentioned: [{
    type: String
  }],

  // Embeddings for Semantic Search
  embedding: {
    type: [Number],
    select: false // Don't return by default due to size
  },

  // Metadata
  scrapedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  publishedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    index: true
  },

  // Quality Control
  processingStatus: {
    type: String,
    enum: ['scraped', 'summarized', 'embedded', 'ready'],
    default: 'scraped',
    index: true
  },
  relevanceScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
marketIntelligenceSchema.index({ type: 1, scrapedAt: -1 });
marketIntelligenceSchema.index({ relevantServices: 1, scrapedAt: -1 });
marketIntelligenceSchema.index({ relevantIndustries: 1, scrapedAt: -1 });
marketIntelligenceSchema.index({ processingStatus: 1 });

// TTL index for auto-cleanup (30 days)
marketIntelligenceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for age
marketIntelligenceSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.scrapedAt) / (1000 * 60 * 60 * 24));
});

// Method to check if data is fresh
marketIntelligenceSchema.methods.isFresh = function(daysThreshold = 7) {
  const daysSinceScraped = (Date.now() - this.scrapedAt) / (1000 * 60 * 60 * 24);
  return daysSinceScraped <= daysThreshold;
};

// Static method to find relevant intelligence
marketIntelligenceSchema.statics.findRelevant = async function(filters = {}) {
  const query = { processingStatus: 'ready' };

  if (filters.services && filters.services.length > 0) {
    query.relevantServices = { $in: filters.services };
  }

  if (filters.industries && filters.industries.length > 0) {
    query.relevantIndustries = { $in: filters.industries };
  }

  if (filters.type) {
    query.type = filters.type;
  }

  if (filters.minRelevanceScore) {
    query.relevanceScore = { $gte: filters.minRelevanceScore };
  }

  return this.find(query)
    .sort({ scrapedAt: -1 })
    .limit(filters.limit || 10);
};

const MarketIntelligence = mongoose.model('MarketIntelligence', marketIntelligenceSchema);

module.exports = MarketIntelligence;
