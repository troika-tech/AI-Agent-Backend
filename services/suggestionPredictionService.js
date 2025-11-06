const logger = require('../utils/logger');

class SuggestionPredictionService {
  constructor() {
    // Common question flow patterns (based on user behavior analysis)
    this.flowPatterns = {
      // When user asks about pricing
      'pricing_query': {
        userIntent: 'high', // High buying intent
        likelyNext: [
          "What's included in the ₹25K package?",
          "Do you offer EMI or payment plans?",
          "How does your pricing compare to other agencies?"
        ],
        detailRequests: [
          "Can you break down the pricing in detail?",
          "Tell me more about additional costs"
        ]
      },

      // When user asks "what services do you offer"
      'service_overview': {
        userIntent: 'medium',
        likelyNext: [
          "How does it help businesses in my industry?",
          "Can I see some examples of your work?",
          "What's the pricing for these services?"
        ],
        detailRequests: [
          "Tell me more about Supa Agent",
          "How do AI Websites work?"
        ]
      },

      // When user compares with competitors
      'competitor_comparison': {
        userIntent: 'high',
        likelyNext: [
          "What makes you different from Wix?",
          "Can I switch from my current provider?",
          "How long does migration take?"
        ],
        detailRequests: [
          "Show me a detailed comparison with Wix",
          "Tell me more about your advantages"
        ]
      },

      // When user raises objection (price, quality, etc.)
      'objection_raised': {
        userIntent: 'consideration',
        likelyNext: [
          "Do you have client testimonials or reviews?",
          "What's your refund or revision policy?",
          "Can I talk to your sales team?"
        ],
        detailRequests: [
          "Explain your quality assurance process",
          "Show me proof of your claims"
        ]
      },

      // When user asks about specific feature/service
      'feature_inquiry': {
        userIntent: 'medium',
        likelyNext: [
          "How much does this cost?",
          "How long does setup take?",
          "Does it work for my industry?"
        ],
        detailRequests: [
          "Explain how this feature works in detail",
          "Tell me more about the technical aspects"
        ]
      },

      // When user asks "how does it work"
      'process_inquiry': {
        userIntent: 'medium',
        likelyNext: [
          "What do I need to provide to get started?",
          "How long does the entire process take?",
          "What happens after launch?"
        ],
        detailRequests: [
          "Walk me through the entire workflow",
          "Explain each step in detail"
        ]
      },

      // When user shows urgency
      'urgent_need': {
        userIntent: 'very_high',
        likelyNext: [
          "Can you start today or this week?",
          "What's the fastest option available?",
          "Do you have any express or rush packages?"
        ],
        detailRequests: [
          "Explain how 4-hour delivery works",
          "What if I need changes after delivery?"
        ]
      },

      // When user asks about support/post-launch
      'support_inquiry': {
        userIntent: 'high',
        likelyNext: [
          "What's included in your maintenance plans?",
          "How do I make changes to my website later?",
          "Do you provide training?"
        ],
        detailRequests: [
          "Tell me more about your support process",
          "Explain the maintenance packages in detail"
        ]
      }
    };
  }

  /**
   * Classify query type based on keywords and intent
   */
  classifyQuery(query) {
    const lowerQuery = query.toLowerCase();

    // Pricing-related
    if (lowerQuery.match(/price|cost|fee|charge|expensive|cheap|budget|₹|rupee|payment|pay/)) {
      return 'pricing_query';
    }

    // Competitor comparison
    if (lowerQuery.match(/vs |versus|compare|better than|different from|instead of|wix|wordpress|competitor/)) {
      return 'competitor_comparison';
    }

    // Objections
    if (lowerQuery.match(/but |however |concern|worry|problem|issue|quality|trust|scam|fake|doubt/)) {
      return 'objection_raised';
    }

    // Process/workflow
    if (lowerQuery.match(/how does|how do|how to|process|workflow|steps|procedure|work\?/)) {
      return 'process_inquiry';
    }

    // Urgency signals
    if (lowerQuery.match(/urgent|asap|today|now|immediately|quickly|fast|soon|this week|emergency/)) {
      return 'urgent_need';
    }

    // Support/maintenance
    if (lowerQuery.match(/support|help|maintenance|update|change|modify|after|later|ongoing/)) {
      return 'support_inquiry';
    }

    // Feature-specific
    if (lowerQuery.match(/supa agent|chatbot|website|whatsapp|ai website|calling agent|video agent/)) {
      return 'feature_inquiry';
    }

    // Service overview (default for vague queries)
    if (lowerQuery.match(/what|services|offer|do you|can you|tell me about|troika/)) {
      return 'service_overview';
    }

    return 'general';
  }

