const MarketIntelligence = require('../models/MarketIntelligence');
const logger = require('../utils/logger');

class ObjectionHandlerService {
  constructor() {
    // Common objection patterns
    this.objectionPatterns = {
      'price_too_low': {
        keywords: ['too cheap', 'so cheap', 'low price', 'sounds suspicious', 'catch', 'quality compromise'],
        severity: 'high',
        objectionType: 'pricing',
        counterStrategy: 'proof_based'
      },
      'ai_quality_concern': {
        keywords: ['ai quality', 'generic', 'template', 'cookie cutter', 'can ai really', 'automated'],
        severity: 'high',
        objectionType: 'quality',
        counterStrategy: 'proof_based'
      },
      'support_concern': {
        keywords: ['what if', 'changes later', 'support', 'maintenance', 'after launch', 'help later'],
        severity: 'medium',
        objectionType: 'support',
        counterStrategy: 'reassurance'
      },
      'time_concern': {
        keywords: ['4 hours', 'too fast', 'rushed', 'quick', 'how can you'],
        severity: 'medium',
        objectionType: 'speed',
        counterStrategy: 'explanation'
      },
      'trust_concern': {
        keywords: ['scam', 'fake', 'trust', 'legit', 'real', 'proven', 'track record'],
        severity: 'high',
        objectionType: 'trust',
        counterStrategy: 'proof_based'
      },
      'comparison_doubt': {
        keywords: ['better than', 'vs', 'versus', 'why not', 'instead of', 'compare'],
        severity: 'medium',
        objectionType: 'competitive',
        counterStrategy: 'comparison'
      }
    };

    // Pre-loaded proof points (fetched from MarketIntelligence)
    this.proofCache = null;
  }

  /**
   * Detect if query contains an objection
   */
  detectObjection(query) {
    const lowerQuery = query.toLowerCase();
    const detected = [];

    for (const [objectionKey, pattern] of Object.entries(this.objectionPatterns)) {
      const hasKeyword = pattern.keywords.some(keyword => lowerQuery.includes(keyword));

      if (hasKeyword) {
        detected.push({
          type: objectionKey,
          severity: pattern.severity,
          objectionType: pattern.objectionType,
          counterStrategy: pattern.counterStrategy
        });
      }
    }

    if (detected.length > 0) {
      logger.info(`🚨 Objections: ${detected.map(d => d.type).join(', ')} (severity: ${detected.map(d => d.severity).join(', ')})`);
    }

    return detected;
  }

  /**
   * Get relevant objection handler intelligence from database
   */
  async getObjectionHandlers(objectionTypes) {
    try {
      if (!objectionTypes || objectionTypes.length === 0) return [];

      // Build search query for objection_handler documents
      const objectionHandlers = await MarketIntelligence.find({
        type: 'objection_handler',
        processingStatus: 'embedded'
      })
        .select('title summary keyTakeaways relevanceScore')
        .sort({ relevanceScore: -1 })
        .limit(5)
        .lean();

      logger.info(`📋 Retrieved ${objectionHandlers.length} objection handlers from database`);

      return objectionHandlers;
    } catch (error) {
      logger.error('Error fetching objection handlers:', error);
      return [];
    }
  }

  /**
   * Format objection handlers for prompt injection
   */
  formatObjectionContext(objections, handlers) {
    if (!handlers || handlers.length === 0) return '';

    let context = '\n# 🚨 OBJECTION DETECTED - HANDLE WITH PROOF\n\n';
    context += `**User raised concerns about:** ${objections.map(o => o.objectionType).join(', ')}\n`;
    context += `**Counter-strategy:** ${objections.map(o => o.counterStrategy).join(', ')}\n\n`;
    context += `**Available proof points to address objection:**\n`;

    handlers.forEach((handler, index) => {
      context += `\n**${index + 1}. ${handler.title}**\n`;
      context += `${handler.summary}\n`;
      if (handler.keyTakeaways && handler.keyTakeaways.length > 0) {
        context += `**Proof points:**\n`;
        handler.keyTakeaways.forEach(point => {
          context += `• ${point}\n`;
        });
      }
    });

    context += `\n🔴 CRITICAL: Use these proof points to address user's concern directly. Don't be defensive, be confident with data.\n`;
    context += `🔴 IMPORTANT: Acknowledge the concern first, then provide proof. Example: "I understand your concern about... Here's the reality:"\n\n`;

    return context;
  }

  /**
   * Check if objection was successfully addressed
   */
  isObjectionAddressed(response, objection) {
    const lowerResponse = response.toLowerCase();

    // Check if response contains proof keywords
    const proofKeywords = ['clients', 'rating', '4.8/5', 'review', 'example', 'proof', 'track record', '6000+', '13 years'];
    const hasProof = proofKeywords.some(keyword => lowerResponse.includes(keyword));

    // Check if response directly addresses objection type
    const objectionKeywords = {
      'pricing': ['₹', 'price', 'cost', 'value', 'savings'],
      'quality': ['quality', 'review', 'rating', 'approval'],
      'support': ['support', 'help', 'maintenance', 'team'],
      'speed': ['hour', 'fast', 'automated', 'ai'],
      'trust': ['years', 'clients', 'track record', 'proven'],
      'competitive': ['better', 'advantage', 'different', 'comparison']
    };

    const relevantKeywords = objectionKeywords[objection.objectionType] || [];
    const addressesObjection = relevantKeywords.some(keyword => lowerResponse.includes(keyword));

    return hasProof && addressesObjection;
  }
}

module.exports = ObjectionHandlerService;
