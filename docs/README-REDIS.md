# Redis integration plan

This repository includes a detailed plan to introduce Redis caching and a distributed rate-limit store to improve response latency and reduce database load.

- Full plan: docs/redis-implementation-plan.md
- Scaffolding added:
  - lib/redis.js: Singleton Redis client (graceful fallback when Redis is down)
  - utils/cache.js: Cache helpers (get/set/del/wrap, stableHash, namespaced keys)

Quick start (local):

1) Start Redis (Docker recommended on Windows):

```powershell
docker run -p 6379:6379 --name redis -d redis:7-alpine
```

2) Set env and run the app:

```powershell
$env:REDIS_URL="redis://localhost:6379"; $env:LOG_CACHE="true"; npm run dev
```

3) Wire caching incrementally (safe order):
- configService.getClientConfig -> cache.wrap([...], ttl 300)
- queryService.retrieveRelevantChunks -> cache.wrap([...], ttl 120)
- productSearchService.searchProducts -> cache.wrap([...], ttl 180, skip when debug=true)
- switch express-rate-limit to Redis store

See the full guide in docs/redis-implementation-plan.md for key design, TTLs, invalidation, and examples.
