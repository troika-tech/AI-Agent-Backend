require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');

// Using the MongoDB Node driver directly from Mongoose connection to create Atlas Search index
// Requires the following env vars:
// - MONGODB_DATABASE (optional; derived from URI if omitted)
// - ATLAS_COLLECTION (defaults to 'embeddingchunks')
// - ATLAS_VECTOR_INDEX_NAME (defaults to 'embedding_vector_index')
// - ATLAS_VECTOR_DIM (defaults to 1536 for text-embedding-3-small)
// - ATLAS_VECTOR_PATH (defaults to 'embedding')
// - ATLAS_FILTER_FIELDS (comma-separated fields to also index as "type: filter"; default: 'chatbot_id')

(async () => {
  try {
    await connectDB();
  const db = mongoose.connection.db;
  console.log('Using database:', db.databaseName);

    const collectionName = (process.env.ATLAS_COLLECTION || 'embeddingchunks');
  const indexName = (process.env.ATLAS_VECTOR_INDEX_NAME || 'embedding_vectorIndex');
    const vectorDim = Number(process.env.ATLAS_VECTOR_DIM || 1536);
    const vectorPath = process.env.ATLAS_VECTOR_PATH || 'embedding';
    const filterFields = (process.env.ATLAS_FILTER_FIELDS || 'chatbot_id')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const fieldsArray = [
      { type: 'vector', path: vectorPath, numDimensions: vectorDim, similarity: 'cosine' },
      ...filterFields.map(f => ({ path: f, type: 'filter' }))
    ];

    const definition = { fields: fieldsArray };
    const indexSpec = { name: indexName, type: 'vectorSearch', definition };

    console.log(`Creating/Updating Atlas Vector Search index '${indexName}' on '${collectionName}' ...`);
    const coll = db.collection(collectionName);
    // First, check if the index already exists
    const existing = await coll.listSearchIndexes().toArray();
    const hasIndex = existing.some(ix => ix?.name === indexName);

    if (hasIndex) {
      // Update existing index definition (no new index added)
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
          console.error('❌ Index limit reached for your Atlas cluster tier. Options:');
          console.error('- Drop unused search indexes: npm run db:atlas:list then npm run db:atlas:drop');
          console.error('- Or upgrade your cluster tier to allow more search indexes.');
        }
        if (msg.toLowerCase().includes('attribute fields missing')) {
          console.error('❌ Definition must include top-level { fields: [...] } for vectorSearch indexes.');
          console.error('Provided definition:', JSON.stringify(definition, null, 2));
        }
        throw err;
      }
    }

    // List indexes for confirmation
    const after = await coll.listSearchIndexes().toArray();
    console.log('Current search indexes on', collectionName, ':', after.map(ix => ({ name: ix.name, type: ix.type, status: ix.status })));
  } catch (err) {
    console.error('❌ Failed to create Atlas Vector Search index:', err?.response?.data || err.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
