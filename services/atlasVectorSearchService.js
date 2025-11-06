const mongoose = require('mongoose');
require('../models/Embedding'); // ensure model is registered

/**
 * atlasVectorSearch
 * Uses MongoDB Atlas Vector Search.
 * Inputs:
 * - chatbotId?: string|ObjectId
 * - queryEmbedding: number[]
 * - options?: { topK?: number, numCandidates?: number, indexName?: string, mode?: 'vectorSearch'|'search' }
 *   - mode 'vectorSearch' uses $vectorSearch stage (preferred on modern Atlas)
 *   - mode 'search' uses $search with knnBeta (legacy)
 */
async function atlasVectorSearch({ chatbotId, queryEmbedding, options = {} }) {
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return [];

  const db = mongoose.connection.db;
  const coll = db.collection('embeddingchunks');

  const indexName = options.indexName || process.env.ATLAS_VECTOR_INDEX || 'embedding_index';
  const topK = options.topK ?? (parseInt(process.env.ATLAS_VECTOR_TOPK || '10', 10));
  const numCandidates = options.numCandidates ?? (parseInt(process.env.ATLAS_VECTOR_CANDIDATES || '200', 10));
  const mode = (options.mode || process.env.ATLAS_VECTOR_MODE || 'vectorSearch').toLowerCase();

  const filterObj = chatbotId ? { chatbot_id: String(chatbotId) } : undefined;

  let pipeline;
  if (mode === 'vectorsearch') {
    // Preferred on recent Atlas versions
    pipeline = [
      {
        $vectorSearch: {
          index: indexName,
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates,
          limit: topK,
          ...(filterObj ? { filter: filterObj } : {}),
        },
      },
      {
        $project: {
          content: 1,
          chatbot_id: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ];
  } else {
    // Legacy: $search knnBeta
    const searchStage = {
      $search: {
        index: indexName,
        knnBeta: {
          path: 'embedding',
          vector: queryEmbedding,
          k: topK,
          numCandidates,
        },
      },
    };
    if (filterObj) {
      searchStage.$search.compound = { filter: [{ equals: { path: 'chatbot_id', value: String(filterObj.chatbot_id) } }] };
    }
    pipeline = [
      searchStage,
      {
        $project: {
          content: 1,
          chatbot_id: 1,
          score: { $meta: 'searchScore' },
        },
      },
      { $limit: topK },
    ];
  }

  const cursor = coll.aggregate(pipeline, { allowDiskUse: true });
  const docs = await cursor.toArray();
  return docs.map((d) => ({ _id: d._id, content: d.content, chatbot_id: d.chatbot_id, score: d.score }));
}

module.exports = { atlasVectorSearch };
