const dotenv = require('dotenv');
const connectDB = require('../db');
const MarketIntelligence = require('../models/MarketIntelligence');
const IntelligentIntent = require('../models/IntelligentIntent');

dotenv.config();

async function checkIntelligence() {
  try {
    console.log('📊 Checking Market Intelligence Status...\n');

    await connectDB();

    // Check MarketIntelligence collection
    const totalIntelligence = await MarketIntelligence.countDocuments();
    const scrapedCount = await MarketIntelligence.countDocuments({ processingStatus: 'scraped' });
    const summarizedCount = await MarketIntelligence.countDocuments({ processingStatus: 'summarized' });
    const embeddedCount = await MarketIntelligence.countDocuments({ processingStatus: 'embedded' });
    const readyCount = await MarketIntelligence.countDocuments({ processingStatus: 'ready' });

    console.log('Market Intelligence:');
    console.log(`  Total: ${totalIntelligence}`);
    console.log(`  Scraped (pending processing): ${scrapedCount}`);
    console.log(`  Summarized: ${summarizedCount}`);
    console.log(`  Embedded: ${embeddedCount}`);
    console.log(`  Ready: ${readyCount}\n`);

    // Breakdown by type
    const competitorCount = await MarketIntelligence.countDocuments({ type: 'competitor' });
    const newsCount = await MarketIntelligence.countDocuments({ type: 'industry_news' });
    const techCount = await MarketIntelligence.countDocuments({ type: 'tech_update' });
    const trendCount = await MarketIntelligence.countDocuments({ type: 'market_trend' });

    console.log('By Type:');
    console.log(`  Competitor Data: ${competitorCount}`);
    console.log(`  Industry News: ${newsCount}`);
    console.log(`  Tech Updates: ${techCount}`);
    console.log(`  Market Trends: ${trendCount}\n`);

    // Check Intelligent Intents
    const totalIntents = await IntelligentIntent.countDocuments();
    const activeIntents = await IntelligentIntent.countDocuments({ isActive: true });

    console.log('Intelligent Intents:');
    console.log(`  Total: ${totalIntents}`);
    console.log(`  Active: ${activeIntents}\n`);

    // Breakdown by intelligence level
    const noneLevel = await IntelligentIntent.countDocuments({ intelligenceLevel: 'NONE', isActive: true });
    const subtleLevel = await IntelligentIntent.countDocuments({ intelligenceLevel: 'SUBTLE', isActive: true });
    const dataPointsLevel = await IntelligentIntent.countDocuments({ intelligenceLevel: 'DATA_POINTS', isActive: true });
    const explicitLevel = await IntelligentIntent.countDocuments({ intelligenceLevel: 'EXPLICIT', isActive: true });
    const recentUpdatesLevel = await IntelligentIntent.countDocuments({ intelligenceLevel: 'RECENT_UPDATES', isActive: true });

    console.log('By Intelligence Level:');
    console.log(`  NONE (FAQ): ${noneLevel}`);
    console.log(`  SUBTLE (Service Inquiry): ${subtleLevel}`);
    console.log(`  DATA_POINTS (Industry): ${dataPointsLevel}`);
    console.log(`  EXPLICIT (Competitive): ${explicitLevel}`);
    console.log(`  RECENT_UPDATES (Tech): ${recentUpdatesLevel}\n`);

    // Show latest intelligence
    console.log('Latest Intelligence Items:');
    const latest = await MarketIntelligence.find()
      .sort({ scrapedAt: -1 })
      .limit(5)
      .select('title source type processingStatus scrapedAt');

    latest.forEach((item, index) => {
      console.log(`  ${index + 1}. [${item.type}] ${item.title}`);
      console.log(`     Source: ${item.source} | Status: ${item.processingStatus}`);
      console.log(`     Scraped: ${item.scrapedAt.toLocaleString()}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkIntelligence();
