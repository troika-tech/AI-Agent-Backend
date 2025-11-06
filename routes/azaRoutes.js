// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const Product = require('../models/AzaModel'); // your existing Product model
const { getEmbedding } = require('../lib/embed'); // unified embedding helper
const SSEHelper = require('../utils/sseHelper');
const logger = require('../utils/logger');

// GET /api/products/search?q=&productId=&url=&size=&color=&minPrice=&maxPrice=&exactPrice=&in_stock=&limit=&offset=&semantic=true
router.get('/search', async (req, res) => {
  try {
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
      offset = 0,
      semantic = 'true',
    } = req.query;

    // 1) Exact match shortcuts
    if (productId) {
      const p = await Product.findOne({ productId }).lean();
      return res.json({ type: 'product_cards', query: productId, products: p ? [p] : [], total: p ? 1 : 0 });
    }
    if (url) {
      const p = await Product.findOne({ url }).lean();
      return res.json({ type: 'product_cards', query: url, products: p ? [p] : [], total: p ? 1 : 0 });
    }

    // 2) Build filter object (now supports minPrice/maxPrice/exactPrice)
    const filters = {};
    if (size) filters.available_sizes = { $in: [String(size).toUpperCase()] };
    if (color) filters.colors = { $in: [String(color).toLowerCase()] };

    if (typeof in_stock !== 'undefined') {
      const val = String(in_stock).toLowerCase();
      if (val === 'true' || val === '1') filters.in_stock = true;
      else if (val === 'false' || val === '0') filters.in_stock = false;
    }

    // Price filters: prefer exactPrice (if present), else min/max
    if (exactPrice) {
      const p = Number(String(exactPrice).replace(/,/g, ''));
      if (!isNaN(p)) {
        filters.priceNum = p;
      }
    } else {
      const pFilter = {};
      if (minPrice) {
        const v = Number(String(minPrice).replace(/,/g, ''));
        if (!isNaN(v)) pFilter.$gte = v;
      }
      if (maxPrice) {
        const v = Number(String(maxPrice).replace(/,/g, ''));
        if (!isNaN(v)) pFilter.$lte = v;
      }
      if (Object.keys(pFilter).length) filters.priceNum = pFilter;
    }

    // 3) If there's a text query, try text index first
    let results = [];
    if (q) {
      try {
        results = await Product.find({ ...filters, $text: { $search: q } }, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' }, scrapedAt: -1 })
          .skip(Number(offset)).limit(Number(limit)).lean();
      } catch (err) {
        results = [];
      }
    }

    // 3b) If semantic search is disabled or text search returned nothing, use a simple regex fallback
    if (q && results.length === 0 && String(semantic).toLowerCase() === 'false') {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      results = await Product.find({
        ...filters,
        $or: [
          { title: { $regex: regex } },
          { description: { $regex: regex } },
          { searchText: { $regex: regex } },
        ],
      })
        .sort({ scrapedAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit))
        .lean();
    }

    // 4) Vector search fallback when needed
    if ((results.length === 0 && q && semantic !== 'false') || (q && semantic === 'true' && results.length < 1)) {
      const qEmb = await getEmbedding(q);
      if (qEmb && Array.isArray(qEmb)) {
        const agg = [
          {
            $vectorSearch: {
              index: 'product_vectorIndex',
              path: 'embedding',
              queryVector: qEmb,
              numCandidates: 200,
              limit: Number(limit),
            },
          },
          // apply filters after vector scoring
          { $match: filters },
          { $project: { productId: 1, title: 1, description: 1, image: 1, url: 1, price: 1, priceNum: 1, currency: 1, in_stock: 1, available_sizes: 1, colors: 1, scrapedAt: 1, score: { $meta: 'vectorSearchScore' } } }
        ];

        const aggRes = await Product.aggregate(agg).allowDiskUse(true);
        results = aggRes;
      }
    }

    // 5) Fallback simple filter-only search (no q)
    if ((!q || q.trim() === '') && Object.keys(filters).length) {
      results = await Product.find(filters).sort({ scrapedAt: -1 }).skip(Number(offset)).limit(Number(limit)).lean();
    }

    // 6) Prepare response cards
    const cards = (results || []).slice(0, Number(limit)).map((r) => ({
      productId: r.productId,
      title: r.title,
      description: r.description,
      image: r.image,
      price: r.price,
      priceNum: r.priceNum,
      currency: r.currency,
      in_stock: r.in_stock,
      available_sizes: r.available_sizes,
      colors: r.colors,
      url: r.url,
      score: r.score ?? null,
    }));

    return res.json({ type: 'product_cards', query: q || null, products: cards, total: cards.length });
  } catch (err) {
    console.error('Product search error:', err.message || err);
    res.status(500).json({ message: 'Product search failed' });
  }
});

