

/**
 * scripts/reembedKnowledgeBase.js
 *
 * Re-embed all company knowledge base chunks using the unified embedding model.
 * - Processes companies sequentially in batches (default 100 docs per batch)
 * - Persists checkpoints so work can resume after interruption
 * - Deduplicates chunks using the content hash guard
 * - Marks legacy embeddings as stale before rewriting
 * - Busts per-company cache keys after completion
 */

'use strict';

require('dotenv').config();

const crypto = require('crypto');
const mongoose = require('mongoose');

const { EMBEDDING_MODEL, getEmbeddings } = require('../lib/embed');
const { init: initRedis, getClient } = require('../lib/redis');
const languageService = require('../services/languageService');
const Embedding = require('../models/Embedding');

const TARGET_DIMENSION = Number(process.env.REEMBED_TARGET_DIM || process.env.ATLAS_VECTOR_DIM || 1536);
const DEFAULT_BATCH_SIZE = Number(process.env.REEMBED_BATCH_SIZE || 100);
const RATE_LIMIT_BATCH_SIZE = Number(process.env.REEMBED_RATE_LIMIT_BATCH || 50);
const MAX_EMBED_RETRIES = Number(process.env.REEMBED_MAX_RETRIES || 5);
const JOB_COLLECTION = process.env.REEMBED_JOB_COLLECTION || 'embedding_rebuild_jobs';
const MONGODB_URI = process.env.MONGODB_URI;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt) {
  const base = Math.min(30000, Math.pow(2, attempt) * 250);
  const jitter = Math.floor(Math.random() * 250);
  return base + jitter;
}

function computeHash(content, companyId) {
  return crypto.createHash('sha256').update(`${content}|${companyId ?? ''}`).digest('hex');
}

function isDuplicateKeyError(err) {
  if (!err) return false;
  const msg = err.message || '';
  return err.code === 11000 || msg.includes('E11000 duplicate key error');
}

function normaliseContent(raw) {
  const str = typeof raw === 'string' ? raw : String(raw ?? '');
  let cleaned = "";
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code >= 0 && code <= 31 && code !== 9 && code !== 10 && code !== 13) {
      cleaned += ' ';
    } else {
      cleaned += str[i];
    }
  }
  return cleaned.trim();
}

function buildCompanySelector(companyId) {
  return {
    $or: [
      { company_id: companyId },
      { company_id: { $exists: false }, chatbot_id: companyId },
    ],
  };
}

async function getCheckpointCollection() {
  return mongoose.connection.collection(JOB_COLLECTION);
}

async function ensureCheckpointDoc(col, companyId, jobId, defaults) {
  const now = new Date();

  await col.updateOne(
    { company_id: companyId, job_id: jobId },
    {
      $setOnInsert: {
        company_id: companyId,
        job_id: jobId,
        created_at: now,
        last_index: 0,
        last_id: null,
        successes: 0,
        failures: 0,
        duplicates_removed: 0,
        batches_completed: 0,
        status: 'pending',
        ...defaults,
      },
    },
    { upsert: true },
  );

  const doc = await col.findOne({ company_id: companyId, job_id: jobId });
  if (!doc) {
    throw new Error(`Failed to create checkpoint document for company ${companyId}`);
  }
  return doc;
}

async function updateCheckpoint(col, companyId, jobId, patch) {
  const now = new Date();
  await col.updateOne(
    { company_id: companyId, job_id: jobId },
    { $set: { updated_at: now, ...patch } },
    { upsert: true },
  );
}

async function embedBatch(items, companyId) {
  if (!items.length) return [];

  const contents = items.map((item) => item.content);
  const vectors = await getEmbeddings(contents);
  const invalid = [];
  vectors.forEach((vector, idx) => {
    if (!Array.isArray(vector) || vector.length !== TARGET_DIMENSION) {
      invalid.push({ index: idx, id: String(items[idx].doc._id) });
    }
  });

  if (invalid.length) {
    const error = new Error(`received ${invalid.length} invalid embeddings for company ${companyId}`);
    error.code = 'EMBED_INVALID';
    error.invalid = invalid;
    throw error;
  }

  return vectors;
}

