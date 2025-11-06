const NewsScraper = require('./newsScraper');
const CompetitorScraper = require('./competitorScraper');
const logger = require('../utils/logger');

class ScrapingOrchestrator {
  constructor() {
    this.newsScraper = new NewsScraper();
    this.competitorScraper = new CompetitorScraper();
  }

  async runNewsScraping() {
    try {
      logger.info('=== Starting News Scraping Job ===');
      const startTime = Date.now();

      const result = await this.newsScraper.scrapeAll();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`=== News Scraping Completed in ${duration}s ===`);
      logger.info(`Scraped ${result.total} articles from ${result.sources.length} sources`);

      return result;
    } catch (error) {
      logger.error('News scraping job failed:', error);
      throw error;
    }
  }

  async runCompetitorScraping() {
    try {
      logger.info('=== Starting Competitor Scraping Job ===');
      const startTime = Date.now();

      const result = await this.competitorScraper.scrapeAll();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`=== Competitor Scraping Completed in ${duration}s ===`);
      logger.info(`Scraped ${result.total} pages from ${result.competitors.length} competitors`);

      return result;
    } catch (error) {
      logger.error('Competitor scraping job failed:', error);
      throw error;
    }
  }

  async runAll() {
    logger.info('=== Starting Full Scraping Job ===');
    const results = {
      news: null,
      competitors: null,
      errors: []
    };

    try {
      results.news = await this.runNewsScraping();
    } catch (error) {
      results.errors.push({ type: 'news', error: error.message });
    }

    try {
      results.competitors = await this.runCompetitorScraping();
    } catch (error) {
      results.errors.push({ type: 'competitors', error: error.message });
    }

    logger.info('=== Full Scraping Job Completed ===');
    return results;
  }
}

module.exports = ScrapingOrchestrator;
