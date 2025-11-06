const BaseScraper = require('./baseScraper');
const MarketIntelligence = require('../models/MarketIntelligence');
const logger = require('../utils/logger');

class NewsScraper extends BaseScraper {
  constructor() {
    super();
    this.sources = [
      {
        name: 'TechCrunch',
        url: 'https://techcrunch.com/category/artificial-intelligence/',
        type: 'industry_news',
        articleSelector: '.post-block',
        titleSelector: '.post-block__title__link',
        linkSelector: '.post-block__title__link',
        excerptSelector: '.post-block__content',
        maxArticles: 15
      },
      {
        name: 'YourStory',
        url: 'https://yourstory.com/artificial-intelligence',
        type: 'industry_news',
        articleSelector: '.article-card',
        titleSelector: '.article-title',
        linkSelector: 'a',
        excerptSelector: '.article-excerpt',
        maxArticles: 15
      }
      // Add more sources as needed
    ];
  }

  async scrapeSource(source) {
    const scrapedArticles = [];

    try {
      const html = await this.fetchHTML(source.url);
      const $ = this.parseHTML(html);

      const articles = $(source.articleSelector).slice(0, source.maxArticles);

      for (let i = 0; i < articles.length; i++) {
        const article = articles.eq(i);

        try {
          const title = this.cleanText(article.find(source.titleSelector).text());
          let link = article.find(source.linkSelector).attr('href');

          // Handle relative URLs
          if (link && !link.startsWith('http')) {
            const baseUrl = new URL(source.url);
            link = `${baseUrl.protocol}//${baseUrl.host}${link}`;
          }

          const excerpt = this.cleanText(article.find(source.excerptSelector).text());

          if (title && link) {
            // Check if article already exists
            const existing = await MarketIntelligence.findOne({
              sourceUrl: link
            });

            if (!existing) {
              scrapedArticles.push({
                type: source.type,
                category: ['AI', 'technology', 'news'],
                source: source.name,
                sourceUrl: link,
                sourceType: 'news',
                title,
                rawContent: excerpt || title,
                scrapedAt: new Date(),
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                processingStatus: 'scraped'
              });

              logger.info(`Scraped: ${title} from ${source.name}`);
            } else {
            }
          }
        } catch (error) {
          logger.error(`Error parsing article ${i} from ${source.name}:`, error.message);
        }
      }

      // Delay between sources to be polite
      await this.delay(2000);
    } catch (error) {
      logger.error(`Error scraping ${source.name}:`, error.message);
    }

    return scrapedArticles;
  }

  async scrapeAll() {
    logger.info('Starting news scraping...');
    const allArticles = [];

    for (const source of this.sources) {
      try {
        const articles = await this.scrapeSource(source);
        allArticles.push(...articles);
      } catch (error) {
        logger.error(`Failed to scrape ${source.name}:`, error.message);
      }
    }

    // Bulk insert new articles
    if (allArticles.length > 0) {
      try {
        await MarketIntelligence.insertMany(allArticles, { ordered: false });
        logger.info(`✓ Successfully scraped ${allArticles.length} news articles`);
      } catch (error) {
        // Handle duplicate key errors gracefully
        if (error.code === 11000) {
          logger.warn('Some articles were duplicates and skipped');
        } else {
          throw error;
        }
      }
    } else {
      logger.info('No new articles to scrape');
    }

    return {
      total: allArticles.length,
      sources: this.sources.map(s => s.name)
    };
  }
}

module.exports = NewsScraper;
