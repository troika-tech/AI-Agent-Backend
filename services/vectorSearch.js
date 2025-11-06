const mongoose = require('mongoose');
const { getEmbedding } = require('../lib/embed');
const languageService = require('../services/languageService');
const { cosineSimilarity } = require('../utils/cosine');
require('../models/Embedding');
const AzaModel = require('../models/AzaModel');

const logger = require('../utils/logger');

const COLLECTION = 'embeddingchunks';
const DEFAULT_VECTOR_INDEX = process.env.ATLAS_VECTOR_INDEX_NAME || 'embedding_vectorIndex';
const VECTOR_PATH = process.env.ATLAS_VECTOR_PATH || 'embedding';
const TEXT_INDEX = process.env.ATLAS_TEXT_INDEX_NAME || 'kb_text';

const VECTOR_MAX_TIME_MS = Number(process.env.VECTOR_MAX_TIME_MS || 5000);
const DEFAULT_TOP_K = Number(process.env.RETRIEVAL_TOP_K || 16);
const RERANK_LIMIT = Number(process.env.RETRIEVAL_RERANK_LIMIT || 8);
const VECTOR_WEIGHT = Number(process.env.RETRIEVAL_VECTOR_WEIGHT || 1.2);
const PRIMARY_THRESHOLD = Number(process.env.RETRIEVAL_PRIMARY_THRESHOLD || 0.55);
const SECONDARY_THRESHOLD = Number(process.env.RETRIEVAL_SECONDARY_THRESHOLD || 0.4);
const LANG_BOOST = Number(process.env.RETRIEVAL_LANGUAGE_BOOST || 0.05);
const FALLBACK_LIMIT = Number(process.env.RETRIEVAL_FALLBACK_LIMIT || 3);
const FUSION_DISABLED = process.env.RETRIEVAL_DISABLE_FUSION === 'true';
const KEYWORD_DISABLED = process.env.RETRIEVAL_DISABLE_KEYWORD === 'true';

function time(label, fn) {
  const start = Date.now();
  return fn().finally(() => {
    const ms = Date.now() - start;
    logger.info(`TIMING ${label} ms=${ms}`);
  });
}

function buildProjection(fields = []) {
  const set = new Set(['_id', 'content', 'chatbot_id', 'language']);
  (fields || []).forEach((field) => set.add(field));
  const projection = { score: 1 };
  for (const field of set) {
    projection[field] = 1;
  }
  return projection;
}

async function runVectorSearch({ chatbotId, vector, k = DEFAULT_TOP_K, fields = ['content'], indexName = DEFAULT_VECTOR_INDEX } = {}) {
  if (!Array.isArray(vector) || vector.length === 0) return [];

  const db = mongoose.connection.db;
  const filter = {};
  if (chatbotId) filter.chatbot_id = String(chatbotId);

  const pipeline = [
    {
      $vectorSearch: {
        index: indexName,
        path: VECTOR_PATH,
        queryVector: vector,
        numCandidates: Math.max(k * 10, 100),
        limit: k,
        filter: Object.keys(filter).length ? filter : undefined,
      },
    },
    { $addFields: { score: { $meta: 'vectorSearchScore' } } },
    { $project: buildProjection(fields) },
  ];

  const cursor = db.collection(COLLECTION).aggregate(pipeline, { maxTimeMS: VECTOR_MAX_TIME_MS });
  const results = await cursor.toArray();
  return results.map((doc) => ({
    ...doc,
    score: doc.score ?? 0,
    vectorScore: doc.score ?? 0,
  }));
}

async function runTextSearch({ chatbotId, text, k = DEFAULT_TOP_K, fields = ['content'] } = {}) {
  if (!text) return [];
  if (!TEXT_INDEX || FUSION_DISABLED || KEYWORD_DISABLED) return [];

  const db = mongoose.connection.db;
  const compound = {
    must: [
      {
        text: {
          query: text,
          path: 'content',
          fuzzy: { maxEdits: 1, prefixLength: 2 },
        },
      },
    ],
  };
  if (chatbotId) {
    compound.filter = [
      {
        equals: {
          path: 'chatbot_id',
          value: String(chatbotId),
        },
      },
    ];
  }

  const pipeline = [
    {
      $search: {
        index: TEXT_INDEX,
        compound,
      },
    },
    { $limit: Math.max(k, DEFAULT_TOP_K) },
    { $project: { ...buildProjection(fields), score: { $meta: 'searchScore' } } },
  ];

  try {
    const cursor = db.collection(COLLECTION).aggregate(pipeline, { maxTimeMS: VECTOR_MAX_TIME_MS });
    const results = await cursor.toArray();
    return results.map((doc) => ({
      ...doc,
      textScore: doc.score ?? 0,
      score: doc.score ?? 0,
    }));
  } catch (err) {
    logger.warn(`[retrieval] text search failed index=${TEXT_INDEX}: ${err.message}`);
    return [];
  }
}

