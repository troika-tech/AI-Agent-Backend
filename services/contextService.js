// services/contextService.js
const crypto = require('crypto');
const { getEmbeddings, EMBEDDING_MODEL } = require('../lib/embed');
const languageService = require('./languageService');
const Embedding = require('../models/Embedding');

/**
 * Store context chunks with embeddings in MongoDB, deduplicating per chatbot.
 * @param {string[]} chunks - Array of string content.
 * @param {string|null} chatbotId - Optional chatbot ID.
 * @returns {Promise<Array>} Inserted documents.
 */
async function storeContextChunks(chunks, chatbotId = null) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    console.warn('No chunks provided to store.');
    return [];
  }

  const chatbotKey = chatbotId != null ? String(chatbotId) : null;
  const uniqueChunks = new Map();

  for (const chunk of chunks) {
    const content = typeof chunk === 'string' ? chunk.trim() : String(chunk ?? '').trim();
    if (!content) continue;

    const hashSource = `${content}|${chatbotKey ?? ''}`;
    const hash = crypto.createHash('sha256').update(hashSource).digest('hex');

    if (!uniqueChunks.has(hash)) {
      uniqueChunks.set(hash, {
        content,
        chatbot_id: chatbotKey,
        company_id: chatbotKey,
        hash,
      });
    }
  }

  const entries = Array.from(uniqueChunks.values());
  if (entries.length === 0) return [];

  try {
    const filter = {
      hash: { $in: entries.map((entry) => entry.hash) },
    };
    if (chatbotKey === null) {
      filter.chatbot_id = null;
    } else {
      filter.chatbot_id = chatbotKey;
    }

    const existing = await Embedding.find(filter, { hash: 1 }).lean();
    const existingHashes = new Set((existing || []).map((doc) => doc.hash));

    const freshEntries = entries.filter((entry) => !existingHashes.has(entry.hash));
    if (freshEntries.length === 0) {
      return [];
    }

    const vectors = await getEmbeddings(freshEntries.map((entry) => entry.content));
    const languages = await Promise.all(freshEntries.map((entry) => languageService.detectLanguage(entry.content)));
    const docsToInsert = [];

    freshEntries.forEach((entry, idx) => {
      const embedding = Array.isArray(vectors[idx]) ? vectors[idx] : [];
      if (!embedding.length) {
        console.warn(`Skipping chunk hash=${entry.hash} due to missing embedding`);
        return;
      }

      docsToInsert.push({
        content: entry.content,
        embedding,
        chatbot_id: entry.chatbot_id,
        company_id: entry.company_id,
        hash: entry.hash,
        model: EMBEDDING_MODEL,
        status: 'ready',
        embedding_length: embedding.length,
        language: languages[idx] || 'en',
      });
    });

    if (docsToInsert.length === 0) {
      return [];
    }

    const now = new Date();
    const operations = docsToInsert.map((doc) => ({
      updateOne: {
        filter: { chatbot_id: doc.chatbot_id, hash: doc.hash },
        update: {
          $set: {
            content: doc.content,
            embedding: doc.embedding,
            chatbot_id: doc.chatbot_id,
            company_id: doc.company_id,
            hash: doc.hash,
            model: doc.model,
            status: doc.status,
            embedding_length: doc.embedding_length,
            language: doc.language,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        upsert: true,
      },
    }));

    await Embedding.bulkWrite(operations, { ordered: false });

    const hashes = docsToInsert.map((doc) => doc.hash);
    const stored = await Embedding.find({
      chatbot_id: chatbotKey,
      hash: { $in: hashes },
    }).lean();

    const order = new Map(hashes.map((h, idx) => [h, idx]));
    return stored.sort((a, b) => (order.get(a.hash) || 0) - (order.get(b.hash) || 0));
  } catch (err) {
    console.error('MongoDB upsert error:', err.message);
    throw new Error('Failed to store context chunks in MongoDB');
  }
}

module.exports = { storeContextChunks };
