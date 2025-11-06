require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');

/**
 * Create Atlas Vector Search Index for Market Intelligence embeddings
 *
 * This creates a vectorSearch index on the 'marketintelligences' collection
 * with 1536 dimensions (for text-embedding-3-small) and cosine similarity.
 */

(async () => {
  try {
    await connectDB();
    const db = mongoose.connection.db;
    console.log('Using database:', db.databaseName);

    const collectionName = 'marketintelligences';
    const indexName = 'market_intelligence_vector_index';
    const vectorDim = 1536; // text-embedding-3-small dimensions
    const vectorPath = 'embedding';

    // Filter fields for pre-filtering
    const filterFields = [
      'type',
      'relevantServices',
      'relevantIndustries',
      'processingStatus',
      'relevanceScore'
    ];

    const fieldsArray = [
      { type: 'vector', path: vectorPath, numDimensions: vectorDim, similarity: 'cosine' },
      ...filterFields.map(f => ({ path: f, type: 'filter' }))
    ];

    const definition = { fields: fieldsArray };
    const indexSpec = { name: indexName, type: 'vectorSearch', definition };

    console.log(`\n🔍 Creating/Updating Atlas Vector Search index '${indexName}' on '${collectionName}'...\n`);

    const coll = db.collection(collectionName);

    // Check if the index already exists
    const existing = await coll.listSearchIndexes().toArray();
    const hasIndex = existing.some(ix => ix?.name === indexName);

    if (hasIndex) {
      console.log('ℹ️  Index already exists. Updating definition...');
      await coll.updateSearchIndex(indexName, definition);
      console.log('✅ Atlas Vector Search index updated');
    } else {
      try {
        const res = await coll.createSearchIndexes([indexSpec]);
        console.log('createSearchIndexes result:', res);
        console.log('✅ Atlas Vector Search index created');
      } catch (err) {
        const msg = String(err?.message || err);
        if (msg.includes('maximum number of FTS indexes') || msg.includes('maximum number of fts indexes')) {
          console.error('\n❌ Index limit reached for your Atlas cluster tier. Options:');
          console.error('   - Drop unused search indexes: npm run db:atlas:list then npm run db:atlas:drop');
          console.error('   - Or upgrade your cluster tier to allow more search indexes.\n');
        }
        if (msg.toLowerCase().includes('attribute fields missing')) {
          console.error('\n❌ Definition must include top-level { fields: [...] } for vectorSearch indexes.');
          console.error('Provided definition:', JSON.stringify(definition, null, 2));
        }
        throw err;
      }
    }

    // List indexes for confirmation
    const after = await coll.listSearchIndexes().toArray();
    console.log('\n📋 Current search indexes on', collectionName, ':');
    after.forEach(ix => {
      console.log(`   - ${ix.name} (${ix.type}) [${ix.status || 'UNKNOWN'}]`);
    });

    console.log('\n⏳ Note: New indexes may take 5-10 minutes to become active.');
    console.log('   Check status with: npm run db:atlas:list\n');

  } catch (err) {
    console.error('\n❌ Failed to create Atlas Vector Search index:', err?.response?.data || err.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
