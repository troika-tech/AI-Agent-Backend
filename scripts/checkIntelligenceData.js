const mongoose = require('mongoose');
const MarketIntelligence = require('../models/MarketIntelligence');
require('dotenv').config();

async function checkIntelligenceData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get sample intelligence items
    const items = await MarketIntelligence.find({ processingStatus: 'embedded' })
      .select('type source title summary keyTakeaways relevanceScore scrapedAt')
      .limit(5)
      .sort({ scrapedAt: -1 });

    console.log('📊 Sample Intelligence Items:\n');
    items.forEach((item, i) => {
      console.log(`\n--- Item ${i + 1} ---`);
      console.log(`Type: ${item.type}`);
      console.log(`Source: ${item.source}`);
      console.log(`Title: ${item.title}`);
      console.log(`Summary: ${item.summary?.substring(0, 200)}...`);
      console.log(`Key Takeaways:`, item.keyTakeaways);
      console.log(`Relevance Score: ${item.relevanceScore}`);
      console.log(`Scraped: ${item.scrapedAt}`);
    });

    // Get counts by type
    const typeCounts = await MarketIntelligence.aggregate([
      { $match: { processingStatus: 'embedded' } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    console.log('\n\n📈 Intelligence by Type:');
    typeCounts.forEach(t => console.log(`  ${t._id}: ${t.count}`));

    // Get total count
    const totalCount = await MarketIntelligence.countDocuments({ processingStatus: 'embedded' });
    console.log(`\n📊 Total Embedded Items: ${totalCount}`);

    await mongoose.connection.close();
    console.log('\n✅ Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkIntelligenceData();
