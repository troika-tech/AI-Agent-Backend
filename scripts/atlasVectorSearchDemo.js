require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');
const { getEmbedding } = require('../lib/embed');
const { atlasVectorSearch } = require('../services/atlasVectorSearchService');

(async () => {
  try {
    await connectDB();

    const queryText = process.env.VECTOR_QUERY || 'sample query about my product';
    const chatbotId = process.env.VECTOR_CHATBOT_ID || undefined;
    const mode = (process.env.ATLAS_VECTOR_MODE || 'vectorSearch');
    const indexName = process.env.ATLAS_VECTOR_INDEX || 'embedding_index';

    console.log('Creating query embedding...');
    const queryEmbedding = await getEmbedding(queryText);
    if (!queryEmbedding.length) {
      console.log('No embedding created (missing OPENAI_API_KEY?). Exiting.');
      return;
    }

    console.log(`Running Atlas ${mode} with index='${indexName}'...`);
    const results = await atlasVectorSearch({ chatbotId, queryEmbedding, options: { indexName, mode } });
    for (const r of results) {
      console.log(`score=${r.score?.toFixed ? r.score.toFixed(4) : r.score} content=${(r.content || '').slice(0, 100)}...`);
    }

    console.log('✅ Atlas vector search demo complete');
  } catch (err) {
    console.error('❌ Atlas vector search demo failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