/**
 * GET /api/products/search/stream
 * Streaming version of product search with real-time results
 * Returns Server-Sent Events with search progress and results
 */
router.get('/search/stream', async (req, res) => {
  const clientId = `product-search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
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
      offset = 0,
      semantic = 'true',
    } = req.query;

    // Initialize SSE connection
    SSEHelper.initializeSSE(res, clientId);
    
    logger.info(`[${clientId}] Starting streaming product search`, {
      query: q,
      filters: { size, color, minPrice, maxPrice, exactPrice, in_stock },
      limit,
      offset
    });

    // Send initial connection event
    SSEHelper.sendEvent(res, 'connected', {
      message: 'Product search stream started',
      query: q,
      filters: { size, color, minPrice, maxPrice, exactPrice, in_stock }
    });

    // 1) Exact match shortcuts
    if (productId) {
      SSEHelper.sendEvent(res, 'progress', { step: 'exact_match', message: 'Searching by product ID...' });
      const p = await Product.findOne({ productId }).lean();
      const results = p ? [p] : [];
      
      SSEHelper.sendEvent(res, 'results', {
        type: 'product_cards',
        query: productId,
        products: results.map(r => ({
          productId: r.productId,
          title: r.title,
          description: r.description,
          image: r.image,
          price: r.price,
          priceNum: r.priceNum,
          currency: r.currency,
          in_stock: r.in_stock,
          available_sizes: r.available_sizes,
          colors: r.colors,
          url: r.url,
          score: 1.0
        })),
        total: results.length
      });
      
      SSEHelper.sendEvent(res, 'complete', { total: results.length });
      SSEHelper.closeConnection(res, clientId);
      return;
    }

    if (url) {
      SSEHelper.sendEvent(res, 'progress', { step: 'exact_match', message: 'Searching by URL...' });
      const p = await Product.findOne({ url }).lean();
      const results = p ? [p] : [];
      
      SSEHelper.sendEvent(res, 'results', {
        type: 'product_cards',
        query: url,
        products: results.map(r => ({
          productId: r.productId,
          title: r.title,
          description: r.description,
          image: r.image,
          price: r.price,
          priceNum: r.priceNum,
          currency: r.currency,
          in_stock: r.in_stock,
          available_sizes: r.available_sizes,
          colors: r.colors,
          url: r.url,
          score: 1.0
        })),
        total: results.length
      });
      
      SSEHelper.sendEvent(res, 'complete', { total: results.length });
      SSEHelper.closeConnection(res, clientId);
      return;
    }

    // 2) Build filter object
    SSEHelper.sendEvent(res, 'progress', { step: 'filtering', message: 'Building search filters...' });
    const filters = {};
    if (size) filters.available_sizes = { $in: [String(size).toUpperCase()] };
    if (color) filters.colors = { $in: [String(color).toLowerCase()] };

    if (typeof in_stock !== 'undefined') {
      const val = String(in_stock).toLowerCase();
      if (val === 'true' || val === '1') filters.in_stock = true;
      else if (val === 'false' || val === '0') filters.in_stock = false;
    }

    // Price filters
    if (exactPrice) {
      const p = Number(String(exactPrice).replace(/,/g, ''));
      if (!isNaN(p)) {
        filters.priceNum = p;
      }
    } else {
      const pFilter = {};
      if (minPrice) {
        const v = Number(String(minPrice).replace(/,/g, ''));
        if (!isNaN(v)) pFilter.$gte = v;
      }
      if (maxPrice) {
        const v = Number(String(maxPrice).replace(/,/g, ''));
        if (!isNaN(v)) pFilter.$lte = v;
      }
      if (Object.keys(pFilter).length) filters.priceNum = pFilter;
    }

    // 3) Text search
    let results = [];
    if (q) {
      SSEHelper.sendEvent(res, 'progress', { step: 'text_search', message: 'Performing text search...' });
      try {
        results = await Product.find({ ...filters, $text: { $search: q } }, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' }, scrapedAt: -1 })
          .skip(Number(offset)).limit(Number(limit)).lean();
        
        SSEHelper.sendEvent(res, 'progress', { 
          step: 'text_search', 
          message: `Text search found ${results.length} results`,
          count: results.length
        });
      } catch (err) {
        SSEHelper.sendEvent(res, 'progress', { 
          step: 'text_search', 
          message: 'Text search failed, trying alternative methods...',
          warning: err.message
        });
        results = [];
      }
    }

    // 4) Vector search fallback
    if ((results.length === 0 && q && semantic !== 'false') || (q && semantic === 'true' && results.length < 1)) {
      SSEHelper.sendEvent(res, 'progress', { step: 'vector_search', message: 'Performing semantic search...' });
      
      const qEmb = await getEmbedding(q);
      if (qEmb && Array.isArray(qEmb)) {
        const agg = [
          {
            $vectorSearch: {
              index: 'product_vectorIndex',
              path: 'embedding',
              queryVector: qEmb,
              numCandidates: 200,
              limit: Number(limit),
            },
          },
          { $match: filters },
          { $project: { productId: 1, title: 1, description: 1, image: 1, url: 1, price: 1, priceNum: 1, currency: 1, in_stock: 1, available_sizes: 1, colors: 1, scrapedAt: 1, score: { $meta: 'vectorSearchScore' } } }
        ];

        const aggRes = await Product.aggregate(agg).allowDiskUse(true);
        results = aggRes;
        
        SSEHelper.sendEvent(res, 'progress', { 
          step: 'vector_search', 
          message: `Semantic search found ${results.length} results`,
          count: results.length
        });
      }
    }

    // 5) Fallback simple filter-only search
    if ((!q || q.trim() === '') && Object.keys(filters).length) {
      SSEHelper.sendEvent(res, 'progress', { step: 'filter_search', message: 'Performing filter-based search...' });
      results = await Product.find(filters).sort({ scrapedAt: -1 }).skip(Number(offset)).limit(Number(limit)).lean();
      
      SSEHelper.sendEvent(res, 'progress', { 
        step: 'filter_search', 
        message: `Filter search found ${results.length} results`,
        count: results.length
      });
    }

    // 6) Prepare and send results
    SSEHelper.sendEvent(res, 'progress', { step: 'formatting', message: 'Formatting results...' });
    
    const cards = (results || []).slice(0, Number(limit)).map((r) => ({
      productId: r.productId,
      title: r.title,
      description: r.description,
      image: r.image,
      price: r.price,
      priceNum: r.priceNum,
      currency: r.currency,
      in_stock: r.in_stock,
      available_sizes: r.available_sizes,
      colors: r.colors,
      url: r.url,
      score: r.score ?? null,
    }));

    // Send final results
    SSEHelper.sendEvent(res, 'results', {
      type: 'product_cards',
      query: q || null,
      products: cards,
      total: cards.length
    });

    // Send completion event
    SSEHelper.sendEvent(res, 'complete', {
      total: cards.length,
      query: q,
      filters: { size, color, minPrice, maxPrice, exactPrice, in_stock }
    });

    logger.info(`[${clientId}] Product search stream complete`, {
      query: q,
      totalResults: cards.length,
      filters: { size, color, minPrice, maxPrice, exactPrice, in_stock }
    });

    SSEHelper.closeConnection(res, clientId);

  } catch (err) {
    logger.error(`[${clientId}] Product search stream error:`, err);
    
    try {
      SSEHelper.sendEvent(res, 'error', {
        message: 'Product search failed',
        error: err.message
      });
      SSEHelper.closeConnection(res, clientId);
    } catch (sseError) {
      logger.error(`[${clientId}] Failed to send SSE error:`, sseError);
    }
  }
});

module.exports = router;


