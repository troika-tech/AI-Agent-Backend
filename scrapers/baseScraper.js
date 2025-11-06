const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../utils/logger');

class BaseScraper {
  constructor(config = {}) {
    this.timeout = config.timeout || 30000;
    this.retries = config.retries || 3;
    this.retryDelay = config.retryDelay || 2000;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
  }

  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchHTML(url) {
    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        logger.info(`Fetching ${url} (attempt ${attempt}/${this.retries})`);

        const response = await axios.get(url, {
          timeout: this.timeout,
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });

        if (response.status === 200) {
          logger.info(`Successfully fetched ${url}`);
          return response.data;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        logger.error(`Error fetching ${url} (attempt ${attempt}/${this.retries}):`, error.message);

        if (attempt < this.retries) {
          await this.delay(this.retryDelay * attempt);
        } else {
          throw error;
        }
      }
    }
  }

  parseHTML(html) {
    return cheerio.load(html);
  }

  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

  extractText($, selector) {
    try {
      const element = $(selector);
      return this.cleanText(element.text());
    } catch (error) {
      logger.warn(`Error extracting text from selector ${selector}:`, error.message);
      return '';
    }
  }

  extractLinks($, selector) {
    try {
      const links = [];
      $(selector).each((i, el) => {
        const href = $(el).attr('href');
        if (href) {
          links.push(href);
        }
      });
      return links;
    } catch (error) {
      logger.warn(`Error extracting links from selector ${selector}:`, error.message);
      return [];
    }
  }

  async scrape(url) {
    throw new Error('scrape() method must be implemented by subclass');
  }
}

module.exports = BaseScraper;