function fuseResults({ vectorResults, textResults, queryLanguage }) {
  const map = new Map();

  vectorResults.forEach((doc, rank) => {
    const id = String(doc._id);
    if (!map.has(id)) {
      map.set(id, {
        doc,
        vectorScore: doc.vectorScore ?? doc.score ?? 0,
        textScore: 0,
        vectorRank: rank,
        textRank: Infinity,
      });
    } else {
      const entry = map.get(id);
      entry.vectorScore = doc.vectorScore ?? doc.score ?? 0;
      entry.vectorRank = Math.min(entry.vectorRank, rank);
    }
  });

  textResults.forEach((doc, rank) => {
    const id = String(doc._id);
    if (!map.has(id)) {
      map.set(id, {
        doc,
        vectorScore: 0,
        textScore: doc.textScore ?? doc.score ?? 0,
        vectorRank: Infinity,
        textRank: rank,
      });
    } else {
      const entry = map.get(id);
      entry.textScore = doc.textScore ?? doc.score ?? 0;
      entry.textRank = Math.min(entry.textRank, rank);
    }
  });

  const fused = [];
  for (const entry of map.values()) {
    const base = entry.vectorScore * VECTOR_WEIGHT + entry.textScore;
    let bonus = 0;
    if (queryLanguage && entry.doc.language && entry.doc.language === queryLanguage) {
      bonus += LANG_BOOST;
    }
    fused.push({
      ...entry.doc,
      score: base + bonus,
      vectorScore: entry.vectorScore,
      textScore: entry.textScore,
    });
  }

  fused.sort((a, b) => b.score - a.score);
  return fused;
}

async function runFallback({ chatbotId, limit, fields = ['content'] }) {
  const db = mongoose.connection.db;
  const filter = {};
  if (chatbotId) filter.chatbot_id = String(chatbotId);
  const projection = buildProjection(fields);
  delete projection.score;

  const cursor = db.collection(COLLECTION)
    .find(filter)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .project(projection);
  const docs = await cursor.toArray();
  return docs.map((doc) => ({ ...doc, score: 0 }));
}

async function vectorSearch(params) {
  return runVectorSearch(params);
}

async function vectorSearchByText({ text, chatbotId, k = DEFAULT_TOP_K, fields = ['content'], indexName, languageHint } = {}) {
  const queryLanguage = await languageService.detectLanguage(text, languageHint);

  const vector = await time('embed', () => getEmbedding(text));
  const vectorResults = await time('vector search', () => runVectorSearch({ chatbotId, vector, k: Math.max(k, DEFAULT_TOP_K), fields, indexName }));

  let textResults = [];
  if (!FUSION_DISABLED && !KEYWORD_DISABLED) {
    textResults = await time('text search', () => runTextSearch({ chatbotId, text, k: Math.max(k, DEFAULT_TOP_K), fields })).catch(() => []);
  }

  const fused = fuseResults({ vectorResults, textResults, queryLanguage });

  const targetK = Math.max(k, DEFAULT_TOP_K);
  let selected = fused.filter((doc) => doc.score >= PRIMARY_THRESHOLD).slice(0, targetK);
  let path = 'fusion-primary';

  if (!selected.length) {
    selected = fused.filter((doc) => doc.score >= SECONDARY_THRESHOLD).slice(0, targetK);
    if (selected.length) {
      path = 'fusion-secondary';
    }
  }

  if (!selected.length && !KEYWORD_DISABLED && textResults.length) {
    selected = textResults.slice(0, targetK).map((doc) => ({ ...doc, score: doc.textScore ?? doc.score ?? 0 }));
    path = 'keyword';
  }

  if (!selected.length) {
    const fallbackDocs = await runFallback({ chatbotId, limit: Math.max(RERANK_LIMIT, FALLBACK_LIMIT), fields });
    selected = fallbackDocs;
    path = 'fallback';
  }

  const finalResults = selected.slice(0, RERANK_LIMIT);
  const meta = {
    path,
    counts: {
      vector: vectorResults.length,
      text: textResults.length,
    },
    queryLanguage,
    thresholds: {
      primary: PRIMARY_THRESHOLD,
      secondary: SECONDARY_THRESHOLD,
    },
  };

  logger.info(`[retrieval] path=${path} chatbot=${chatbotId || 'GLOBAL'} results=${finalResults.length}`);
  return { results: finalResults, meta };
}

