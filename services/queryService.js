// services/queryService.js
const { vectorSearchByText } = require('../services/vectorSearch');
const { wrap, stableHash } = require('../utils/cache');
const logger = require('../utils/logger');

const DEFAULT_TOP_K = Number(process.env.RETRIEVAL_TOP_K || 16);

async function retrieveRelevantChunks(
  query,
  chatbotId,
  topK = DEFAULT_TOP_K,
  minScore = 0
) {
  const keyHash = stableHash({ q: String(query || ''), bot: chatbotId ? String(chatbotId) : undefined, topK, minScore });
  const keyParts = ['vs', chatbotId ? String(chatbotId) : '_', keyHash];

  // Cache KB context for 10 minutes (600 seconds) to improve performance during conversations
  // This is especially beneficial for streaming where multiple similar queries may occur
  const response = await wrap({
    keyParts,
    ttlSec: 600, // 10 minutes (Phase 4 optimization)
    fn: async () => vectorSearchByText({
      text: query,
      chatbotId: chatbotId ? String(chatbotId) : undefined,
      k: topK,
      fields: ['content', 'chatbot_id', 'language'],
    }),
  });

  const results = Array.isArray(response?.results) ? response.results : Array.isArray(response) ? response : [];
  const meta = response?.meta || response?.results?.meta || {};

  const filtered = minScore > 0
    ? results.filter((doc) => (doc.score ?? 0) >= minScore)
    : results;

  logger.info(`[retrieval] chunks=${filtered.length} path=${meta.path || 'unknown'} bot=${chatbotId || '_'} vector=${meta.counts?.vector ?? 'n/a'} text=${meta.counts?.text ?? 'n/a'}`);

  return filtered;
}

module.exports = { retrieveRelevantChunks };
