require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');
const { getEmbedding } = require('../lib/embed');
const { findSimilarChunks } = require('../services/vectorSearchService');

(async () => {
  try {
    await connectDB();

    const queryText = process.env.VECTOR_QUERY || 'sample query about my product';
    const chatbotId = process.env.VECTOR_CHATBOT_ID || undefined;
    const topK = parseInt(process.env.VECTOR_TOPK || '5', 10);

    console.log('Creating query embedding...');
    const queryEmbedding = await getEmbedding(queryText);
    if (!queryEmbedding.length) {
      console.log('No embedding created (missing OPENAI_API_KEY?). Exiting.');
      return;
    }

    console.log('Searching similar chunks...');
    const results = await findSimilarChunks({ chatbotId, queryEmbedding, options: { topK } });
    for (const r of results) {
      console.log(`score=${r.score.toFixed(4)} content=${(r.content || '').slice(0, 100)}...`);
    }

    console.log('✅ Vector search demo complete');
  } catch (err) {
    console.error('❌ Vector search demo failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
