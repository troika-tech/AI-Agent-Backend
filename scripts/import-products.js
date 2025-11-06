// scripts/import-products.js
// Usage: node scripts/import-products.js path/to/products.json
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const normalizeAza = require('../lib/normalizeAza');
const { getEmbedding } = require('../lib/embed');
const AzaProduct = require('../models/AzaModel');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/aza';
const BATCH_DELAY_MS = 250; // delay between embedding calls to be nice

async function connectDb() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('✅ Connected to MongoDB');
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function upsertOne(normalized) {
  const existing = await AzaProduct.findOne({ productId: normalized.productId }).lean();

  const needEmbedding = !normalized.embedding || normalized.embedding.length === 0;
  const hashChanged = !existing || existing.searchTokensHash !== normalized.searchTokensHash;

  let embedding = normalized.embedding || [];
  if (needEmbedding || hashChanged) {
    const textForEmbed = `${normalized.title}. ${normalized.description || ''}`.slice(0, 8000);
    const emb = await getEmbedding(textForEmbed);
    if (emb && emb.length) embedding = emb;
    else if (existing?.embedding?.length) embedding = existing.embedding;
    await sleep(BATCH_DELAY_MS);
  } else {
    embedding = existing.embedding || [];
  }

  const updateDoc = {
    title: normalized.title,
    productUrl: normalized.productUrl,
    image: normalized.image,
    price_from: normalized.price_from,
    currency: normalized.currency || 'INR',
    in_stock: !!normalized.in_stock,
    available_sizes: normalized.available_sizes || [],
    description: normalized.description || '',
    searchTokensHash: normalized.searchTokensHash || '',
    embedding,
    scrapedAt: normalized.scrapedAt || new Date()
  };

  const saved = await AzaProduct.findOneAndUpdate(
    { productId: normalized.productId },
    { $set: updateDoc },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return { productId: saved.productId, hasEmbedding: saved.embedding?.length > 0 };
}

async function importFile(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${abs}`);
  const raw = fs.readFileSync(abs, 'utf8');
  const items = JSON.parse(raw);

  if (!Array.isArray(items)) throw new Error('File must be an array of product objects');

  console.log(`📦 Importing ${items.length} products...`);
  for (let i = 0; i < items.length; i++) {
    try {
      const normalized = normalizeAza(items[i]);
      if (!normalized.productId) {
        console.warn(`[${i+1}] Skipped: missing productId`);
        continue;
      }
      const res = await upsertOne(normalized);
      console.log(`[${i+1}/${items.length}] Upserted product ${res.productId}, embedding: ${res.hasEmbedding}`);
    } catch (err) {
      console.error(`[${i+1}] Error:`, err.message);
    }
  }
  console.log('✅ Import finished');
}

(async () => {
  try {
    const file = process.argv[2];
    if (!file) {
      console.error('Usage: node scripts/import-products.js path/to/products.json');
      process.exit(1);
    }
    await connectDb();
    await importFile(file);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(2);
  }
})();
