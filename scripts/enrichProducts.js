// scripts/enrichProducts.js
// Batch enrichment of product documents with derived attributes & tokens
// Usage: node scripts/enrichProducts.js
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../db');
const Product = require('../models/AzaModel');

const TOKEN_VERSION = 1; // bump when logic changes

const MATERIAL_PATTERNS = [
  'cotton','silk','linen','georgette','chiffon','velvet','brocade','crepe','organza','net','satin','rayon','jersey','denim','tulle'
];
const CATEGORY_PATTERNS = [
  'lehenga set','lehenga','saree set','saree','draped skirt set','draped skirt','skirt set','skirt','gown','kurta set','kurta','anarkali','sharara','co ord set','co-ord set','coord set','jacket','dress','top','blouse'
];
const OCCASION_PATTERNS = ['wedding','bridal','festive','party','casual','formal','reception','sangeet','mehndi'];

const STOP_WORDS = new Set(['the','and','for','with','from','set','a','an','of','to','in','by','on','at','amp']);

function normalize(str='') { return str.toLowerCase(); }
function tokenize(str='') {
  return str
    .toLowerCase()
    .replace(/&/g,' and ')
    .replace(/[^a-z0-9\s-]/g,' ') // remove special
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

function detectMaterials(text) {
  const lower = text.toLowerCase();
  const found = new Set();
  MATERIAL_PATTERNS.forEach(m => { if (lower.includes(m)) found.add(m); });
  return Array.from(found);
}
function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const cat of CATEGORY_PATTERNS) {
    if (lower.includes(cat)) return cat; // first strongest
  }
  return null;
}
function detectSubCategories(text) {
  const lower = text.toLowerCase();
  const subs = new Set();
  CATEGORY_PATTERNS.forEach(c => { if (lower.includes(c)) subs.add(c); });
  return Array.from(subs);
}
function detectKids(text) {
  return /(\bkids?|girls?|boys?|toddler|child|children|baby|age \d{1,2}\b)/i.test(text);
}
function detectGender(text) {
  const lower = text.toLowerCase();
  const hasMen = /(\bmen\b|\bmale\b|\bboy?s?\b)/.test(lower);
  const hasWomen = /(\bwomen\b|\bfemale\b|\bgirl?s?\b)/.test(lower);
  if (hasMen && hasWomen) return 'unisex';
  if (hasWomen) return 'women';
  if (hasMen) return 'men';
  return null;
}
function detectOccasion(text) {
  const lower = text.toLowerCase();
  const o = new Set();
  OCCASION_PATTERNS.forEach(p => { if (lower.includes(p)) o.add(p); });
  return Array.from(o);
}

function buildTokens(doc) {
  const base = [doc.title, doc.description, doc.searchText].filter(Boolean).join(' ');
  const mats = doc.materials || [];
  const cat = doc.category ? [doc.category] : [];
  const subs = doc.subCategories || [];
  const occ = doc.occasion || [];
  const raw = base + ' ' + mats.join(' ') + ' ' + cat.join(' ') + ' ' + subs.join(' ') + ' ' + occ.join(' ');
  const tokens = Array.from(new Set(tokenize(raw)));
  return tokens.slice(0, 400); // cap
}

async function enrichBatch(limit = 500) {
  const query = { $or: [ { tokensVersion: { $lt: TOKEN_VERSION } }, { tokensVersion: { $exists: false } } ] };
  const docs = await Product.find(query).limit(limit).lean();
  if (!docs.length) return 0;

  const bulk = Product.collection.initializeUnorderedBulkOp();
  docs.forEach(d => {
    const combined = [d.title, d.description, d.searchText].filter(Boolean).join(' ');
    const materials = detectMaterials(combined);
    const category = detectCategory(combined);
    const subCategories = detectSubCategories(combined);
    const isKids = detectKids(combined);
    const gender = detectGender(combined);
    const occasion = detectOccasion(combined);
    const tokens = buildTokens({ materials, category, subCategories, occasion, title: d.title, description: d.description, searchText: d.searchText });

    bulk.find({ _id: d._id }).updateOne({
      $set: {
        materials, category, subCategories, isKids, gender, occasion, tokens, tokensVersion: TOKEN_VERSION
      }
    });
  });

  await bulk.execute();
  return docs.length;
}

(async () => {
  await connectDB();
  console.log('Starting enrichment...');
  let total = 0; let batch = 0;
  do {
    batch = await enrichBatch();
    total += batch;
    console.log(`Enriched batch: ${batch}, total: ${total}`);
  } while (batch > 0);
  console.log('Enrichment complete. Total updated:', total);
  await mongoose.disconnect();
})();
