const mongoose = require('mongoose');
const { cosineSimilarity } = require('../utils/cosine');

// Model loaded via require to ensure schema is registered
const EmbeddingChunk = require('../models/Embedding');

/**
 * findSimilarChunks
 * Inputs:
 * - chatbotId: ObjectId|string (tenant filter)
 * - queryEmbedding: number[] (same dim as stored embeddings)
 * - options: { topK?: number, limitCandidates?: number, minScore?: number }
 * Returns: Array<{ _id, content, score, chatbot_id }>
 */
async function findSimilarChunks({ chatbotId, queryEmbedding, options = {} }) {
  const topK = options.topK ?? 10;
  const limitCandidates = options.limitCandidates ?? 500; // balance accuracy vs cost
  const minScore = options.minScore ?? 0;

  if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    return [];
  }

  const filter = {};
  if (chatbotId) filter.chatbot_id = String(chatbotId);

  // Fetch recent candidates for this chatbot. Index on (chatbot_id, createdAt) assists.
  const candidates = await EmbeddingChunk.find(filter, { content: 1, embedding: 1, chatbot_id: 1 })
    .sort({ createdAt: -1 })
    .limit(limitCandidates)
    .lean();

  const scored = [];
  for (const c of candidates) {
    const score = cosineSimilarity(queryEmbedding, c.embedding || []);
    if (score >= minScore) {
      scored.push({ _id: c._id, content: c.content, score, chatbot_id: c.chatbot_id });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

module.exports = { findSimilarChunks };
