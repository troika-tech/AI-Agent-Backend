/**
 * Benchmark vector search scores & rank stability across numCandidates values.
 *
 * Measures:
 *  - Avg latency
 *  - TopK IDs + vectorSearchScore
 *  - Recall@K vs 200 baseline
 *  - Jaccard overlap
 *  - Spearman rank correlation & Kendall's tau vs 200 baseline
 *
 * Usage:
 *   npm i mongoose dotenv
 *   MONGODB_URI=... node benchmarkScores.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const { Schema } = mongoose;

// ==== CONFIG ====
const MONGODB_URI = process.env.MONGODB_URI;
const COLLECTION = "embeddingchunks";
const INDEX_NAME = "embedding_vectorIndex";
const EMBEDDING_FIELD = "embedding";
const CONTENT_FIELD = "content";
const CHATBOT_ID_FIELD = "chatbot_id";
const CHATBOT_ID = "688068d45ba526540d784b24"; // STRING per your DB
const TOP_K = 5;
const CANDIDATES_TO_TEST = [50, 100, 200];
const RUNS = 5;
const WARMUP = 2;
const EXPECTED_DIMS = 1536;
const USE_SAMPLE_EMBEDDING_FROM_DB = true;
// If not sampling from DB:
const MANUAL_QUERY_EMBEDDING = Array(EXPECTED_DIMS).fill(0.001);

// ==== MODEL ====
const EmbeddingChunk = mongoose.model(
  "EmbeddingChunk",
  new Schema(
    {
      [CHATBOT_ID_FIELD]: String,
      [EMBEDDING_FIELD]: [Number],
      [CONTENT_FIELD]: String,
    },
    { strict: false }
  ),
  COLLECTION
);

// ==== HELPERS ====
function assertDims(vec, exp) {
  if (!Array.isArray(vec)) throw new Error("queryEmbedding must be an array");
  if (vec.length !== exp) throw new Error(`Embedding dims mismatch: got ${vec.length}, expected ${exp}`);
}

async function getQueryEmbedding() {
  if (!USE_SAMPLE_EMBEDDING_FROM_DB) {
    assertDims(MANUAL_QUERY_EMBEDDING, EXPECTED_DIMS);
    return MANUAL_QUERY_EMBEDDING;
  }
  const doc = await EmbeddingChunk.aggregate([
    { $match: { [CHATBOT_ID_FIELD]: CHATBOT_ID } },
    { $sample: { size: 1 } },
    { $project: { _id: 1, [EMBEDDING_FIELD]: 1 } },
  ]).then(a => a[0]);
  if (!doc) throw new Error(`No docs for chatbot_id='${CHATBOT_ID}'`);
  const vec = doc[EMBEDDING_FIELD];
  assertDims(vec, EXPECTED_DIMS);
  return vec;
}

async function vectorSearch({ numCandidates, queryEmbedding }) {
  const pipeline = [
    {
      $vectorSearch: {
        index: INDEX_NAME,
        path: EMBEDDING_FIELD,
        queryVector: queryEmbedding,
        numCandidates,
        limit: TOP_K,
        filter: { [CHATBOT_ID_FIELD]: CHATBOT_ID },
      },
    },
    {
      $project: {
        _id: 1,
        [CONTENT_FIELD]: 1,
        score: { $meta: "vectorSearchScore" }, // ✅ correct meta for $vectorSearch
      },
    },
  ];

  const t0 = performance.now();
  const docs = await EmbeddingChunk.aggregate(pipeline);
  const t1 = performance.now();
  return { ms: Math.round(t1 - t0), docs };
}

function toIdArray(docs) {
  return docs.map(d => d._id.toString());
}
function toScoreMap(docs) {
  const m = new Map();
  docs.forEach((d, i) => m.set(d._id.toString(), { score: Number(d.score ?? NaN), rank: i + 1 }));
  return m;
}
function jaccard(aIds, bIds) {
  const A = new Set(aIds), B = new Set(bIds);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}
function recallAtK(cIds, gIds) {
  const C = new Set(cIds), G = new Set(gIds);
  let inter = 0;
  for (const x of G) if (C.has(x)) inter++;
  return G.size ? inter / G.size : 0;
}

// Rank correlation utilities
function spearman(goldOrder, testOrder) {
  // Spearman rho on intersection only; handle ties by using observed ranks
  const common = goldOrder.filter(id => testOrder.includes(id));
  if (common.length < 2) return 1;
  const gPos = new Map(goldOrder.map((id, i) => [id, i + 1]));
  const tPos = new Map(testOrder.map((id, i) => [id, i + 1]));
  let sumSq = 0;
  for (const id of common) {
    const d = (gPos.get(id) ?? 0) - (tPos.get(id) ?? 0);
    sumSq += d * d;
  }
  const n = common.length;
  return 1 - (6 * sumSq) / (n * (n * n - 1));
}

function kendallTau(goldOrder, testOrder) {
  const common = goldOrder.filter(id => testOrder.includes(id));
  const n = common.length;
  if (n < 2) return 1;
  const gPos = new Map(goldOrder.map((id, i) => [id, i]));
  const tPos = new Map(testOrder.map((id, i) => [id, i]));
  let concordant = 0, discordant = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = common[i], b = common[j];
      const s1 = Math.sign(gPos.get(a) - gPos.get(b));
      const s2 = Math.sign(tPos.get(a) - tPos.get(b));
      if (s1 === s2) concordant++;
      else discordant++;
    }
  }
  return (concordant - discordant) / (concordant + discordant);
}

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);

    // sanity
    const one = await EmbeddingChunk.findOne({ [CHATBOT_ID_FIELD]: CHATBOT_ID }).lean();
    if (!one) throw new Error(`No docs for chatbot_id='${CHATBOT_ID}'`);

    const queryEmbedding = await getQueryEmbedding();

    const results = {}; // nc -> { avgMs, docs }
    for (const nc of CANDIDATES_TO_TEST) {
      for (let i = 0; i < WARMUP; i++) await vectorSearch({ numCandidates: nc, queryEmbedding });

      const times = [];
      let lastDocs = [];
      for (let i = 0; i < RUNS; i++) {
        const { ms, docs } = await vectorSearch({ numCandidates: nc, queryEmbedding });
        times.push(ms);
        lastDocs = docs;
      }
      results[nc] = {
        avgMs: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
        docs: lastDocs,
        ids: toIdArray(lastDocs),
        scoreMap: toScoreMap(lastDocs),
      };
    }

    // Baseline = 200
    const baseIds = results[200].ids;

    for (const nc of CANDIDATES_TO_TEST) {
      const { avgMs, docs, ids } = results[nc];
      console.log(`\n--- numCandidates=${nc} ---`);
      console.log(`⏱ Avg Latency: ${avgMs} ms`);
      console.log(`🔢 Result count: ${docs.length}`);
      docs.forEach((d, i) => {
        const snip = (d[CONTENT_FIELD] || "").toString().slice(0, 100).replace(/\s+/g, " ");
        console.log(`${i + 1}. score=${Number(d.score).toFixed(6)} | ${snip}... (_id=${d._id})`);
      });
    }

    // Overlaps vs 200
    for (const nc of [50, 100]) {
      const ids = results[nc].ids;
      const rec = recallAtK(ids, baseIds);
      const jac = jaccard(ids, baseIds);
      const rho = spearman(baseIds, ids);
      const tau = kendallTau(baseIds, ids);
      console.log(`\n=== vs 200 baseline | nc=${nc} ===`);
      console.log(`Recall@K: ${(rec * 100).toFixed(1)}%`);
      console.log(`Jaccard:  ${(jac * 100).toFixed(1)}%`);
      console.log(`Spearman: ${rho.toFixed(3)}`);
      console.log(`Kendall τ: ${tau.toFixed(3)}`);
    }

    await mongoose.disconnect();
  } catch (e) {
    console.error("❌ Error:", e);
    process.exit(1);
  }
})();
