// services/productIntentService.js
// Product intent + filter extractor with sizes, colors, and price-range parsing

const languageService = require('./languageService');

const PRODUCT_KEYWORDS = [
  "buy","price","cost","available","in stock","show me","sizes","size",
  "catalog","product","add to cart","where can i buy","how much","price of",
  "color","colour"
];

// Simple color synonyms list (add more if needed)
const COLORS = [
  "red","maroon","crimson","burgundy","scarlet",
  "pink","hot pink","baby pink","rose","fuchsia","magenta",
  "orange","peach","coral","rust","apricot","salmon",
  "yellow","gold","mustard","amber",
  "green","lime","olive","emerald","forest green","mint","teal",
  "blue","navy","sky blue","royal blue","turquoise","cyan","indigo","denim",
  "purple","violet","lavender","mauve","plum",
  "brown","beige","tan","khaki","camel","coffee","chocolate",
  "white","ivory","cream","off white",
  "grey","gray","charcoal","ash","silver","slate",
  "black","jet black"
];

// Prefer multi-word color matches first
const COLOR_SYNONYMS = COLORS.slice().sort((a,b)=>b.length-a.length);

// sizes: XS → 6XL + kids ranges (flexible)
const SIZE_REGEX = /\b(?:xs|s|m|l|xl|xxl|3xl|4xl|5xl|6xl|\d+\s*-\s*\d+\s*(?:y|yr|yrs|year|years|m|mo))\b/i;

// Treat long numeric tokens as possible IDs (6+ digits) or URLs
const ID_OR_URL_REGEX = /(https?:\/\/\S+|\b\d{6,}\b)/i;

// Price-number regex (supports commas and decimals)
const PRICE_NUMBER_REGEX = /(?:\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/;

// Ordered price range regexes (detect ranges first)
const PRICE_RANGE_REGEXES = [
  { re: /\b(?:under|below|less than)\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,\.]*)\b/i, type: 'max' },
  { re: /\b(?:over|above|more than)\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,\.]*)\b/i, type: 'min' },
  { re: /\bbetween\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,\.]*)\s*(?:and|to|\-)\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,\.]*)\b/i, type: 'between' },
  // fallback "1000-5000"
  { re: /\b([0-9][0-9,\.]{2,})\s*[-]\s*([0-9][0-9,\.]{2,})\b/i, type: 'between' }
];

function parseNumber(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/,/g, '').trim();
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

async function isProductQuery(q) {
  if (!q) return false;
  
  // Process query through language service
  const processedQuery = await languageService.processQuery(q);
  const s = processedQuery.translatedQuery.toLowerCase();

  // obvious markers: id/url, size, price, buy etc.
  if (ID_OR_URL_REGEX.test(q)) return true;
  if (s.includes("size") || s.includes("price") || s.includes("in stock") || s.includes("buy")) return true;

  // colors -> likely a product query
  for (const syn of COLOR_SYNONYMS) if (s.includes(syn)) return true;

  // product keywords
  for (const k of PRODUCT_KEYWORDS) if (s.includes(k)) return true;

  return false;
}

async function extractProductFilters(q) {
  const filters = {};
  if (!q) return filters;
  
  // Process query through language service
  const processedQuery = await languageService.processQuery(q);
  const raw = processedQuery.translatedQuery;
  const lower = raw.toLowerCase();

  // 1) price ranges FIRST so numbers are captured as price, not IDs
  for (const pr of PRICE_RANGE_REGEXES) {
    const m = raw.match(pr.re);
    if (!m) continue;
    if (pr.type === 'max' && m[1]) {
      const v = parseNumber(m[1]);
      if (v !== null) filters.maxPrice = v;
    } else if (pr.type === 'min' && m[1]) {
      const v = parseNumber(m[1]);
      if (v !== null) filters.minPrice = v;
    } else if (pr.type === 'between' && m[1] && m[2]) {
      const a = parseNumber(m[1]), b = parseNumber(m[2]);
      if (a !== null && b !== null) {
        filters.minPrice = Math.min(a,b);
        filters.maxPrice = Math.max(a,b);
      }
    }
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) break;
  }

  // 2) size
  const sizeMatch = raw.match(SIZE_REGEX);
  if (sizeMatch) filters.size = sizeMatch[0].toUpperCase();

  // 3) color - pick first matching synonym
  for (const syn of COLOR_SYNONYMS) {
    if (lower.includes(syn)) { filters.color = syn; break; }
  }

  // 4) explicit price if no range found
  if (filters.minPrice === undefined && filters.maxPrice === undefined) {
    const explicitPriceMatch = raw.match(new RegExp(`(?:₹|rs\\.?|inr)?\\s*(${PRICE_NUMBER_REGEX.source})`, 'i'));
    if (explicitPriceMatch && explicitPriceMatch[1]) {
      const num = parseNumber(explicitPriceMatch[1]);
      if (num !== null) filters.exactPrice = num;
    }
  }

  // 5) url if present
  const urlMatch = raw.match(/https?:\/\/\S+/i);
  if (urlMatch) filters.url = urlMatch[0];

  // 6) productId — only if explicit phrase or long numeric token (>=6 digits) and no prices detected
  const explicitIdMatch = raw.match(/\b(?:product(?:[-_\s]?id)?|id)\b[:\s]*([0-9]{6,})\b/i);
  if (explicitIdMatch && explicitIdMatch[1]) {
    filters.productId = explicitIdMatch[1];
  } else {
    const bareNumMatch = raw.match(/\b([0-9]{6,})\b/);
    if (bareNumMatch && !filters.maxPrice && !filters.minPrice && !filters.exactPrice) {
      filters.productId = bareNumMatch[1];
    }
  }

  return filters;
}

module.exports = { isProductQuery, extractProductFilters };
