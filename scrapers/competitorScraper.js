const BaseScraper = require('./baseScraper');
const MarketIntelligence = require('../models/MarketIntelligence');
const logger = require('../utils/logger');

class CompetitorScraper extends BaseScraper {
  constructor() {
    super();
    this.competitors = [
      {
        name: 'Yellow.ai',
        urls: [
          { url: 'https://yellow.ai', type: 'homepage' },
          { url: 'https://yellow.ai/pricing', type: 'pricing' }
        ]
      },
      {
        name: 'Wix',
        urls: [
          { url: 'https://www.wix.com/ai-website-builder', type: 'homepage' }
        ]
      }
      // Add more competitors as needed
    ];
  }

  async scrapePage(competitor, pageConfig) {
    try {
      const html = await this.fetchHTML(pageConfig.url);
      const $ = this.parseHTML(html);

      // Extract main content (this is simplified, you'd want more sophisticated extraction)
      const title = $('title').text() || $('h1').first().text();
      const mainContent = $('main').text() || $('body').text();
      const cleanedContent = this.cleanText(mainContent).substring(0, 5000); // Limit content size

      // Check if already scraped today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existing = await MarketIntelligence.findOne({
        source: competitor.name,
        sourceUrl: pageConfig.url,
        scrapedAt: { $gte: today }
      });

      if (existing) {
        return null;
      }

      const data = {
        type: 'competitor',
        category: ['competitor', pageConfig.type],
        source: competitor.name,
        sourceUrl: pageConfig.url,
        sourceType: 'website',
        title: this.cleanText(title),
        rawContent: cleanedContent,
        competitorMentioned: [competitor.name],
        scrapedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days for competitor data
        processingStatus: 'scraped'
      };

      logger.info(`Scraped: ${competitor.name} - ${pageConfig.type}`);
      return data;
    } catch (error) {
      logger.error(`Error scraping ${competitor.name} ${pageConfig.url}:`, error.message);
      return null;
    }
  }

  async scrapeCompetitor(competitor) {
    const scrapedPages = [];

    for (const pageConfig of competitor.urls) {
      try {
        const data = await this.scrapePage(competitor, pageConfig);
        if (data) {
          scrapedPages.push(data);
        }

        // Delay between pages of same competitor
        await this.delay(3000);
      } catch (error) {
        logger.error(`Error scraping page for ${competitor.name}:`, error.message);
      }
    }

    return scrapedPages;
  }

  async scrapeAll() {
    logger.info('Starting competitor scraping...');
    const allPages = [];

    for (const competitor of this.competitors) {
      try {
        const pages = await this.scrapeCompetitor(competitor);
        allPages.push(...pages);

        // Delay between different competitors
        await this.delay(5000);
      } catch (error) {
        logger.error(`Failed to scrape ${competitor.name}:`, error.message);
      }
    }

    // Bulk insert new pages
    if (allPages.length > 0) {
      try {
        await MarketIntelligence.insertMany(allPages, { ordered: false });
        logger.info(`✓ Successfully scraped ${allPages.length} competitor pages`);
      } catch (error) {
        if (error.code === 11000) {
          logger.warn('Some competitor pages were duplicates and skipped');
        } else {
          throw error;
        }
      }
    } else {
      logger.info('No new competitor pages to scrape');
    }

    return {
      total: allPages.length,
      competitors: this.competitors.map(c => c.name)
    };
  }
}

module.exports = CompetitorScraper;