  /**
   * Predict next questions based on current query and conversation history
   */
  predictSuggestions(currentQuery, intentCategory, session, industryContext) {
    const queryType = this.classifyQuery(currentQuery);
    const pattern = this.flowPatterns[queryType];

    if (!pattern) {
      // Fallback to generic suggestions
      return this.getGenericSuggestions(currentQuery, industryContext);
    }

    logger.info(`📊 Suggestion pattern: ${queryType} (intent: ${pattern.userIntent})`);

    // Get base suggestions from pattern
    let suggestions = [...pattern.likelyNext];

    // Add detail request if appropriate
    if (pattern.detailRequests && pattern.detailRequests.length > 0) {
      // 33% chance to include a detail request
      if (Math.random() > 0.66) {
        suggestions.push(pattern.detailRequests[Math.floor(Math.random() * pattern.detailRequests.length)]);
      }
    }

    // Personalize based on session history (avoid repetition)
    if (session?.interactions) {
      suggestions = this.filterRepetitiveTopics(suggestions, session.interactions);
    }

    // Personalize based on industry
    if (industryContext?.industry) {
      suggestions = this.personalizeForIndustry(suggestions, industryContext.industry);
    }

    // Mix: Ensure we have mix of detail requests + short questions
    suggestions = this.ensureMixedSuggestions(suggestions, pattern);

    // Return exactly 3 suggestions
    return suggestions.slice(0, 3);
  }

  /**
   * Filter out topics already discussed in session
   */
  filterRepetitiveTopics(suggestions, interactions) {
    const discussedTopics = new Set();

    interactions.forEach(interaction => {
      const query = interaction.query.toLowerCase();
      if (query.includes('price') || query.includes('cost')) discussedTopics.add('pricing');
      if (query.includes('example') || query.includes('sample')) discussedTopics.add('examples');
      if (query.includes('review') || query.includes('testimonial')) discussedTopics.add('reviews');
      if (query.includes('support') || query.includes('maintenance')) discussedTopics.add('support');
      if (query.includes('how') && query.includes('work')) discussedTopics.add('process');
      // Add more topic extractions...
    });

    // Filter out already-discussed topics
    return suggestions.filter(suggestion => {
      const lower = suggestion.toLowerCase();
      if (discussedTopics.has('pricing') && lower.includes('pric')) return false;
      if (discussedTopics.has('examples') && lower.includes('example')) return false;
      if (discussedTopics.has('reviews') && (lower.includes('review') || lower.includes('testimonial'))) return false;
      if (discussedTopics.has('support') && lower.includes('support')) return false;
      if (discussedTopics.has('process') && lower.includes('work')) return false;
      return true;
    });
  }

  /**
   * Personalize suggestions for detected industry
   */
  personalizeForIndustry(suggestions, industry) {
    return suggestions.map(suggestion => {
      // Replace generic "business" with industry
      return suggestion
        .replace(/businesses?/gi, industry.replace('_', ' '))
        .replace(/my industry/gi, industry.replace('_', ' '));
    });
  }

  /**
   * Ensure mix of 1-2 detail requests + 1-2 short questions
   */
  ensureMixedSuggestions(suggestions, pattern) {
    const detailRequests = suggestions.filter(s =>
      s.toLowerCase().includes('tell me more') ||
      s.toLowerCase().includes('explain') ||
      s.toLowerCase().includes('in detail') ||
      s.toLowerCase().includes('show me') ||
      s.toLowerCase().includes('walk me through')
    );

    const shortQuestions = suggestions.filter(s => !detailRequests.includes(s));

    // Aim for 1 detail request + 2 short questions
    const mixed = [];

    if (detailRequests.length > 0) {
      mixed.push(detailRequests[0]); // Add 1 detail request
    }

    // Fill rest with short questions
    shortQuestions.slice(0, 2).forEach(q => mixed.push(q));

    // If we don't have 3, add more from either pool
    while (mixed.length < 3 && (detailRequests.length > 0 || shortQuestions.length > 0)) {
      if (mixed.length === 2 && detailRequests.length > 1) {
        mixed.push(detailRequests[1]);
      } else if (shortQuestions.length > mixed.length - 1) {
        mixed.push(shortQuestions[mixed.length - 1]);
      } else {
        break;
      }
    }

    return mixed;
  }

  /**
   * Fallback generic suggestions
   */
  getGenericSuggestions(query, industryContext) {
    const generic = [
      "What's the pricing for your services?",
      "How long does setup take?",
      "Can I see examples of your work?"
    ];

    if (industryContext?.industry) {
      generic[1] = `How does it work for ${industryContext.industry.replace('_', ' ')} businesses?`;
    }

    return generic;
  }
}

module.exports = SuggestionPredictionService;
