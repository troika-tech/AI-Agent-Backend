require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');

(async () => {
  const action = process.argv[2];
  const indexName = process.argv[3];
  try {
    if (!action) throw new Error('Usage: node scripts/manageAtlasSearchIndexes.js <list|drop> [indexName]');

    await connectDB();
    const db = mongoose.connection.db;
    const collectionName = (process.env.ATLAS_COLLECTION || 'embeddingchunks');
    const coll = db.collection(collectionName);

    if (action === 'list') {
      const list = await coll.listSearchIndexes().toArray();
      console.log(`Search indexes on '${collectionName}':`);
      for (const ix of list) {
        console.log('- name:', ix.name, 'type:', ix.type || 'search', 'status:', ix.status || 'n/a');
      }
    } else if (action === 'drop') {
      if (!indexName) throw new Error('Provide an index name to drop');
      await coll.dropSearchIndex(indexName);
      console.log(`✅ Dropped search index '${indexName}' on '${collectionName}'`);
    } else {
      throw new Error('Unknown action. Use list or drop.');
    }
  } catch (err) {
    console.error('❌ manageAtlasSearchIndexes failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
