// services/productSearchService.js
const Product = require('../models/AzaModel');
const { wrap, stableHash } = require('../utils/cache');
const logger = require('../utils/logger');
// Removed unused generateEmbedding import (add back if semantic rerank introduced)
// const { generateEmbedding } = require('./embeddingService');

// Escape user-provided tokens for safe RegExp construction
function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeDoc(doc) {
  if (!doc) return null;
  return {
    productId: doc.productId ?? null,
    url: doc.url ?? null,
    title: doc.title ?? doc.searchText ?? null,
    image: doc.image ?? null,
    price: doc.price ?? (doc.priceNum ? String(doc.priceNum) : null),
    priceNum: typeof doc.priceNum === 'number' ? doc.priceNum : (doc.priceNum ? Number(doc.priceNum) : null),
    currency: doc.currency ?? 'INR',
    in_stock: typeof doc.in_stock === 'boolean' ? doc.in_stock : true,
    available_sizes: Array.isArray(doc.available_sizes) ? doc.available_sizes : [],
    colors: Array.isArray(doc.colors) ? doc.colors : [],
    score: doc.score ?? null,
    scrapedAt: doc.scrapedAt ?? null,
    description: doc.description ?? null,
  };
}

// Extract simple price intent from natural language query (e.g., "under 15000", "below ₹15k", "between 5k and 10k")
function extractPriceConstraints(rawQ = '') {
  const q = String(rawQ).toLowerCase();
  const cleanNum = (s) => {
    if (!s) return null;
    let v = s.replace(/[,₹\s]/g, '').replace(/rs\.?/g, '');
    // Expand shorthand like 15k => 15000
    v = v.replace(/(\d+)(k)\b/i, (_, n) => String(Number(n) * 1000));
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  // under / below / less than X
  const underMatch = q.match(/\b(under|below|less than)\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9k,\.]*)/i);
  if (underMatch) {
    const maxP = cleanNum(underMatch[2]);
    if (maxP) return { maxPrice: maxP };
  }

  // between X and Y / from X to Y
  const betweenMatch = q.match(/\b(between|from)\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9k,\.]*)\s*(?:and|to|-)\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9k,\.]*)/i);
  if (betweenMatch) {
    const p1 = cleanNum(betweenMatch[2]);
    const p2 = cleanNum(betweenMatch[3]);
    if (p1 && p2) return { minPrice: Math.min(p1, p2), maxPrice: Math.max(p1, p2) };
  }

  // over / above / more than X
  const overMatch = q.match(/\b(over|above|more than)\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9k,\.]*)/i);
  if (overMatch) {
    const minP = cleanNum(overMatch[2]);
    if (minP) return { minPrice: minP };
  }

  return {}; // no constraints
}

const STOP_WORDS = new Set(['do','you','have','something','from','the','a','an','for','and','any','me','some','show','find','search','need','want','get']);

// Domain-specific attribute lexicons
const MATERIALS = ['cotton','silk','linen','georgette','chiffon','velvet','brocade','crepe','organza','net'];
const CATEGORY_PHRASES = [
  'lehenga set','lehenga','saree set','saree','draped skirt set','draped skirt','skirt set','skirt'
];

function extractDomainAttributes(rawQ = '') {
  const lower = rawQ.toLowerCase();
  const materials = MATERIALS.filter(m => lower.includes(m));

  // Age / kids detection (e.g., 2-3 year, 3 years old, kids)
  let isKids = /\b(kids?|girls?|boys?|toddler|child|children|baby)\b/i.test(rawQ);
  const ageRangeMatch = lower.match(/\b(\d{1,2})\s*(?:-|–|to|&)\s*(\d{1,2})\s*(?:year|yr)/);
  if (ageRangeMatch) {
    const a1 = Number(ageRangeMatch[1]);
    const a2 = Number(ageRangeMatch[2]);
    if (!isNaN(a1) && !isNaN(a2) && Math.max(a1,a2) <= 12) isKids = true;
  }
  const singleAgeMatch = lower.match(/\b(\d{1,2})\s*(?:year|yr)\b/);
  if (singleAgeMatch) {
    const age = Number(singleAgeMatch[1]);
    if (!isNaN(age) && age <= 12) isKids = true;
  }

  const categoryPhrasesFound = CATEGORY_PHRASES.filter(p => lower.includes(p));

  return { materials, isKids, categoryPhrasesFound };
}