/**
 * Search products using semantic similarity
 * @param {Object} params - Search parameters
 * @param {string} params.text - Query text
 * @param {number} params.limit - Number of products to return (default: 5)
 * @param {number} params.minScore - Minimum similarity score (default: 0.3)
 * @param {Object} params.filters - Additional filters (price, category, etc.)
 * @returns {Promise<Array>} Array of matching products
 */
async function searchProducts({ text, limit = 5, minScore = 0.3, filters = {} } = {}) {
  try {
    if (!text) return [];

    // Build filter for MongoDB query
    const mongoFilter = { 
      in_stock: true 
    };

    // Add price filters if provided
    if (filters.minPrice) {
      mongoFilter.priceNum = { $gte: filters.minPrice };
    }
    if (filters.maxPrice) {
      mongoFilter.priceNum = { ...mongoFilter.priceNum, $lte: filters.maxPrice };
    }

    // Add category filter if provided
    if (filters.category) {
      mongoFilter.category = { $regex: filters.category, $options: 'i' };
    }

    // Add gender filter if provided
    if (filters.gender) {
      mongoFilter.gender = filters.gender;
    }

    // Add occasion filter if provided
    if (filters.occasion) {
      mongoFilter.occasion = { $in: [filters.occasion] };
    }

    // Extract keywords from the query for text search
    const keywords = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    console.log(`🔍 Text search keywords:`, keywords);

    // Build text search query - prioritize exact matches
    const textQuery = {
      $or: [
        // Exact phrase match (highest priority)
        { title: { $regex: text, $options: "i" } },
        { description: { $regex: text, $options: "i" } },
        // Individual keyword matches
        ...keywords.map(keyword => ({
          $or: [
            { title: { $regex: keyword, $options: "i" } },
            { description: { $regex: keyword, $options: "i" } }
          ]
        }))
      ]
    };

    // Combine filters
    const finalFilter = { ...mongoFilter, ...textQuery };

    // Get products using text search first
    let products = await AzaModel.find(finalFilter, {
      productId: 1,
      title: 1,
      description: 1,
      image: 1,
      price: 1,
      priceNum: 1,
      currency: 1,
      available_sizes: 1,
      colors: 1,
      category: 1,
      gender: 1,
      occasion: 1,
      materials: 1,
      embedding: 1
    }).lean();

    console.log(`🔍 Text search: found ${products.length} products`);

    // If text search doesn't find enough results, try vector search as fallback
    if (products.length < limit) {
      console.log(`🔄 Text search found ${products.length} products, trying vector search...`);
      
      try {
        const queryEmbedding = await getEmbedding(text);
        if (queryEmbedding && queryEmbedding.length > 0) {
          // Get products with embeddings
          const vectorFilter = { 
            ...mongoFilter,
            embedding: { $exists: true, $ne: null }
          };
          
          const vectorProducts = await AzaModel.find(vectorFilter, {
            productId: 1,
            title: 1,
            description: 1,
            image: 1,
            price: 1,
            priceNum: 1,
            currency: 1,
            available_sizes: 1,
            colors: 1,
            category: 1,
            gender: 1,
            occasion: 1,
            materials: 1,
            embedding: 1
          }).lean();

          if (vectorProducts.length > 0) {
            // Calculate similarity scores for vector products
            const scoredVectorProducts = vectorProducts.map(product => {
              const similarity = cosineSimilarity(queryEmbedding, product.embedding || []);
              return {
                ...product,
                similarity,
                score: similarity,
                source: 'vector'
              };
            });

            // Filter by minimum score and sort by similarity
            const filteredVectorProducts = scoredVectorProducts
              .filter(product => product.similarity >= minScore)
              .sort((a, b) => b.similarity - a.similarity);

            console.log(`🔍 Vector search: found ${filteredVectorProducts.length} products with similarity >= ${minScore}`);

            // Combine text and vector results, avoiding duplicates
            const existingIds = new Set(products.map(p => p._id.toString()));
            const newVectorProducts = filteredVectorProducts.filter(p => !existingIds.has(p._id.toString()));
            
            products = [...products, ...newVectorProducts];
          }
        }
      } catch (vectorError) {
        console.log(`⚠️ Vector search failed: ${vectorError.message}`);
      }
    }

    // Calculate text similarity scores for all products
    const scoredProducts = products.map(product => {
      const textSimilarity = calculateTextSimilarity(text, product.title + " " + (product.description || ""));
      return {
        ...product,
        similarity: product.similarity || textSimilarity,
        score: product.similarity || textSimilarity,
        source: product.source || 'text'
      };
    });

    // Sort by similarity and limit results
    const finalProducts = scoredProducts
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    logger.info(`Product search: found ${finalProducts.length} products for query "${text}"`);
    return finalProducts;

  } catch (error) {
    logger.error(`Product search error: ${error.message}`);
    return [];
  }
}

