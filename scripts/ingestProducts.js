// scripts/ingestProducts.js
// Usage: node scripts/ingestProducts.js /full/path/to/products.json
// Requires: ../models/Product and ../lib/embed
// Run after ensuring your app's Mongo connection logic is available (example below).

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Product = require('../models/AzaModel'); // path adjust if needed
const { getEmbedding } = require('../lib/embed'); // unified embedding helper

if (!process.argv[2]) {
  console.error('Usage: node scripts/ingestProducts.js /path/to/products.json');
  process.exit(1);
}

const JSON_PATH = path.resolve(process.argv[2]);
const BATCH_SIZE = 50; // how many embeddings per batch
const MONGO_URI = ".";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeProduct(raw) {
  const priceNum = raw.price
    ? Number(String(raw.price).replace(/[^\d.]/g, '')) || null
    : null;

  const available_sizes = Array.isArray(raw.available_sizes)
    ? raw.available_sizes.map((s) => String(s).trim().toUpperCase())
    : [];

  // colors: prefer raw field, else try nothing (you can improve later)
  const colors = Array.isArray(raw.colors)
    ? raw.colors.map((c) => String(c).trim().toLowerCase())
    : [];

  const searchText = (
    (raw.title || '') +
    ' ' +
    (raw.description || '') +
    ' ' +
    (raw.productId || '')
  )
    .trim()
    .toLowerCase();

  return {
    productId: raw.productId ? String(raw.productId) : undefined,
    title: raw.title || 'Untitled product',
    description: raw.description || '',
    url: raw.url || '',
    image: raw.image || '',
    price: raw.price ? String(raw.price) : '',
    priceNum,
    currency: raw.currency || 'INR',
    in_stock: typeof raw.in_stock === 'boolean' ? raw.in_stock : true,
    available_sizes,
    colors,
    scrapedAt: raw.scrapedAt ? new Date(raw.scrapedAt) : new Date(),
    searchText,
  };
}

async function upsertProducts(normalizedProducts) {
  const ops = normalizedProducts.map((p) => {
    const filter = p.productId ? { productId: p.productId } : { url: p.url };
    return {
      updateOne: {
        filter,
        update: { $set: p },
        upsert: true,
      },
    };
  });

  // chunked bulkWrite to avoid huge single op
  for (let i = 0; i < ops.length; i += 500) {
    const chunk = ops.slice(i, i + 500);
    console.log(`Writing products ${i + 1}..${i + chunk.length}`);
    await Product.bulkWrite(chunk);
  }
}

async function generateAndSaveEmbeddingsForMissing(batchSize = BATCH_SIZE) {
  const cursor = Product.find({ $or: [{ embedding: null }, { embedding: { $exists: false } }] })
    .cursor();

  let batch = [];
  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= batchSize) {
      await processBatch(batch);
      batch = [];
    }
  }
  if (batch.length) await processBatch(batch);
}

async function processBatch(products) {
  console.log(`Generating embeddings for batch of ${products.length} products...`);
  // prepare texts
  const texts = products.map((p) => p.searchText || `${p.title} ${p.description}`);

  // generate embeddings one-by-one (adjust if your getEmbeddings supports batch)
  const embeddings = [];
  for (let i = 0; i < texts.length; i++) {
    try {
      const emb = await getEmbedding(texts[i]);
      embeddings.push(emb);
    } catch (err) {
      console.error('Embedding failed for item', products[i].productId || products[i].url, err.message || err);
      embeddings.push(null);
      // small backoff on error
      await sleep(500);
    }
  }

  // save embeddings
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const emb = embeddings[i];
    if (emb && Array.isArray(emb) && emb.length) {
      p.embedding = emb;
      try {
        await p.save();
      } catch (err) {
        console.error('Failed saving embedding for', p.productId || p._id, err.message || err);
      }
    } else {
      console.log('Skipping save for missing embedding:', p.productId || p._id);
    }
  }
  // small pause to avoid hitting rate limits
  await sleep(250);
}

async function main() {
  try {
    console.log('Connecting to mongo:', MONGO_URI);
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    if (!Array.isArray(raw)) {
      throw new Error('Expected JSON file to contain an array of products.');
    }

    console.log(`Loaded ${raw.length} products from file.`);

    // normalize + upsert
    const normalized = raw.map(normalizeProduct);
    await upsertProducts(normalized);
    console.log('Upsert complete.');

    // generate embeddings for any products missing them
    await generateAndSaveEmbeddingsForMissing();

    console.log('Done. Close Mongo connection.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Ingest error:', err);
    process.exit(1);
  }
}

main();