async function searchProducts(opts = {}) {
  const {
    q,
    productId,
    url,
    size,
    color,
    minPrice,
    maxPrice,
    exactPrice,
    in_stock,
    limit = 8,
    numCandidates = 200,
    debug = false
  } = opts;

  // Cache key: include only relevant inputs to dedupe equivalent queries
  const cacheKeyParts = (() => {
    // Normalize primitives to strings; exclude debug flag
    const payload = {
      q: q ? String(q).trim() : undefined,
      productId: productId ? String(productId) : undefined,
      url: url ? String(url) : undefined,
      size: size ? String(size).toUpperCase() : undefined,
      color: color ? String(color).toLowerCase().trim() : undefined,
      minPrice: minPrice ?? null,
      maxPrice: maxPrice ?? null,
      exactPrice: exactPrice ?? null,
      in_stock: in_stock === true ? true : undefined,
      limit: Number(limit) || 8
    };
    const h = stableHash(payload);
    return ['prod', h];
  })();

  // Infer price constraints from natural language if explicit values not provided
  let inferredMinPrice;
  let inferredMaxPrice;
  if (q && (minPrice === undefined || maxPrice === undefined)) {
    const inferred = extractPriceConstraints(q);
    if (minPrice === undefined && inferred.minPrice !== undefined) inferredMinPrice = inferred.minPrice;
    if (maxPrice === undefined && inferred.maxPrice !== undefined) inferredMaxPrice = inferred.maxPrice;
  }

  if (productId) {
    const p = await Product.findOne({ productId, ...(in_stock === true ? { in_stock: true } : {}) }).lean();
    const results = p ? [normalizeDoc(p)] : [];
    return { results, total: results.length };
  }
  if (url) {
    const p = await Product.findOne({ url, ...(in_stock === true ? { in_stock: true } : {}) }).lean();
    const results = p ? [normalizeDoc(p)] : [];
    return { results, total: results.length };
  }

  const filters = {};
  if (size) filters.available_sizes = { $in: [String(size).toUpperCase()] };
  // Note: Color filtering is handled by text search, not by the colors array field
  if (in_stock === true) filters.in_stock = true;

  if (exactPrice !== undefined && exactPrice !== null) {
    const p = Number(String(exactPrice).replace(/,/g, ''));
    if (!isNaN(p)) filters.priceNum = p;
  } else {
    const pFilter = {};
    const minToUse = (minPrice !== undefined && minPrice !== null) ? minPrice : inferredMinPrice;
    const maxToUse = (maxPrice !== undefined && maxPrice !== null) ? maxPrice : inferredMaxPrice;
    if (minToUse !== undefined && minToUse !== null) pFilter.$gte = Number(String(minToUse).replace(/,/g, ''));
    if (maxToUse !== undefined && maxToUse !== null) pFilter.$lte = Number(String(maxToUse).replace(/,/g, ''));
    if (Object.keys(pFilter).length) filters.priceNum = pFilter;
  }

  const toReturn = (docs, meta = {}) => {
    const mapped = (Array.isArray(docs) ? docs : []).map(normalizeDoc);

    // Remove duplicates based on productId or URL
    const uniqueProducts = [];
    const seenIds = new Set();
    const seenUrls = new Set();

    for (const product of mapped) {
      const productId = product.productId || product._id;
      const productUrl = product.url;

      // Skip if we've already seen this product ID or URL
      if (seenIds.has(productId) || seenUrls.has(productUrl)) {
        continue;
      }

      seenIds.add(productId);
      seenUrls.add(productUrl);
      uniqueProducts.push(product);
    }

    return { results: uniqueProducts, total: uniqueProducts.length, ...(debug ? { debug: meta } : {}) };
  };

  if (q && String(q).trim()) {
    try {
      // Clean the query to remove price-related terms and common words for better text search
      // But preserve gender information for filtering
      const cleanQuery = q
        .replace(/\b(?:under|below|less than|over|above|more than|between|and|to|-)\s*(?:₹|rs\.?|inr)?\s*[0-9][0-9,\.]*\b/gi, '')
        .replace(/\b(?:show me|find|search for|looking for|want|need|buy|get)\b/gi, '')
        // Preserve kids context but normalize variants
        .replace(/\bfor\s+kids\b/gi, ' kids')
        .replace(/\bfor\s+children\b/gi, ' kids')
        .replace(/\bfor\s+adults\b/gi, ' adults')
        .replace(/\s+/g, ' ')
        .trim();

      const { materials, isKids, categoryPhrasesFound } = extractDomainAttributes(cleanQuery);

      // Synonym expansion (lightweight) for query tokens
      const synonymMap = {
        saree: ['sari'], sari: ['saree'], lehenga: ['ghagra','lengha'], ghagra: ['lehenga'], kids: ['children','child','girl','boy'], 'co ord': ['co-ord','coord'], 'co-ord': ['co ord','coord']
      };
      const expandedTerms = [];
      cleanQuery.split(/\s+/).forEach(tok => {
        const lower = tok.toLowerCase();
        if (synonymMap[lower]) expandedTerms.push(...synonymMap[lower]);
      });

      // ------------------ Atlas $search stage ------------------
      const searchStage = {
        $search: {
          index: 'product_text_search',
          compound: {
            must: [
              {
                text: {
                  query: cleanQuery,
                  path: ['title', 'tokens', 'description', 'searchText'],
                  fuzzy: { maxEdits: 1 }
                }
              }
            ],
            should: [],
            filter: []
          }
        }
      };

      // Boost materials (stronger on materials field)
      materials.forEach(mat => {
        searchStage.$search.compound.should.push({
          text: {
            query: mat,
            path: ['materials', 'title', 'description', 'searchText'],
            score: { boost: { value: 4 } }
          }
        });
      });

      // Boost category phrases (direct category field + text fields)
      categoryPhrasesFound.forEach(phrase => {
        searchStage.$search.compound.should.push({
          text: {
            query: phrase,
            path: ['category', 'subCategories', 'title', 'description', 'searchText'],
            score: { boost: { value: 6 } }
          }
        });
      });

      // Expanded terms (manual synonyms for now)
      expandedTerms.forEach(term => {
        searchStage.$search.compound.should.push({
          text: {
            query: term,
            path: ['title', 'tokens', 'description', 'searchText']
          }
        });
      });

      if (isKids) {
        searchStage.$search.compound.should.push({ text: { query: 'kids', path: ['title', 'tokens', 'description', 'searchText'] } });
        searchStage.$search.compound.should.push({ text: { query: 'girl', path: ['title', 'tokens', 'description', 'searchText'] } });
        searchStage.$search.compound.should.push({ text: { query: 'boy', path: ['title', 'tokens', 'description', 'searchText'] } });
      }

      // Apply available_sizes filter if present (search filter)
      if (filters.available_sizes) {
        // index stores sizes as strings; we use text match on field
        // (Atlas also supports array fields; adjust if you indexed differently)
        searchStage.$search.compound.filter.push({ text: { path: 'available_sizes', query: size } });
      }

      // Price range filter (range on priceNum)
      if (filters.priceNum !== undefined) {
        if (typeof filters.priceNum === 'number') {
          searchStage.$search.compound.filter.push({
            range: { path: 'priceNum', gte: filters.priceNum, lte: filters.priceNum }
          });
        } else if (filters.priceNum && typeof filters.priceNum === 'object') {
          const rangeFilter = { path: 'priceNum' };
          if (filters.priceNum.$gte !== undefined) rangeFilter.gte = filters.priceNum.$gte;
          if (filters.priceNum.$lte !== undefined) rangeFilter.lte = filters.priceNum.$lte;
          if (filters.priceNum.$gt !== undefined) rangeFilter.gt = filters.priceNum.$gt;
          if (filters.priceNum.$lt !== undefined) rangeFilter.lt = filters.priceNum.$lt;
          if (Object.keys(rangeFilter).length > 1) {
            searchStage.$search.compound.filter.push({ range: rangeFilter });
          }
        }
      }

      // Optional color filter (light weight) - rely on text index; only if simple token
      if (color && /^[a-zA-Z\s]{3,20}$/.test(color)) {
        searchStage.$search.compound.filter.push({
          text: { path: ['title', 'description', 'searchText'], query: color.toLowerCase() }
        });
      }

      const aggregation = [
        searchStage,
        { $limit: limit },
        { $project: { _id: 1, productId: 1, title: 1, description: 1, url: 1, image: 1, price: 1, priceNum: 1, currency: 1, in_stock: 1, available_sizes: 1, colors: 1, scrapedAt: 1, searchText: 1, embedding: 1, score: { $meta: 'searchScore' } } }
      ];

      const res = await Product.aggregate(aggregation);

      if (res && res.length) {
        // Apply filters to Atlas search results
        let filteredRes = res;

        // Apply in_stock filter
        if (filters.in_stock) {
          filteredRes = filteredRes.filter(doc => doc.in_stock === true);
        }

        // -------------------- STRICT GENDER & AGE FILTERING --------------------
        // If user explicitly asked for men/women/kids, enforce hard filtering (never mix)
        const wantsMen = /\b(men|male|man)\b/i.test(cleanQuery);
        const wantsWomen = /\b(women|female|woman)\b/i.test(cleanQuery);
        const wantsKids = /\b(kids?|girls?|boys?|child|children|toddler|baby)\b/i.test(cleanQuery) || isKids;

        if (wantsMen) {
          filteredRes = filteredRes.filter(doc => {
            const t = (doc.title || '').toLowerCase();
            const d = (doc.description || '').toLowerCase();
            return (t.includes('men') || t.includes('male') || d.includes('men') || d.includes('male'))
              && !t.includes('women') && !t.includes('girls') && !d.includes('women') && !d.includes('girls');
          });
        }

        if (wantsWomen) {
          filteredRes = filteredRes.filter(doc => {
            const t = (doc.title || '').toLowerCase();
            const d = (doc.description || '').toLowerCase();
            return (t.includes('women') || t.includes('girls') || t.includes('female') || d.includes('women') || d.includes('girls') || d.includes('female'))
              && !t.includes('men') && !t.includes('boys') && !d.includes('men') && !d.includes('boys');
          });
        }

        if (wantsKids) {
          filteredRes = filteredRes.filter(doc => {
            const t = (doc.title || '').toLowerCase();
            const d = (doc.description || '').toLowerCase();
            return /\b(kids?|girls?|boys?|child|children|toddler|baby)\b/.test(t) || /\b(kids?|girls?|boys?|child|children|toddler|baby)\b/.test(d);
          });
        }
        // -----------------------------------------------------------------------

        if (filteredRes.length > 0) {
          const maxResults = Math.min(Number(limit) || 8, 12); // respect provided limit but cap
          filteredRes = filteredRes.slice(0, maxResults);
          return toReturn(filteredRes, { tier: 'atlas', cleanQuery, materials, categoryPhrasesFound, expandedTerms });
        }
      }
    } catch (err) {
      console.error("Atlas text search failed, falling back.", err.message);
    }
  }

  try {
    // If we have a query but Atlas search failed, try to include text search in fallback
    if (q && String(q).trim()) {
      const cleanQuery = q
        .replace(/\b(?:under|below|less than|over|above|more than|between|and|to|-)\s*(?:₹|rs\.?|inr)?\s*[0-9][0-9,\.]*\b/gi, '')
        .replace(/\b(?:show me|find|search for|looking for|want|need|buy|get)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanQuery) {
        // Split the query into individual words for more flexible matching
        // Normalize & -> and to increase match probability with titles
        const normalizedQuery = cleanQuery.replace(/&/g, ' and ');
        const { materials, isKids, categoryPhrasesFound } = extractDomainAttributes(normalizedQuery);
        const rawTokens = normalizedQuery.split(/\s+/)
          .map(t => t.replace(/[?.,!;:]+$/g, '')) // strip trailing punctuation
          .filter(t => t.length > 2);
        const words = rawTokens.filter(w => !STOP_WORDS.has(w.toLowerCase()));
        // Add material & category phrase single-token forms to word list for fallback if missing
        materials.forEach(m => { if (!words.includes(m)) words.push(m); });
        categoryPhrasesFound.forEach(p => {
          const primary = p.split(/\s+/)[0];
          if (primary && !words.includes(primary)) words.push(primary);
        });
        if (isKids && !words.includes('kids')) words.push('kids');
        const escapedWords = words.map(w => escapeRegex(w));

        if (words.length > 0) {
          // Create stricter text search that requires ALL words to be present in title
          const textSearchFilter = {
            $and: escapedWords.map(word => ({
              title: { $regex: word, $options: 'i' }
            }))
          };

          // Combine text search with other filters
          const combinedFilters = Object.keys(filters).length > 0
            ? { $and: [textSearchFilter, filters] }
            : textSearchFilter;

          const docs = await Product.find(combinedFilters).sort({ scrapedAt: -1 }).limit(Number(limit)).lean();

          // If we found results with strict matching, return them
          if (docs.length > 0) {
            return toReturn(docs, { tier: 'fallback-strict', cleanQuery, words });
          }

          // If no results with strict matching, try more flexible matching but with relevance scoring
          if (process.env.LOG_CACHE === 'true') logger.info('No strict matches found, trying flexible matching...');
          const flexibleAlternation = escapedWords.join('|');
          const flexibleFilter = {
            $or: [
              { title: { $regex: flexibleAlternation, $options: 'i' } },
              { description: { $regex: flexibleAlternation, $options: 'i' } },
              { searchText: { $regex: flexibleAlternation, $options: 'i' } }
            ]
          };

          // Create a copy of filters without in_stock to avoid conflicts
          const filtersWithoutStock = { ...filters };
          delete filtersWithoutStock.in_stock;

          const flexibleCombinedFilters = Object.keys(filtersWithoutStock).length > 0
            ? { $and: [flexibleFilter, filtersWithoutStock] }
            : flexibleFilter;

          const flexibleDocs = await Product.find(flexibleCombinedFilters).sort({ scrapedAt: -1 }).limit(Number(limit * 2)).lean();

          // Score and filter results based on relevance
          const scoredDocs = flexibleDocs.map(doc => {
            let score = 0;
            const title = (doc.title || '').toLowerCase();
            const description = (doc.description || '').toLowerCase();
            const searchText = (doc.searchText || '').toLowerCase();

            // Much higher score for exact word matches in title
            words.forEach(word => {
              const lw = word.toLowerCase();
              if (title.includes(lw)) score += 8;
              if (description.includes(lw)) score += 2;
              if (searchText.includes(lw)) score += 1;
            });

            // Bonus for exact phrase match (case-insensitive)
            const lcQuery = cleanQuery.toLowerCase();
            if (title.includes(lcQuery)) score += 12;
            if (description.includes(lcQuery)) score += 4;

            // Phrase boosts for detected category phrases
            categoryPhrasesFound.forEach(phrase => {
              const lp = phrase.toLowerCase();
              if (title.includes(lp)) score += 6;
              else if (description.includes(lp)) score += 3;
            });
            materials.forEach(mat => {
              if (title.includes(mat)) score += 4;
              else if (description.includes(mat)) score += 2;
            });
            if (isKids) {
              if (/\b(kids?|girls?|boys?|toddler|child|children|baby)\b/.test(title)) score += 5;
              else if (/\b(kids?|girls?|boys?|toddler|child|children|baby)\b/.test(description)) score += 2;
            }

            // Soft penalty if not all words are present in title
            const wordsInTitle = words.filter(word => title.includes(word.toLowerCase())).length;
            if (wordsInTitle < words.length) {
              score = Math.max(0, score - 3);
            }

            const wantsMen = /\b(men|male|man)\b/i.test(cleanQuery);
            const wantsWomen = /\b(women|female|woman)\b/i.test(cleanQuery);
            if (wantsMen) {
              if ((title.includes('men') || title.includes('male')) && !title.includes('women') && !title.includes('girls')) score += 4;
            } else if (wantsWomen) {
              if ((title.includes('women') || title.includes('girls') || title.includes('female')) && !title.includes('men') && !title.includes('boys')) score += 4;
            }

            if (color) {
              const lcColor = color.toLowerCase();
              if (title.includes(lcColor)) score += 3;
              else if (description.includes(lcColor)) score += 1;
            }

            return { ...doc, relevanceScore: score };
          });

          // Sort by relevance score and return top results (calibrated)
          const minScore = Math.max(5, words.length * 2);
          let topResults = scoredDocs
            .filter(doc => doc.relevanceScore >= minScore)
            .sort((a, b) => b.relevanceScore - a.relevanceScore);

          // -------------------- STRICT FILTERING FOR FALLBACK --------------------
          // If user explicitly asked for men/women/kids, enforce hard filtering here too
          const fbWantsMen = /\b(men|male|man)\b/i.test(cleanQuery);
          const fbWantsWomen = /\b(women|female|woman)\b/i.test(cleanQuery);
          const fbWantsKids = /\b(kids?|girls?|boys?|child|children|toddler|baby)\b/i.test(cleanQuery) || isKids;

          if (fbWantsMen) {
            topResults = topResults.filter(doc => {
              const t = (doc.title || '').toLowerCase();
              const d = (doc.description || '').toLowerCase();
              return (t.includes('men') || t.includes('male') || d.includes('men') || d.includes('male'))
                && !t.includes('women') && !t.includes('girls') && !d.includes('women') && !d.includes('girls');
            });
          }

          if (fbWantsWomen) {
            topResults = topResults.filter(doc => {
              const t = (doc.title || '').toLowerCase();
              const d = (doc.description || '').toLowerCase();
              return (t.includes('women') || t.includes('girls') || t.includes('female') || d.includes('women') || d.includes('girls') || d.includes('female'))
                && !t.includes('men') && !t.includes('boys') && !d.includes('men') && !d.includes('boys');
            });
          }

          if (fbWantsKids) {
            topResults = topResults.filter(doc => {
              const t = (doc.title || '').toLowerCase();
              const d = (doc.description || '').toLowerCase();
              return /\b(kids?|girls?|boys?|child|children|toddler|baby)\b/.test(t) || /\b(kids?|girls?|boys?|child|children|toddler|baby)\b/.test(d);
            });
          }
          // -----------------------------------------------------------------------

          // Apply in_stock filter if it was in the original filters
          if (filters.in_stock) {
            topResults = topResults.filter(doc => doc.in_stock === true);
          }

          // Only return results if we have high-quality matches
          const maxResults = Math.min(Number(limit) || 8, 12);
          if (topResults.length === 0) {
            // Fallback to raw flexibleDocs (still deduped later) limited by maxResults
            topResults = flexibleDocs.slice(0, maxResults);
          } else {
            topResults = topResults.slice(0, maxResults);
          }

          return toReturn(topResults, { tier: 'fallback-flexible', cleanQuery, words });
        }
      }
    }

    // Regular fallback without text search
    const docs = await Product.find(filters).sort({ scrapedAt: -1 }).limit(Number(limit)).lean();
    return toReturn(docs, { tier: 'filters-only' });
  } catch (err) {
    logger.warn(`Fallback search error: ${err.message}`);
    return { results: [], total: 0, ...(debug ? { debug: { error: err.message } } : {}) };
  }
}

// Wrap searchProducts with cache. Expose a cached version for callers that want caching by default.
async function cachedSearchProducts(opts = {}) {
  return wrap({
    keyParts: cacheKeyPartsFromOpts(opts),
    ttlSec: 120,
    fn: async () => searchProducts(opts)
  });
}

function cacheKeyPartsFromOpts(opts = {}) {
  const { q, productId, url, size, color, minPrice, maxPrice, exactPrice, in_stock, limit } = opts;
  const payload = {
    q: q ? String(q).trim() : undefined,
    productId: productId ? String(productId) : undefined,
    url: url ? String(url) : undefined,
    size: size ? String(size).toUpperCase() : undefined,
    color: color ? String(color).toLowerCase().trim() : undefined,
    minPrice: minPrice ?? null,
    maxPrice: maxPrice ?? null,
    exactPrice: exactPrice ?? null,
    in_stock: in_stock === true ? true : undefined,
    limit: Number(limit) || 8
  };
  const h = stableHash(payload);
  return ['prod', h];
}

module.exports = { searchProducts, cachedSearchProducts, cacheKeyPartsFromOpts };
