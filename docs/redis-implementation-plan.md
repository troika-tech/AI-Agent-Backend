## Redis implementation plan for chatbot-backend

This document lays out a pragmatic, low-risk rollout plan to introduce Redis into the backend to reduce latency and load for hot paths like knowledge-base lookups, product search, and configuration reads. It also covers rate limiting, caching rules, invalidation, testing, observability, and rollback.

### Goals

- Reduce median/95p response times for chat replies by avoiding redundant DB and vector searches
- Lower MongoDB and external API load (OpenAI, TTS, etc.)
- Keep correctness and tenant isolation intact; no broken auth or stale sensitive data
- Be resilient to Redis outages (graceful degradation to no-cache)

### Where caching helps most (by ROI)

1) Vector/context retrieval for Q&A
- Code: `services/queryService.retrieveRelevantChunks` -> calls `services/vectorSearch.vectorSearchByText`
- Pattern: cache-aside on (chatbotId, queryHash)
- TTL: 120–180s (small, because KB can change); key: `v1:vs:{chatbotId}:{queryHash}`

2) Client configuration reads
- Code: `services/configService.getClientConfig`
- Pattern: cache-aside on chatbotId
- TTL: 300s; key: `v1:cfg:{chatbotId}`
- Invalidate on writes in `controllers/clientConfigController` (post/patch)

3) Chatbot persona/basic bot metadata
- Code: `services/chatService` fetches `Chatbot.findById`
- Pattern: cache-aside on chatbotId
- TTL: 600s; key: `v1:bot:{chatbotId}:persona`
- Invalidate on `controllers/chatbotController` updates

4) Product search results (user storefront queries)
- Code: `services/productSearchService.searchProducts`
- Pattern: cache-aside on normalized query + filters + tenant
- TTL: 120–300s depending on stock volatility; key: `v1:ps:{chatbotId}:{queryAndFiltersHash}`
- Optional: cache only when in_stock=true

5) TTS audio for identical text snippets (optional, high win on repeats)
- Code: `services/chatbotService` TTS request
- Pattern: cache-aside on cleaned text hash
- TTL: 1 day; key: `v1:tts:{textHash}`
- Store base64 audio string or Buffer; ensure size limits

6) Distributed rate limiting
- Code: `app.js` uses `express-rate-limit` in-memory by default
- Switch to Redis store to make limits consistent across multiple instances
- Library: `rate-limit-redis` store for `express-rate-limit@7`

Later/optional (defer unless needed):
- Short TTL caching of LLM completions for exact prompt+context+persona matches (avoid unless you control determinism); key: `v1:llm:{hash}` TTL 60s
- OTP/session storage in Redis instead of Mongo (requires schema changes; keep as future work)

### Design choices

- Client: official `redis@^4` (lightweight, stable). Alternative: `ioredis` if cluster/sentinel
- Connection: URL via `REDIS_URL` (e.g., `redis://:password@host:6379`), with TLS when needed
- Pattern: cache-aside (read-through on miss, explicit invalidation on writes)
- Key naming: prefix with version and domain, use short SHA256 hashes for dynamic inputs
- TTLs: tuned per domain (see above); default fallback `REDIS_DEFAULT_TTL=300`
- Safety: if Redis is down, code should continue without caching
- Observability: optional debug log of hits/misses behind `LOG_CACHE=true`

### Environment variables

- REDIS_URL=redis://:password@localhost:6379
- REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD (alternative to URL)
- REDIS_TLS=true|false
- REDIS_PREFIX=supa (default)
- REDIS_DEFAULT_TTL=300
- LOG_CACHE=true|false

Windows developer setup (local):
- Prefer Docker:
  - Install Docker Desktop
  - Run: `docker run -p 6379:6379 --name redis -d redis:7-alpine`
- Or use a managed Redis (Upstash/ElastiCache/Redis Cloud) and set `REDIS_URL`

### Implementation steps (incremental rollout)

1) Add Redis client and cache helpers (safe, no wiring)
- Files added in this repo:
  - `lib/redis.js`: singleton Redis client with graceful failure
  - `utils/cache.js`: cache helpers (get/set/wrap, key builder, hashing)

