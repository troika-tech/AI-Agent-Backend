const cron = require('node-cron');
const ScrapingOrchestrator = require('../scrapers/scrapingOrchestrator');
const LLMProcessor = require('./llmProcessor');
const logger = require('../utils/logger');

class SchedulerService {
  constructor() {
    this.scrapingOrchestrator = new ScrapingOrchestrator();
    this.llmProcessor = new LLMProcessor();
    this.jobs = [];
  }

  // News scraping: Every 3 days at 4:00 AM IST
  startNewsScrapingJob() {
    // Cron format: minute hour day month weekday
    // "0 4 */3 * *" = At 4:00 AM every 3 days
    const job = cron.schedule('0 4 */3 * *', async () => {
      try {
        logger.info('⏰ Triggered: News scraping job (every 3 days)');
        await this.scrapingOrchestrator.runNewsScraping();

        // Process scraped content with LLM
        logger.info('Starting LLM processing for scraped news...');
        await this.llmProcessor.processBatch(50);

        logger.info('✓ News scraping and processing completed');
      } catch (error) {
        logger.error('❌ News scraping job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    this.jobs.push({ name: 'news-scraping', schedule: 'every 3 days at 4:00 AM IST', job });
    logger.info('✓ News scraping job scheduled: Every 3 days at 4:00 AM IST');

    return job;
  }

  // Competitor scraping: Every Monday at 4:00 AM IST
  startCompetitorScrapingJob() {
    // Cron format: "0 4 * * 1" = At 4:00 AM every Monday
    const job = cron.schedule('0 4 * * 1', async () => {
      try {
        logger.info('⏰ Triggered: Competitor scraping job (weekly)');
        await this.scrapingOrchestrator.runCompetitorScraping();

        // Process scraped content with LLM
        logger.info('Starting LLM processing for scraped competitor data...');
        await this.llmProcessor.processBatch(50);

        logger.info('✓ Competitor scraping and processing completed');
      } catch (error) {
        logger.error('❌ Competitor scraping job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    this.jobs.push({ name: 'competitor-scraping', schedule: 'every Monday at 4:00 AM IST', job });
    logger.info('✓ Competitor scraping job scheduled: Every Monday at 4:00 AM IST');

    return job;
  }

  // LLM processing: Every 6 hours (to process any remaining unprocessed items)
  startLLMProcessingJob() {
    // Cron format: "0 */6 * * *" = Every 6 hours
    const job = cron.schedule('0 */6 * * *', async () => {
      try {
        logger.info('⏰ Triggered: LLM processing job (every 6 hours)');
        const result = await this.llmProcessor.processBatch(20);

        if (result.processed > 0) {
          logger.info(`✓ LLM processing completed: ${result.processed} items processed`);
        } else {
        }
      } catch (error) {
        logger.error('❌ LLM processing job failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    this.jobs.push({ name: 'llm-processing', schedule: 'every 6 hours', job });
    logger.info('✓ LLM processing job scheduled: Every 6 hours');

    return job;
  }

  // Start all scheduled jobs
  startAll() {
    logger.info('🚀 Starting all scheduled jobs...');

    this.startNewsScrapingJob();
    this.startCompetitorScrapingJob();
    this.startLLMProcessingJob();

    logger.info(`✓ All ${this.jobs.length} scheduled jobs started successfully`);
    this.logSchedule();
  }

  // Stop all jobs
  stopAll() {
    logger.info('Stopping all scheduled jobs...');

    this.jobs.forEach(({ name, job }) => {
      job.stop();
      logger.info(`✓ Stopped job: ${name}`);
    });

    this.jobs = [];
    logger.info('All jobs stopped');
  }

  // Log current schedule
  logSchedule() {
    logger.info('📅 Current Schedule:');
    this.jobs.forEach(({ name, schedule }) => {
      logger.info(`  - ${name}: ${schedule}`);
    });
  }

  // Manual trigger methods for testing
  async manualNewsRun() {
    logger.info('🔧 Manual trigger: News scraping');
    await this.scrapingOrchestrator.runNewsScraping();
    await this.llmProcessor.processBatch(50);
    logger.info('✓ Manual news scraping completed');
  }

  async manualCompetitorRun() {
    logger.info('🔧 Manual trigger: Competitor scraping');
    await this.scrapingOrchestrator.runCompetitorScraping();
    await this.llmProcessor.processBatch(50);
    logger.info('✓ Manual competitor scraping completed');
  }

  async manualLLMRun(limit = 20) {
    logger.info(`🔧 Manual trigger: LLM processing (limit: ${limit})`);
    const result = await this.llmProcessor.processBatch(limit);
    logger.info(`✓ Manual LLM processing completed: ${result.processed} items`);
    return result;
  }

  // Get status of all jobs
  getStatus() {
    return this.jobs.map(({ name, schedule, job }) => ({
      name,
      schedule,
      running: job.getStatus() !== null
    }));
  }
}

// Singleton instance
let schedulerInstance = null;

function getScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new SchedulerService();
  }
  return schedulerInstance;
}

module.exports = { SchedulerService, getScheduler };
