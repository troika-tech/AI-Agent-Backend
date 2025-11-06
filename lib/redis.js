// Singleton Redis client with graceful fallback
// Usage: const redis = require('../lib/redis');
// If Redis is unavailable or the 'redis' package isn't installed, helpers degrade to no-op.

const logger = require('../utils/logger');
let createClient;
try {
  ({ createClient } = require('redis'));
} catch (e) {
  // Module not installed in test/dev: operate in disabled mode
  createClient = null;
}
// Use global logger; levels controlled via config/logging.js

let client = null;
let connected = false;

function getRedisUrl() {
  return process.env.REDIS_URL || null;
}

async function init() {
  if (client || !getRedisUrl() || !createClient) return client; // already init or no URL or no module

  client = createClient({
    url: getRedisUrl(),
    socket: {
      reconnectStrategy(retries) {
        // Exponential backoff up to ~5s
        return Math.min(retries * 100, 5000);
      },
    },
  });

  client.on('error', (err) => {
    connected = false;
    if (process.env.LOG_CACHE === 'true') logger.warn(`[redis] error: ${err.message}`);
  });

  client.on('connect', () => {
    if (process.env.LOG_CACHE === 'true') logger.info('[redis] connecting...');
  });

  client.on('ready', () => {
    connected = true;
    try {
      const url = new URL(getRedisUrl());
      const host = `${url.hostname}:${url.port || 6379}`;
      const secure = url.protocol === 'rediss:';
      logger.info(`[redis] ready host=${host} tls=${secure}`);
    } catch {
      logger.info('[redis] ready');
    }
  });

  try {
    await client.connect();
  } catch (err) {
    if (process.env.LOG_CACHE === 'true') logger.warn(`[redis] connect failed: ${err.message}`);
  }

  return client;
}

function isConnected() {
  return !!connected;
}

function getClient() {
  return client;
}

module.exports = { init, isConnected, getClient };
