const IntelligentIntent = require('../models/IntelligentIntent');
const logger = require('../utils/logger');

class IntentDetectionService {
  constructor() {
    // Cache intents in memory for faster lookups
    this.intentCache = null;
    this.cacheExpiry = null;
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Detect intent and intelligence level from user query
   * @param {String} userQuery - User's query text
   * @returns {Object} - Detected intent with intelligence level
   */
  async detectIntent(userQuery) {
    try {
      if (!userQuery || userQuery.trim().length === 0) {
        return this._getDefaultIntent();
      }

      const normalizedQuery = userQuery.toLowerCase().trim();

      // Load intents (from cache or DB)
      const intents = await this._getIntents();

      // Try to find matching intent
      let matchedIntent = null;
      let matchScore = 0;

      for (const intent of intents) {
        if (!intent.isActive) continue;

        // Check if keyword appears in query
        if (normalizedQuery.includes(intent.intentKeyword)) {
          // Calculate match score (longer keyword = higher confidence)
          const score = intent.intentKeyword.length;

          if (score > matchScore) {
            matchScore = score;
            matchedIntent = intent;
          }
        }
      }

      // If matched, record the match and return
      if (matchedIntent) {
        // Record match asynchronously (don't wait)
        this._recordMatch(matchedIntent._id).catch(err =>
          logger.error('Failed to record intent match:', err)
        );

        logger.info(`Intent detected: ${matchedIntent.intentCategory} (${matchedIntent.intelligenceLevel})`);

        return {
          category: matchedIntent.intentCategory,
          intelligenceLevel: matchedIntent.intelligenceLevel,
          keyword: matchedIntent.intentKeyword,
          confidence: this._calculateConfidence(matchScore, normalizedQuery)
        };
      }

      // No match found - return default
      return this._getDefaultIntent();

    } catch (error) {
      logger.error('Error detecting intent:', error);
      return this._getDefaultIntent();
    }
  }

  /**
   * Get intelligence level for a specific category (fallback method)
   * @param {String} category - Intent category
   * @returns {String} - Intelligence level
   */
  getIntelligenceLevelForCategory(category) {
    const mapping = {
      'faq': 'NONE',
      'service_inquiry': 'SUBTLE',
      'competitive': 'EXPLICIT',
      'industry_specific': 'DATA_POINTS',
      'technology': 'RECENT_UPDATES'
    };

    return mapping[category] || 'SUBTLE';
  }

  /**
   * Analyze query for multiple intent signals
   * @param {String} userQuery - User's query
   * @returns {Object} - Multi-intent analysis
   */
  async analyzeQuery(userQuery) {
    try {
      const normalizedQuery = userQuery.toLowerCase().trim();
      const intents = await this._getIntents();

      const signals = [];
      const keywords = [];

      // Find all matching intents
      for (const intent of intents) {
        if (!intent.isActive) continue;

        if (normalizedQuery.includes(intent.intentKeyword)) {
          signals.push({
            category: intent.intentCategory,
            intelligenceLevel: intent.intelligenceLevel,
            keyword: intent.intentKeyword,
            weight: intent.intentKeyword.length
          });
          keywords.push(intent.intentKeyword);
        }
      }

      // Sort by weight (longer keywords first)
      signals.sort((a, b) => b.weight - a.weight);

      // Determine primary intent
      const primaryIntent = signals.length > 0
        ? signals[0]
        : this._getDefaultIntent();

      // Determine overall intelligence level (highest level wins)
      const intelligenceLevels = ['NONE', 'SUBTLE', 'DATA_POINTS', 'EXPLICIT', 'RECENT_UPDATES'];
      let highestLevel = 'SUBTLE';

      for (const signal of signals) {
        const currentIndex = intelligenceLevels.indexOf(signal.intelligenceLevel);
        const highestIndex = intelligenceLevels.indexOf(highestLevel);
        if (currentIndex > highestIndex) {
          highestLevel = signal.intelligenceLevel;
        }
      }

      return {
        primary: primaryIntent,
        allSignals: signals,
        keywords: keywords,
        intelligenceLevel: highestLevel,
        hasMultipleIntents: signals.length > 1
      };

    } catch (error) {
      logger.error('Error analyzing query:', error);
      return {
        primary: this._getDefaultIntent(),
        allSignals: [],
        keywords: [],
        intelligenceLevel: 'SUBTLE',
        hasMultipleIntents: false
      };
    }
  }

  /**
   * Check if query is a follow-up (short, contextual)
   * Supports multilingual responses including romanized Indian languages
   * @param {String} query - User's query
   * @returns {Boolean} - Is follow-up
   */
  isFollowUp(query) {
    const normalized = query.toLowerCase().trim();

    // English follow-up patterns
    const englishPatterns = [
      'yes', 'yeah', 'yep', 'no', 'nope', 'ok', 'okay', 'sure', 'thanks', 'thank you',
      'why', 'how', 'when', 'where', 'what', 'who',
      'tell me more', 'more details', 'explain', 'elaborate',
      'sounds good', 'i see', 'got it', 'understood',
      'go ahead', 'proceed', 'continue', 'k', 'alright'
    ];

    // Hindi patterns (romanized and Devanagari)
    const hindiPatterns = [
      'haan', 'ha', 'haa', 'han', 'हां', 'हाँ', 'जी', 'ji',
      'nahi', 'nhi', 'nahin', 'नहीं', 'ना', 'na',
      'bilkul', 'बिल्कुल', 'theek hai', 'thik hai', 'ठीक है',
      'accha', 'achha', 'अच्छा', 'sahi', 'सही',
      'kaise', 'kyu', 'kyun', 'कैसे', 'क्यों', 'kya', 'क्या',
      'batao', 'bataiye', 'बताओ', 'बताइए', 'aur', 'और',
      'samjha', 'समझा', 'thik', 'ठीक'
    ];

    // Marathi patterns (romanized and Devanagari)
    const marathiPatterns = [
      'ho', 'hoy', 'होय', 'होऊ दे', 'hou de',
      'nahi', 'नाही', 'nakko', 'नक्को', 'nako', 'नको',
      'barobar', 'बरोबर', 'thik', 'thike', 'ठीक',
      'kase', 'कसे', 'kay', 'का', 'काय', 'kaay',
      'sang', 'sangaa', 'सांग', 'सांगा', 'ata', 'आता',
      'nakkichi', 'nakki', 'नक्की', 'samajla', 'समजलं'
    ];

    // Tamil patterns (romanized and Tamil script)
    const tamilPatterns = [
      'aam', 'aamam', 'ஆம்', 'illa', 'illai', 'இல்லை',
      'sari', 'சரி', 'okay', 'nalla', 'நல்லா',
      'eppadi', 'எப்படி', 'yean', 'yen', 'ஏன்',
      'enna', 'என்ன', 'sollunga', 'சொல்லுங்க',
      'puriyudhu', 'புரியுது', 'poitu', 'போயிட்டு'
    ];

    // Telugu patterns (romanized and Telugu script)
    const teluguPatterns = [
      'avunu', 'అవును', 'avnu', 'kadhu', 'kadu', 'కాదు',
      'ledhu', 'ledu', 'లేదు', 'sare', 'సరే',
      'ela', 'ఎలా', 'enduku', 'ఎందుకు', 'enti', 'ఏంటి',
      'cheppandi', 'చెప్పండి', 'baagundi', 'బాగుంది',
      'ardhamaindi', 'అర్ధమైంది'
    ];

    // Kannada patterns (romanized and Kannada script)
    const kannadaPatterns = [
      'howdu', 'haudu', 'ಹೌದು', 'illa', 'ಇಲ್ಲ',
      'sari', 'ಸರಿ', 'hegide', 'ಹೇಗಿದೆ',
      'yake', 'ಯಾಕೆ', 'enu', 'ಏನು', 'heli', 'ಹೇಳಿ',
      'gottu', 'ಗೊತ್ತು', 'chennagide', 'ಚೆನ್ನಾಗಿದೆ'
    ];

    // Bengali patterns (romanized and Bengali script)
    const bengaliPatterns = [
      'hyan', 'হ্যাঁ', 'ha', 'na', 'না', 'naa', 'nai', 'নাই',
      'thik', 'ठिक', 'ঠিক', 'thik ache', 'ঠিক আছে',
      'bhalo', 'ভালো', 'accha', 'अच्छा',
      'kivabe', 'কিভাবে', 'keno', 'কেন', 'ki', 'কি',
      'bolo', 'বলো', 'bujhechi', 'বুঝেছি'
    ];

    // Gujarati patterns (romanized and Gujarati script)
    const gujaratiPatterns = [
      'ha', 'haa', 'હા', 'nahi', 'નહિ', 'na', 'ના',
      'kharu', 'ખરું', 'thik', 'ठीક', 'ठીક',
      'barabar', 'બરાબર', 'kem', 'કેમ', 'shu', 'શું',
      'kaho', 'કહો', 'samajay gayo', 'સમજાય ગયો'
    ];

    // Punjabi patterns (romanized and Gurmukhi)
    const punjabiPatterns = [
      'haan', 'ਹਾਂ', 'ji', 'ਜੀ', 'nahi', 'ਨਹੀਂ',
      'na', 'ਨਾ', 'theek', 'ठीक', 'ਠੀਕ',
      'bilkul', 'ਬਿਲਕੁਲ', 'kivein', 'ਕਿਵੇਂ',
      'ki', 'ਕੀ', 'dass', 'ਦੱਸ', 'samajh gaya', 'ਸਮਝ ਗਿਆ'
    ];

    // Combine all patterns
    const allPatterns = [
      ...englishPatterns,
      ...hindiPatterns,
      ...marathiPatterns,
      ...tamilPatterns,
      ...teluguPatterns,
      ...kannadaPatterns,
      ...bengaliPatterns,
      ...gujaratiPatterns,
      ...punjabiPatterns
    ];

    // Short queries are likely follow-ups (increased threshold for multilingual support)
    if (query.length < 30) {
      for (const pattern of allPatterns) {
        if (normalized === pattern || normalized.startsWith(pattern + ' ')) {
          logger.info(`Follow-up detected: "${query}" matched pattern: "${pattern}"`);
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get intents (from cache or DB)
   * @private
   * @returns {Array} - List of intents
   */
  async _getIntents() {
    const now = Date.now();

    // Return cache if valid
    if (this.intentCache && this.cacheExpiry && now < this.cacheExpiry) {
      return this.intentCache;
    }

    // Fetch from DB
    const intents = await IntelligentIntent.find({ isActive: true })
      .sort({ intentKeyword: -1 }) // Longer keywords first
      .lean();

    // Update cache
    this.intentCache = intents;
    this.cacheExpiry = now + this.cacheDuration;

    return intents;
  }

  /**
   * Record intent match
   * @private
   * @param {String} intentId - Intent ID
   */
  async _recordMatch(intentId) {
    try {
      await IntelligentIntent.findByIdAndUpdate(intentId, {
        $inc: { matchCount: 1 },
        $set: { lastMatchedAt: new Date() }
      });
    } catch (error) {
      logger.error('Error recording intent match:', error);
    }
  }

  /**
   * Calculate confidence score
   * @private
   * @param {Number} matchScore - Match score (keyword length)
   * @param {String} normalizedQuery - Normalized query
   * @returns {Number} - Confidence (0-1)
   */
  _calculateConfidence(matchScore, normalizedQuery) {
    // Confidence based on keyword length relative to query length
    const ratio = matchScore / normalizedQuery.length;
    return Math.min(ratio * 2, 1); // Cap at 1.0
  }

  /**
   * Get default intent (for queries with no specific match)
   * @private
   * @returns {Object} - Default intent
   */
  _getDefaultIntent() {
    return {
      category: 'service_inquiry',
      intelligenceLevel: 'SUBTLE',
      keyword: null,
      confidence: 0
    };
  }

  /**
   * Clear intent cache (useful for testing or after updating intents)
   */
  clearCache() {
    this.intentCache = null;
    this.cacheExpiry = null;
  }

  /**
   * Get intent statistics
   * @returns {Object} - Intent stats
   */
  async getIntentStats() {
    try {
      const total = await IntelligentIntent.countDocuments();
      const active = await IntelligentIntent.countDocuments({ isActive: true });

      const byCategory = await IntelligentIntent.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$intentCategory', count: { $sum: 1 } } }
      ]);

      const byLevel = await IntelligentIntent.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$intelligenceLevel', count: { $sum: 1 } } }
      ]);

      const topMatched = await IntelligentIntent.find({ isActive: true })
        .sort({ matchCount: -1 })
        .limit(10)
        .select('intentKeyword intentCategory matchCount lastMatchedAt');

      return {
        total,
        active,
        byCategory: byCategory.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byLevel: byLevel.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        topMatched
      };
    } catch (error) {
      logger.error('Error getting intent stats:', error);
      throw error;
    }
  }
}

module.exports = IntentDetectionService;
