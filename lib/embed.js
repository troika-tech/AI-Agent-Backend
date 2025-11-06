const axios = require('axios');
const crypto = require('crypto');
const { getClient } = require('./redis');

const OPENAI_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_INPUT_CHARS = Number(process.env.EMBEDDING_MAX_CHARS || 8000);
const REQUEST_TIMEOUT_MS = Number(process.env.EMBEDDING_TIMEOUT_MS || 10000);
const CACHE_TTL_SECONDS = Number(process.env.EMBEDDING_CACHE_TTL || 86400);
const MAX_BATCH_SIZE = Math.max(1, Number(process.env.EMBEDDING_MAX_BATCH || 20));
const MAX_REQUEST_CHAR_BUDGET = Math.max(2000, Number(process.env.EMBEDDING_MAX_REQUEST_CHARS || 24000));

function normaliseInput(text) {
  const str = typeof text === 'string' ? text : String(text ?? '');
  return str.slice(0, MAX_INPUT_CHARS);
}

function cacheKeyForText(text) {
  const hash = crypto.createHash('sha256').update(typeof text === 'string' ? text : String(text ?? '')).digest('hex');
  return `embed:${hash}`;
}

function buildBatches(items) {
  const batches = [];
  let start = 0;

  while (start < items.length) {
    let end = Math.min(start + MAX_BATCH_SIZE, items.length);
    if (end === start) {
      end = start + 1;
    }

    let chunk = items.slice(start, end);
    let totalChars = chunk.reduce((sum, text) => sum + text.length, 0);

    while (chunk.length > 1 && totalChars > MAX_REQUEST_CHAR_BUDGET) {
      end -= 1;
      chunk = items.slice(start, end);
      totalChars = chunk.reduce((sum, text) => sum + text.length, 0);
    }

    batches.push({ start, chunk });
    start = end;
  }

  return batches;
}

async function requestEmbeddings(inputs) {
  const payload = Array.isArray(inputs) ? inputs : [inputs];
  if (payload.length === 0) return [];

  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set - skipping embedding');
    return payload.map(() => []);
  }

  const sanitised = payload.map(normaliseInput);
  const results = new Array(sanitised.length);
  const batches = buildBatches(sanitised);

  for (const batch of batches) {
    const { start, chunk } = batch;

    try {
      const response = await axios.post(
        OPENAI_URL,
        {
          model: EMBEDDING_MODEL,
          input: chunk.length === 1 ? chunk[0] : chunk,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: REQUEST_TIMEOUT_MS,
        }
      );

      const data = Array.isArray(response?.data?.data) ? response.data.data : [];
      chunk.forEach((_, idx) => {
        const globalIndex = start + idx;
        const embedding = data[idx]?.embedding;
        results[globalIndex] = Array.isArray(embedding) ? embedding : [];
      });
    } catch (err) {
      console.warn('Embedding call failed:', err?.response?.data || err.message);
      chunk.forEach((_, idx) => {
        const globalIndex = start + idx;
        results[globalIndex] = [];
      });
    }
  }

  return results;
}

async function createEmbedding(text) {
  const [vector] = await requestEmbeddings([text]);
  return Array.isArray(vector) ? vector : [];
}

async function getEmbedding(text) {
  const redis = getClient();
  const cacheKey = cacheKeyForText(text);

  if (redis && typeof redis.get === 'function') {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('Redis get failed:', err.message);
    }
  }

  const vector = await createEmbedding(text);

  if (redis && vector.length > 0 && typeof redis.setEx === 'function') {
    try {
      await redis.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(vector));
    } catch (err) {
      console.warn('Redis set failed:', err.message);
    }
  }

  return vector;
}

async function getEmbeddings(texts = []) {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const redis = getClient();
  const results = new Array(texts.length);
  const pending = [];

  const rawTexts = texts.map((text) => (typeof text === 'string' ? text : String(text ?? '')));

  if (redis && typeof redis.mGet === 'function') {
    const keys = rawTexts.map(cacheKeyForText);
    try {
      const cachedValues = await redis.mGet(keys);
      if (Array.isArray(cachedValues)) {
        cachedValues.forEach((cached, idx) => {
          if (cached) {
            try {
              results[idx] = JSON.parse(cached);
            } catch (err) {
              console.warn('Redis parse failed:', err.message);
            }
          }
        });
      }
    } catch (err) {
      console.warn('Redis mGet failed:', err.message);
    }
  }

  rawTexts.forEach((raw, idx) => {
    if (!Array.isArray(results[idx])) {
      pending.push({ idx, raw });
    }
  });

  if (pending.length > 0) {
    const vectors = await requestEmbeddings(pending.map((item) => item.raw));
    const writePromises = [];

    pending.forEach((item, i) => {
      const vector = Array.isArray(vectors[i]) ? vectors[i] : [];
      results[item.idx] = vector;

      if (redis && vector.length > 0 && typeof redis.setEx === 'function') {
        const key = cacheKeyForText(item.raw);
        writePromises.push(
          redis.setEx(key, CACHE_TTL_SECONDS, JSON.stringify(vector)).catch((err) => {
            console.warn('Redis set failed:', err.message);
          })
        );
      }
    });

    if (writePromises.length > 0) {
      await Promise.allSettled(writePromises);
    }
  }

  return results;
}

module.exports = {
  EMBEDDING_MODEL,
  createEmbedding,
  getEmbedding,
  getEmbeddings,
  generateEmbedding: getEmbedding,
  batchGenerateEmbeddings: getEmbeddings,
};
