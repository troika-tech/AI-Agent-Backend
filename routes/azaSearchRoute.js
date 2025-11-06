// routes/aza.search.js
const express = require('express');
const router = express.Router();
const AzaProduct = require('../models/AzaModel');
const { getEmbedding } = require('../lib/embed');
const SSEHelper = require('../utils/sseHelper');
const logger = require('../utils/logger');

/**
 * POST /aza/search
 * body: { q: string, limit?: number }
 * response: { results: [ { productId, title, image, price_from, currency, in_stock, available_sizes, productUrl, score } ] }
 */
router.post('/search', async (req, res) => {
  try {
    const q = (req.body.q || '').trim();
    const limit = Math.min(Number(req.body.limit) || 6, 20);

    if (!q) return res.status(400).json({ error: 'q required' });

    // 1) Quick text search fallback
    const textResults = await AzaProduct.find(
      { $text: { $search: q }, in_stock: true },
      {
        score: { $meta: 'textScore' },
        productId: 1,
        title: 1,
        image: 1,
        price_from: 1,
        currency: 1,
        in_stock: 1,
        available_sizes: 1,
        productUrl: 1
      }
    ).sort({ score: { $meta: 'textScore' } }).limit(limit).lean();

    if (textResults && textResults.length) {
      const topScore = textResults[0]?.score || 0;
      if (topScore >= 2.5 || textResults.length >= Math.min(3, limit)) {
        const maxTextScore = Math.max(...textResults.map(r => r.score || 1), 1);
        const mapped = textResults.map(r => ({
          productId: r.productId,
          title: r.title,
          image: r.image,
          price_from: r.price_from,
          currency: r.currency || 'INR',
          in_stock: !!r.in_stock,
          available_sizes: r.available_sizes || [],
          productUrl: r.productUrl,
          score: (r.score || 0) / maxTextScore
        }));
        return res.json({ results: mapped });
      }
    }

    // 2) Semantic search via embeddings
    const qEmb = await getEmbedding(q);
    if (!qEmb || !qEmb.length) {
      const fallback = (textResults || []).map(r => ({
        productId: r.productId,
        title: r.title,
        image: r.image,
        price_from: r.price_from,
        currency: r.currency || 'INR',
        in_stock: !!r.in_stock,
        available_sizes: r.available_sizes || [],
        productUrl: r.productUrl,
        score: r.score ? (r.score / (Math.max(...textResults.map(x=>x.score||1),1))) : 0
      }));
      return res.json({ results: fallback });
    }

    const CANDIDATE_LIMIT = 500;
    const candidates = await AzaProduct.find({
      embedding: { $exists: true, $ne: [] },
      in_stock: true
    }).select('productId title image price_from currency in_stock available_sizes productUrl embedding').limit(CANDIDATE_LIMIT).lean();

    if (!candidates || candidates.length === 0) {
      const fallback = (textResults || []).map(r => ({
        productId: r.productId,
        title: r.title,
        image: r.image,
        price_from: r.price_from,
        currency: r.currency || 'INR',
        in_stock: !!r.in_stock,
        available_sizes: r.available_sizes || [],
        productUrl: r.productUrl,
        score: r.score ? (r.score / (Math.max(...textResults.map(x=>x.score||1),1))) : 0
      }));
      return res.json({ results: fallback });
    }

    // cosine similarity
    function dot(a,b){ let s=0; for(let i=0;i<a.length && i<b.length;i++) s += a[i]*b[i]; return s; }
    function norm(a){ return Math.sqrt(a.reduce((s,v)=>s + (v*v), 0)); }
    const qNorm = norm(qEmb) || 1;

    const scored = candidates.map(c => {
      const e = c.embedding || [];
      const s = (e.length ? (dot(qEmb, e) / (qNorm * (norm(e)||1))) : 0);
      return { ...c, _score: s };
    });

    scored.sort((a,b) => b._score - a._score);

    const maxScore = Math.max(...scored.map(x => x._score), 1);
    const results = scored.slice(0, limit).map(r => ({
      productId: r.productId,
      title: r.title,
      image: r.image,
      price_from: r.price_from,
      currency: r.currency || 'INR',
      in_stock: !!r.in_stock,
      available_sizes: r.available_sizes || [],
      productUrl: r.productUrl,
      score: (r._score || 0) / maxScore
    }));

    return res.json({ results });
  } catch (err) {
    console.error('aza search error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

/**
 * POST /aza/search/stream
 * Streaming version of Aza product search with real-time results
 * Returns Server-Sent Events with search progress and results
 */
router.post('/search/stream', async (req, res) => {
  const clientId = `aza-search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const q = (req.body.q || '').trim();
    const limit = Math.min(Number(req.body.limit) || 6, 20);

    if (!q) {
      SSEHelper.initializeSSE(res, clientId);
      SSEHelper.sendEvent(res, 'error', { message: 'Query parameter "q" is required' });
      SSEHelper.closeConnection(res, clientId);
      return;
    }

    // Initialize SSE connection
    SSEHelper.initializeSSE(res, clientId);
    
    logger.info(`[${clientId}] Starting streaming Aza search`, {
      query: q,
      limit
    });

    // Send initial connection event
    SSEHelper.sendEvent(res, 'connected', {
      message: 'Aza product search stream started',
      query: q,
      limit
    });

    // 1) Quick text search fallback
    SSEHelper.sendEvent(res, 'progress', { step: 'text_search', message: 'Performing text search...' });
    
    const textResults = await AzaProduct.find(
      { $text: { $search: q }, in_stock: true },
      {
        score: { $meta: 'textScore' },
        productId: 1,
        title: 1,
        image: 1,
        price_from: 1,
        currency: 1,
        in_stock: 1,
        available_sizes: 1,
        productUrl: 1
      }
    ).sort({ score: { $meta: 'textScore' } }).limit(limit).lean();

    let results = [];
    let searchMethod = 'text';

    if (textResults && textResults.length) {
      const topScore = textResults[0]?.score || 0;
      if (topScore >= 2.5 || textResults.length >= Math.min(3, limit)) {
        const maxTextScore = Math.max(...textResults.map(r => r.score || 1), 1);
        results = textResults.map(r => ({
          productId: r.productId,
          title: r.title,
          image: r.image,
          price_from: r.price_from,
          currency: r.currency || 'INR',
          in_stock: !!r.in_stock,
          available_sizes: r.available_sizes || [],
          productUrl: r.productUrl,
          score: (r.score || 0) / maxTextScore
        }));
        
        SSEHelper.sendEvent(res, 'progress', { 
          step: 'text_search', 
          message: `Text search found ${results.length} high-quality results`,
          count: results.length,
          topScore
        });
      } else {
        SSEHelper.sendEvent(res, 'progress', { 
          step: 'text_search', 
          message: `Text search found ${textResults.length} results, trying semantic search...`,
          count: textResults.length,
          topScore
        });
      }
    }

    // 2) Semantic search via embeddings
    if (results.length === 0) {
      SSEHelper.sendEvent(res, 'progress', { step: 'semantic_search', message: 'Performing semantic search...' });
      
      const qEmb = await getEmbedding(q);
      if (!qEmb || !qEmb.length) {
        SSEHelper.sendEvent(res, 'progress', { 
          step: 'semantic_search', 
          message: 'Failed to generate embeddings, using text results...',
          warning: 'Embedding generation failed'
        });
        
        // Use text results as fallback
        results = (textResults || []).map(r => ({
          productId: r.productId,
          title: r.title,
          image: r.image,
          price_from: r.price_from,
          currency: r.currency || 'INR',
          in_stock: !!r.in_stock,
          available_sizes: r.available_sizes || [],
          productUrl: r.productUrl,
          score: r.score ? (r.score / (Math.max(...textResults.map(x=>x.score||1),1))) : 0
        }));
        searchMethod = 'text_fallback';
      } else {
        const CANDIDATE_LIMIT = 500;
        const candidates = await AzaProduct.find({
          embedding: { $exists: true, $ne: [] },
          in_stock: true
        }).select('productId title image price_from currency in_stock available_sizes productUrl embedding').limit(CANDIDATE_LIMIT).lean();

        if (!candidates || candidates.length === 0) {
          SSEHelper.sendEvent(res, 'progress', { 
            step: 'semantic_search', 
            message: 'No candidates found for semantic search, using text results...',
            warning: 'No products with embeddings found'
          });
          
          results = (textResults || []).map(r => ({
            productId: r.productId,
            title: r.title,
            image: r.image,
            price_from: r.price_from,
            currency: r.currency || 'INR',
            in_stock: !!r.in_stock,
            available_sizes: r.available_sizes || [],
            productUrl: r.productUrl,
            score: r.score ? (r.score / (Math.max(...textResults.map(x=>x.score||1),1))) : 0
          }));
          searchMethod = 'text_fallback';
        } else {
          // Cosine similarity calculation
          function dot(a,b){ let s=0; for(let i=0;i<a.length && i<b.length;i++) s += a[i]*b[i]; return s; }
          function norm(a){ return Math.sqrt(a.reduce((s,v)=>s + (v*v), 0)); }
          const qNorm = norm(qEmb) || 1;

          const scored = candidates.map(c => {
            const e = c.embedding || [];
            const s = (e.length ? (dot(qEmb, e) / (qNorm * (norm(e)||1))) : 0);
            return { ...c, _score: s };
          });

          scored.sort((a,b) => b._score - a._score);

          const maxScore = Math.max(...scored.map(x => x._score), 1);
          results = scored.slice(0, limit).map(r => ({
            productId: r.productId,
            title: r.title,
            image: r.image,
            price_from: r.price_from,
            currency: r.currency || 'INR',
            in_stock: !!r.in_stock,
            available_sizes: r.available_sizes || [],
            productUrl: r.productUrl,
            score: (r._score || 0) / maxScore
          }));
          searchMethod = 'semantic';
          
          SSEHelper.sendEvent(res, 'progress', { 
            step: 'semantic_search', 
            message: `Semantic search found ${results.length} results`,
            count: results.length,
            candidates: candidates.length
          });
        }
      }
    }

    // Send final results
    SSEHelper.sendEvent(res, 'results', {
      results: results,
      query: q,
      searchMethod: searchMethod,
      total: results.length
    });

    // Send completion event
    SSEHelper.sendEvent(res, 'complete', {
      total: results.length,
      query: q,
      searchMethod: searchMethod
    });

    logger.info(`[${clientId}] Aza search stream complete`, {
      query: q,
      totalResults: results.length,
      searchMethod
    });

    SSEHelper.closeConnection(res, clientId);

  } catch (err) {
    logger.error(`[${clientId}] Aza search stream error:`, err);
    
    try {
      SSEHelper.sendEvent(res, 'error', {
        message: 'Aza search failed',
        error: err.message
      });
      SSEHelper.closeConnection(res, clientId);
    } catch (sseError) {
      logger.error(`[${clientId}] Failed to send SSE error:`, sseError);
    }
  }
});

module.exports = router;
