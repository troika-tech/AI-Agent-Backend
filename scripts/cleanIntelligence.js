const dotenv = require('dotenv');
const connectDB = require('../db');
const MarketIntelligence = require('../models/MarketIntelligence');
const logger = require('../utils/logger');

dotenv.config();

async function cleanIntelligence() {
  try {
    console.log('🧹 Cleaning Market Intelligence Data...\n');

    await connectDB();
    logger.info('Connected to database');

    // Get current count
    const beforeCount = await MarketIntelligence.countDocuments();
    console.log(`Current items in database: ${beforeCount}\n`);

    if (beforeCount === 0) {
      console.log('✅ Database is already empty. Nothing to delete.\n');
      process.exit(0);
    }

    // Show breakdown
    const scraped = await MarketIntelligence.countDocuments({ processingStatus: 'scraped' });
    const summarized = await MarketIntelligence.countDocuments({ processingStatus: 'summarized' });
    const embedded = await MarketIntelligence.countDocuments({ processingStatus: 'embedded' });

    console.log('Breakdown:');
    console.log(`  - Scraped: ${scraped}`);
    console.log(`  - Summarized: ${summarized}`);
    console.log(`  - Embedded: ${embedded}`);
    console.log('');

    // Confirm deletion
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      readline.question(`⚠️  Are you sure you want to delete all ${beforeCount} items? (yes/no): `, resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Deletion cancelled.');
      process.exit(0);
    }

    // Delete all
    console.log('\n🗑️  Deleting all market intelligence items...');
    const result = await MarketIntelligence.deleteMany({});

    console.log(`✅ Successfully deleted ${result.deletedCount} items.\n`);

    // Verify
    const afterCount = await MarketIntelligence.countDocuments();
    console.log(`Items remaining: ${afterCount}\n`);

    if (afterCount === 0) {
      console.log('✨ Database is now clean. You can run fresh scraping with:');
      console.log('   npm run intelligence:scrape:all\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error cleaning intelligence data:', error);
    process.exit(1);
  }
}

cleanIntelligence();
