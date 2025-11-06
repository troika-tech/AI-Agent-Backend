// utils/llmCache.js
const crypto = require('crypto');
const { getClient } = require('../lib/redis');

async function getOrCreateLLMResponse(promptKey, generatorFn) {
  const hash = crypto.createHash('sha256').update(promptKey).digest('hex');
  const key = `llm:${hash}`;

  const redis = getClient();
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        // Always cache a serializable shape: { data: <provider_response_data> }
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('Redis LLM get failed:', err.message);
    }
  }

  const response = await generatorFn();

  // Normalize to a serializable structure to avoid circular refs from HTTP clients
  // If the generator returns an axios-like response, prefer response.data
  const serializable = response && typeof response === 'object' && 'data' in response
    ? { data: response.data }
    : response;

  if (redis && serializable) {
    try {
      await redis.setEx(key, 300, JSON.stringify(serializable)); // 5 min TTL
    } catch (err) {
      console.warn('Redis LLM set failed:', err.message);
    }
  }

  return serializable;
}

module.exports = { getOrCreateLLMResponse };
