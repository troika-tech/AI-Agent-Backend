const dotenv = require('dotenv');
const connectDB = require('../db');
const { getScheduler } = require('../services/schedulerService');
const logger = require('../utils/logger');

dotenv.config();

async function testScraping() {
  try {
    console.log('🧪 Testing Scraping System...\n');

    // Connect to database
    await connectDB();
    logger.info('Connected to database');

    const scheduler = getScheduler();

    // Get command line argument
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'news':
        console.log('📰 Testing News Scraping...');
        await scheduler.manualNewsRun();
        break;

      case 'competitors':
        console.log('🏢 Testing Competitor Scraping...');
        await scheduler.manualCompetitorRun();
        break;

      case 'llm':
        const limit = parseInt(args[1]) || 10;
        console.log(`🤖 Testing LLM Processing (limit: ${limit})...`);
        await scheduler.manualLLMRun(limit);
        break;

      case 'all':
        console.log('🚀 Testing Full Pipeline...');
        await scheduler.manualNewsRun();
        await scheduler.manualCompetitorRun();
        break;

      default:
        console.log(`
Usage: node scripts/testScraping.js <command>

Commands:
  news          - Test news scraping (TechCrunch, YourStory, etc.)
  competitors   - Test competitor scraping (Yellow.ai, Wix, etc.)
  llm [limit]   - Test LLM processing (default limit: 10)
  all           - Test full pipeline (news + competitors)

Examples:
  node scripts/testScraping.js news
  node scripts/testScraping.js llm 20
  node scripts/testScraping.js all
        `);
        process.exit(0);
    }

    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testScraping();