// Helper function to calculate text similarity
function calculateTextSimilarity(query, text) {
  const queryWords = query.toLowerCase().split(/\s+/);
  const textWords = text.toLowerCase().split(/\s+/);
  
  let exactMatches = 0;
  let partialMatches = 0;
  
  queryWords.forEach(word => {
    if (textWords.includes(word)) {
      exactMatches++;
    } else if (textWords.some(textWord => textWord.includes(word) || word.includes(textWord))) {
      partialMatches++;
    }
  });
  
  // Weight exact matches higher than partial matches
  return (exactMatches * 1.0 + partialMatches * 0.5) / queryWords.length;
}

/**
 * Detect if a query is product-related
 * @param {string} query - User query
 * @returns {boolean} True if query is product-related
 */
function isProductQuery(query) {
  if (!query) return false;
  
  const queryLower = query.toLowerCase();
  
  // Specific fashion items (must be present)
  const fashionItems = [
    'dress', 'lehenga', 'saree', 'kurta', 'shirt', 'pants', 'jeans', 'top', 'blouse',
    'skirt', 'gown', 'suit', 'jacket', 'coat', 'sweater', 'cardigan', 'hoodie',
    'shorts', 'trouser', 'pajama', 'nightwear', 'lingerie', 'underwear'
  ];
  
  // Kids wear (must be present)
  const kidsWear = ['kids', 'children', 'baby', 'toddler', 'girls', 'boys', 'infant'];
  
  // Shopping intent (must be present with fashion items)
  const shoppingTerms = ['buy', 'purchase', 'shop', 'shopping', 'show', 'find', 'looking for', 'need', 'want'];
  
  // Check for specific fashion items
  const hasFashionItem = fashionItems.some(item => queryLower.includes(item));
  const hasKidsWear = kidsWear.some(item => queryLower.includes(item));
  const hasShoppingIntent = shoppingTerms.some(term => queryLower.includes(term));
  
  // Only trigger product search if:
  // 1. Has specific fashion items OR kids wear, AND
  // 2. Has shopping intent OR is asking to show/find products
  return (hasFashionItem || hasKidsWear) && (hasShoppingIntent || queryLower.includes('show') || queryLower.includes('find'));
}

/**
 * Extract product filters from query
 * @param {string} query - User query
 * @returns {Object} Extracted filters
 */
function extractProductFilters(query) {
  if (!query) return {};

  const filters = {};
  const queryLower = query.toLowerCase();

  // Price filters
  const priceMatch = queryLower.match(/(?:under|below|less than|upto)\s*(\d+)/);
  if (priceMatch) {
    filters.maxPrice = parseInt(priceMatch[1]);
  }

  const priceRangeMatch = queryLower.match(/(\d+)\s*to\s*(\d+)|(\d+)\s*-\s*(\d+)/);
  if (priceRangeMatch) {
    const min = parseInt(priceRangeMatch[1] || priceRangeMatch[3]);
    const max = parseInt(priceRangeMatch[2] || priceRangeMatch[4]);
    if (min && max) {
      filters.minPrice = min;
      filters.maxPrice = max;
    }
  }

  // Gender filters
  if (queryLower.includes('men') || queryLower.includes('male')) {
    filters.gender = 'men';
  } else if (queryLower.includes('women') || queryLower.includes('female') || queryLower.includes('ladies')) {
    filters.gender = 'women';
  } else if (queryLower.includes('kids') || queryLower.includes('children') || queryLower.includes('baby')) {
    filters.gender = 'kids';
  }

  // Occasion filters
  if (queryLower.includes('wedding')) {
    filters.occasion = 'wedding';
  } else if (queryLower.includes('party')) {
    filters.occasion = 'party';
  } else if (queryLower.includes('casual')) {
    filters.occasion = 'casual';
  } else if (queryLower.includes('formal') || queryLower.includes('office')) {
    filters.occasion = 'formal';
  }

  // Category filters
  if (queryLower.includes('traditional') || queryLower.includes('ethnic')) {
    filters.category = 'traditional';
  } else if (queryLower.includes('western')) {
    filters.category = 'western';
  }

  return filters;
}

module.exports = { 
  vectorSearch, 
  vectorSearchByText,
  searchProducts,
  isProductQuery,
  extractProductFilters
};
