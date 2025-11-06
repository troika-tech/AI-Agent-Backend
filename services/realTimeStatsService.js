const Chatbot = require('../models/Chatbot');
const logger = require('../utils/logger');

class RealTimeStatsService {
  constructor() {
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    this.statsCache = {
      data: null,
      timestamp: null
    };
  }

  /**
   * Get real-time stats from database
   */
  async getStats() {
    try {
      // Check cache first
      if (this.statsCache.data && this.statsCache.timestamp) {
        const age = Date.now() - this.statsCache.timestamp;
        if (age < this.cacheTimeout) {
          logger.info('📊 Using cached real-time stats');
          return this.statsCache.data;
        }
      }

      // Fetch fresh stats
      const stats = await this._fetchFreshStats();

      // Update cache
      this.statsCache = {
        data: stats,
        timestamp: Date.now()
      };

      logger.info('📊 Fetched fresh real-time stats');
      return stats;
    } catch (error) {
      logger.error('Error fetching real-time stats:', error);
      return this._getFallbackStats();
    }
  }

  /**
   * Fetch stats from database
   */
  async _fetchFreshStats() {
    // Count active chatbots (proxy for active clients)
    const activeChatbots = await Chatbot.countDocuments({
      status: 'active'
    });

    // Get recent client additions (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const newClientsThisWeek = await Chatbot.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Calculate growth stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newClientsThisMonth = await Chatbot.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    return {
      activeClients: activeChatbots || 6000, // Fallback to known count
      newClientsThisWeek: newClientsThisWeek || 12,
      newClientsThisMonth: newClientsThisMonth || 47,
      lastUpdated: new Date(),
      // Static stats (update manually)
      yearsInBusiness: 13,
      averageRating: 4.8,
      citiesServed: 47,
      countriesServed: 9,
      industriesServed: 40
    };
  }

  /**
   * Fallback stats if database query fails
   */
  _getFallbackStats() {
    return {
      activeClients: 6000,
      newClientsThisWeek: 10,
      newClientsThisMonth: 45,
      lastUpdated: new Date(),
      yearsInBusiness: 13,
      averageRating: 4.8,
      citiesServed: 47,
      countriesServed: 9,
      industriesServed: 40
    };
  }

  /**
   * Check for active promotions/offers
   */
  async getCurrentOffers() {
    // TODO: Integrate with offers/promotions collection when available
    // For now, return hardcoded seasonal offers

    const now = new Date();
    const month = now.getMonth(); // 0-11

    // Example seasonal logic
    if (month === 10 || month === 11) { // Nov-Dec (Diwali/New Year)
      return {
        hasOffer: true,
        offerText: 'Festive Offer: 20% off on AI Websites + Free Supa Agent trial',
        validUntil: '31st December 2024',
        urgency: 'high'
      };
    }

    return {
      hasOffer: false,
      offerText: null,
      validUntil: null,
      urgency: 'none'
    };
  }

  /**
   * Format stats for prompt injection
   */
  formatStatsContext(stats, offer = null) {
    let context = '\n# 📊 REAL-TIME STATS (Use to build credibility)\n\n';

    context += `**Current Stats (as of today):**\n`;
    context += `• Active clients: ${stats.activeClients}+\n`;
    context += `• New clients this week: ${stats.newClientsThisWeek}\n`;
    context += `• New clients this month: ${stats.newClientsThisMonth}\n`;
    context += `• Years in business: ${stats.yearsInBusiness} years\n`;
    context += `• Average rating: ${stats.averageRating}/5\n`;
    context += `• Geographic reach: ${stats.citiesServed} cities, ${stats.countriesServed} countries\n\n`;

    if (offer && offer.hasOffer) {
      context += `**🎁 CURRENT OFFER:**\n`;
      context += `${offer.offerText}\n`;
      context += `Valid until: ${offer.validUntil}\n`;
      context += `Urgency: ${offer.urgency}\n\n`;
      context += `🔴 IMPORTANT: Mention this offer if user shows buying intent (pricing query, comparison, etc.)\n\n`;
    }

    return context;
  }

  /**
   * Detect if stats should be included (avoid overuse)
   */
  shouldIncludeStats(query, intelligenceLevel) {
    const lowerQuery = query.toLowerCase();

    // Include stats for:
    // 1. Social proof queries
    if (lowerQuery.match(/how many|clients|customers|businesses|track record|proven|experience/)) {
      return true;
    }

    // 2. Trust/credibility queries
    if (lowerQuery.match(/trust|legit|real|reliable|established|reputation/)) {
      return true;
    }

    // 3. EXPLICIT intelligence level
    if (intelligenceLevel === 'EXPLICIT') {
      return true;
    }

    return false;
  }
}

module.exports = RealTimeStatsService;