async function invalidateCompanyCache(companyId) {
  const redis = getClient();
  if (!redis) {
    return { deleted: 0 };
  }

  const pattern = `vs:${companyId}:*`;
  let deleted = 0;

  try {
    if (typeof redis.scanIterator === 'function') {
      const pending = [];
      for await (const rawKey of redis.scanIterator({ MATCH: pattern, COUNT: 200 })) {
        const key = typeof rawKey === 'string' ? rawKey : rawKey?.toString?.();
        if (!key) continue;
        pending.push(key);
        if (pending.length >= 100) {
          const removed = await Promise.all(pending.map((k) => redis.del(k)));
          deleted += removed.reduce((sum, val) => sum + Number(val || 0), 0);
          pending.length = 0;
        }
      }
      if (pending.length) {
        const removed = await Promise.all(pending.map((k) => redis.del(k)));
        deleted += removed.reduce((sum, val) => sum + Number(val || 0), 0);
      }
    }
  } catch (err) {
    console.warn(`[cache] Failed to invalidate keys for company ${companyId}: ${err.message}`);
  }

  return { deleted };
}

async function processCompany(companyId, jobId, options = {}) {
  const col = await getCheckpointCollection();
  const companySelector = buildCompanySelector(companyId);
  const companyMatch = companySelector.$or ? { $or: companySelector.$or } : companySelector;
  const pendingClauses = [
    companyMatch,
    {
      $or: [
        { model: { $exists: false } },
        { model: { $ne: EMBEDDING_MODEL } },
        { embedding_length: { $ne: TARGET_DIMENSION } },
        { status: { $exists: false } },
        { status: { $ne: 'ready' } },
      ],
    },
  ];
  const pendingFilter = { $and: pendingClauses };

  const totalDocs = await Embedding.countDocuments(companyMatch);
  const pendingCount = await Embedding.countDocuments(pendingFilter);

  const checkpoint = await ensureCheckpointDoc(col, companyId, jobId, {
    pre_count: totalDocs,
    pending_count: pendingCount,
  });

  await updateCheckpoint(col, companyId, jobId, { status: 'running' });

  // Mark old embeddings as stale before rewriting
  await Embedding.updateMany(
    { $and: [companyMatch, { model: { $exists: true, $ne: EMBEDDING_MODEL } }] },
    { $set: { status: 'stale' } },
  );

  let currentBatchSize = Math.min(DEFAULT_BATCH_SIZE, Number(options.batchSize || DEFAULT_BATCH_SIZE));
  let processed = checkpoint.last_index || 0;
  let successes = checkpoint.successes || 0;
  let failures = checkpoint.failures || 0;
  let duplicatesRemoved = checkpoint.duplicates_removed || 0;
  let lastId = checkpoint.last_id ? new mongoose.Types.ObjectId(checkpoint.last_id) : null;
  let batchesCompleted = checkpoint.batches_completed || 0;

  const logPrefix = `[company:${companyId}]`;
  console.log(`${logPrefix} starting — total=${totalDocs} pending=${pendingCount} batchSize=${currentBatchSize}`);

  while (true) {
    const clauses = [...pendingClauses];
    if (lastId) {
      clauses.push({ _id: { $gt: lastId } });
    }
    const batchFilter = { $and: clauses };

    const docs = await Embedding.find(batchFilter)
      .sort({ _id: 1 })
      .limit(currentBatchSize)
      .lean();
    if (!docs.length) {
      break;
    }
    const prepared = docs.map((doc) => ({
      doc,
      content: normaliseContent(doc.content),
    }));

    const emptyItems = prepared.filter((item) => item.content.length === 0);
    if (emptyItems.length) {
      const emptyIds = emptyItems.map((item) => item.doc._id);
      await Embedding.deleteMany({ _id: { $in: emptyIds } });
      duplicatesRemoved += emptyIds.length;
      console.warn(`${logPrefix} removed ${emptyIds.length} empty chunks`);
    }

    const embedItems = prepared.filter((item) => item.content.length > 0);
    const languages = embedItems.length ? await Promise.all(embedItems.map((item) => languageService.detectLanguage(item.content))) : [];

    let vectors = [];
    if (embedItems.length) {
      let attempt = 0;
      while (true) {
        attempt += 1;
        try {
          vectors = await embedBatch(embedItems, companyId);
          break;
        } catch (err) {
          if (err.code === 'EMBED_INVALID') {
            console.warn(`${logPrefix} embedding batch failed (attempt ${attempt}): ${err.message}`);
            if (currentBatchSize > RATE_LIMIT_BATCH_SIZE) {
              currentBatchSize = RATE_LIMIT_BATCH_SIZE;
              console.warn(`${logPrefix} reducing batch size to ${currentBatchSize} due to throttling`);
            }
          } else {
            console.error(`${logPrefix} unexpected embedding error: ${err.message}`);
          }

          if (attempt >= MAX_EMBED_RETRIES) {
            throw new Error(`${logPrefix} aborting after ${attempt} failed embedding attempts`);
          }

          await sleep(backoffDelay(attempt));
        }
      }
    }

    const now = new Date();
    let batchSuccess = 0;
    let batchFailure = 0;

    for (let idx = 0; idx < embedItems.length; idx += 1) {
      const { doc, content } = embedItems[idx];
      const vector = Array.isArray(vectors[idx]) ? vectors[idx] : [];
      const language = languages[idx] || doc.language || "en";
      const companyKey = String(doc.company_id || doc.chatbot_id || companyId || "");
      const chatbotKey = String(doc.chatbot_id || doc.company_id || companyId || "");
      const hash = computeHash(content, companyKey);

      try {
        const result = await Embedding.updateOne(
          { _id: doc._id },
          {
            $set: {
              content,
              embedding: vector,
              embedding_length: vector.length,
              hash,
              company_id: companyKey || null,
              chatbot_id: chatbotKey || null,
              model: EMBEDDING_MODEL,
              status: "ready",
              language,
              updatedAt: now,
            },
            $setOnInsert: {
              createdAt: now,
            },
          },
          { upsert: true },
        );

        if (result.matchedCount === 0) {
          console.warn(`${logPrefix} document ${doc._id} missing during update (skipped)`);
          batchFailure += 1;
        } else {
          batchSuccess += 1;
        }
      } catch (err) {
        if (isDuplicateKeyError(err)) {
          await Embedding.deleteOne({ _id: doc._id });
          duplicatesRemoved += 1;
          batchSuccess += 1;
          console.warn(`${logPrefix} removed duplicate chunk ${doc._id} for hash ${hash}`);
        } else {
          batchFailure += 1;
          console.error(`${logPrefix} failed to update ${doc._id}: ${err.message}`);
        }
      }
    }

    processed += docs.length;
    successes += batchSuccess;
    failures += batchFailure;
    batchesCompleted += 1;
    lastId = docs[docs.length - 1]._id;

    await updateCheckpoint(col, companyId, jobId, {
      last_index: processed,
      last_id: lastId,
      successes,
      failures,
      duplicates_removed: duplicatesRemoved,
      batches_completed: batchesCompleted,
      status: 'running',
    });

    console.log(`${logPrefix} batch complete — processed=${processed} successes=${successes} failures=${failures}`);
  }

  await updateCheckpoint(col, companyId, jobId, {
    status: 'complete',
    completed_at: new Date(),
    last_index: processed,
    last_id: lastId,
    successes,
    failures,
    duplicates_removed: duplicatesRemoved,
    batches_completed: batchesCompleted,
  });

  const cacheStats = await invalidateCompanyCache(companyId);
  console.log(`${logPrefix} finished — successes=${successes} failures=${failures} duplicates_removed=${duplicatesRemoved} cache_deleted=${cacheStats.deleted}`);
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  const args = parseArgs(process.argv.slice(2));
  const jobId = String(args.job || process.env.REEMBED_JOB_ID || `kb-reembed-${Date.now()}`);
  const targetCompany = args.company ? String(args.company) : null;

  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 60000,
    maxPoolSize: 10,
  });

  try {
    await initRedis().catch(() => {});
  } catch (err) {
    console.warn(`[redis] init failed: ${err.message}`);
  }

  const companySet = new Set();
  const companyCandidates = await Embedding.distinct('company_id', { company_id: { $exists: true, $ne: null, $ne: '' } });
  companyCandidates.forEach((t) => companySet.add(String(t)));
  const chatbotCandidates = await Embedding.distinct('chatbot_id', { chatbot_id: { $exists: true, $ne: null, $ne: '' } });
  chatbotCandidates.forEach((t) => companySet.add(String(t)));

  let companies = Array.from(companySet);
  companies.sort();

  if (targetCompany) {
    if (!companySet.has(targetCompany)) {
      console.warn(`company ${targetCompany} not found in existing embeddings; continuing anyway.`);
      companies = [targetCompany];
    } else {
      companies = [targetCompany];
    }
  }

  console.log(`[job:${jobId}] companies queued: ${companies.length}`);

  for (const companyId of companies) {
    try {
      await processCompany(companyId, jobId, { batchSize: DEFAULT_BATCH_SIZE });
    } catch (err) {
      console.error(`[company:${companyId}] job failed: ${err.message}`);
      await updateCheckpoint(await getCheckpointCollection(), companyId, jobId, { status: 'error', error: err.message });
      throw err;
    }
  }

  await mongoose.disconnect();
}

main()
  .then(() => {
    console.log('Re-embed job completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error(`Re-embed job failed: ${err.stack || err.message}`);
    mongoose.disconnect().catch(() => {});
    process.exit(1);
  });