2) Wire cache to low-risk reads
- `services/configService.getClientConfig`:
  - Wrap Mongo read with `cache.wrap({ keyParts: ['cfg', chatbotId], ttlSec: 300 })`
  - Invalidate key in `controllers/clientConfigController` after updates

3) Cache vector search results
- In `services/queryService.retrieveRelevantChunks`:
  - Compute `queryHash = stableHash({ q: query, bot: chatbotId, k: topK, min: minScore })`
  - `cache.wrap({ keyParts: ['vs', chatbotId, queryHash], ttlSec: 120, fn: () => vectorSearchByText(...) })`

4) Product search caching
- In `services/productSearchService.searchProducts`:
  - Build a normalized cache key from: chatbotId, cleanQuery, filters (size, color, min/max, in_stock)
  - Short TTL 180s; skip cache when `debug=true`
  - Invalidate selectively if you have frequent product mutations (optional)

5) Distributed rate limit
- Replace in-memory store in `app.js` with Redis store:
  - `npm i rate-limit-redis redis`
  - Use `new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) })`
  - Keep skip logic and whitelisting intact

6) Optional TTS cache
- Before calling external TTS, compute `textHash` and `cache.get('tts', textHash)`
- If hit, return cached audio; else fetch and `cache.set('tts', textHash, audio, 86400)`

### Code snippets (usage)

Cache helper (already scaffolded at `utils/cache.js`):

```js
const { wrap, key, stableHash } = require('../utils/cache');

// configService.js
async function getClientConfig(chatbotId) {
  return wrap({
    keyParts: ['cfg', String(chatbotId)],
    ttlSec: 300,
    fn: async () => {
      // existing Mongo read here
    },
  });
}

// queryService.js
async function retrieveRelevantChunks(query, chatbotId, topK = 5, minScore = 0.75) {
  const qh = stableHash({ q: query, bot: chatbotId, topK, minScore });
  return wrap({
    keyParts: ['vs', String(chatbotId), qh],
    ttlSec: 120,
    fn: () => vectorSearchByText({ text: query, chatbotId: String(chatbotId), k: topK, fields: ['content','chatbot_id'] })
  }).then(results => (results || []).filter(d => (d.score ?? d._score ?? 0) >= minScore));
}
```

Redis-backed rate limit store (example):

```js
const { createClient } = require('redis');
const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

const limiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redis.sendCommand(args),
    prefix: process.env.REDIS_PREFIX || 'supa:rl',
  }),
});
```

### Invalidation strategy

- Client config updates: delete `cfg:{chatbotId}` after successful write
- Chatbot persona/metadata updates: delete `bot:{chatbotId}:*` relevant keys
- Product imports/mutations: optionally delete `ps:{chatbotId}:*` to avoid stale stock (or keep low TTL)
- Vector/LLM caches: rely on TTLs; manual invalidation rarely needed

### Observability & ops

- Log cache hit/miss at debug level when `LOG_CACHE=true`
- Add health check `/health` to include Redis status (optional)
- Track Redis CPU/mem via provider dashboards; set alerts for connection errors

### Testing strategy

- Unit tests: mock `utils/cache` to a simple in-memory Map
- Integration: run Redis in CI via Docker service; set `REDIS_URL` for tests
- Contract tests: ensure cache never changes functional responses; only latency should change

### Security & privacy

- Never store PII directly in keys; use hashed IDs for composite inputs
- Keep TTLs short for dynamic/product data
- Use TLS and AUTH in production

### Rollback

- All changes are additive with graceful fallback. If issues occur:
  1) Set `REDIS_URL` empty to disable cache
  2) Revert wiring in specific services (minimal diff)
  3) Flush Redis keys if needed: `FLUSHDB` (careful in multi-tenant/shared)

### Next steps (checklist)

- [ ] Install redis client and store packages
- [ ] Wire configService cache and controller invalidation
- [ ] Wire vector search cache
- [ ] Wire product search cache (skip when debug=true)
- [ ] Switch rate limiter to Redis Store
- [ ] Add optional TTS cache
- [ ] Add Redis status to /health (optional)
- [ ] Add tests and CI Redis service
