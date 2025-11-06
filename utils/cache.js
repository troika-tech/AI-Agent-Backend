const crypto = require('crypto');
const { init, isConnected, getClient } = require('../lib/redis');

const PREFIX = process.env.REDIS_PREFIX || 'supa';
const DEFAULT_TTL = Number(process.env.REDIS_DEFAULT_TTL || 300);
const LOG = process.env.LOG_CACHE === 'true';

function stableHash(obj) {
  const json = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 24);
}

function key(...parts) {
  return [PREFIX, ...parts.map(String)].join(':');
}

async function get(k) {
  await init();
  if (!isConnected()) return null;
  try {
    const raw = await getClient().get(k);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    if (LOG) console.warn('[cache] get error', e.message);
    return null;
  }
}

async function set(k, val, ttlSec = DEFAULT_TTL) {
  await init();
  if (!isConnected()) return false;
  try {
    const payload = JSON.stringify(val);
    if (ttlSec && ttlSec > 0) {
      await getClient().setEx(k, ttlSec, payload);
    } else {
      await getClient().set(k, payload);
    }
    return true;
  } catch (e) {
    if (LOG) console.warn('[cache] set error', e.message);
    return false;
  }
}

async function del(k) {
  await init();
  if (!isConnected()) return 0;
  try {
    return await getClient().del(k);
  } catch (e) {
    if (LOG) console.warn('[cache] del error', e.message);
    return 0;
  }
}

async function wrap({ keyParts, ttlSec = DEFAULT_TTL, fn }) {
  const k = key(...keyParts);
  const hit = await get(k);
  if (hit !== null && hit !== undefined) {
    if (LOG) console.log('[cache] HIT', k);
    return hit;
  }
  if (LOG) console.log('[cache] MISS', k);
  const val = await fn();
  // Avoid caching undefined/null unless explicitly desired
  if (val !== undefined && val !== null) {
    await set(k, val, ttlSec);
  }
  return val;
}

module.exports = { stableHash, key, get, set, del, wrap };
