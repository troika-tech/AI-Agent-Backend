const mongoose = require('mongoose');
const MarketIntelligence = require('../models/MarketIntelligence');
const EmbeddingService = require('./embeddingService');
const logger = require('../utils/logger');

class MarketIntelligenceVectorSearch {
  constructor() {
    this.embeddingService = new EmbeddingService();
    this.indexName = 'market_intelligence_vector_index';
  }

  /**
   * Perform semantic search on market intelligence using vector embeddings
   * @param {String} queryText - User's query text
   * @param {Object} filters - Optional filters
   * @param {Number} limit - Number of results to return
   * @returns {Array} - Matching intelligence items
   */
  async semanticSearch(queryText, filters = {}, limit = 10) {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.generateEmbedding(queryText);

      // Separate date filter for post-processing (not supported in vector search pre-filter)
      const maxAgeDays = filters.maxAgeDays;
      const vectorFilters = { ...filters };
      delete vectorFilters.maxAgeDays;

      // Build the aggregation pipeline for Atlas Vector Search
      const pipeline = [
        {
          $vectorSearch: {
            index: this.indexName,
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: limit * 10, // Search more candidates for better results
            limit: maxAgeDays ? limit * 3 : limit, // Get more results if we need to filter by date
            filter: this._buildFilter(vectorFilters)
          }
        },
        {
          $addFields: {
            searchScore: { $meta: 'vectorSearchScore' }
          }
        },
        {
          $project: {
            _id: 1,
            type: 1,
            source: 1,
            sourceUrl: 1,
            title: 1,
            summary: 1,
            keyTakeaways: 1,
            relevantServices: 1,
            relevantIndustries: 1,
            relevanceScore: 1,
            scrapedAt: 1,
            publishedAt: 1,
            searchScore: 1
          }
        }
      ];

      // Add date filter as post-filter (after vector search)
      if (maxAgeDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
        pipeline.push({
          $match: {
            scrapedAt: { $gte: cutoffDate }
          }
        });
        pipeline.push({
          $limit: limit
        });
      }

      const results = await MarketIntelligence.aggregate(pipeline);

      logger.info(`Vector search for "${queryText}" returned ${results.length} results`);

      return results;
    } catch (error) {
      logger.error('Error performing semantic search:', error);
      throw error;
    }
  }

  /**
   * Build MongoDB filter for vector search pre-filtering
   * @param {Object} filters - Filter options
   * @returns {Object} - MongoDB filter object
   */
  _buildFilter(filters) {
    const filter = {
      processingStatus: { $eq: 'embedded' }
    };

    if (filters.types && filters.types.length > 0) {
      filter.type = { $in: filters.types };
    }

    if (filters.services && filters.services.length > 0) {
      filter.relevantServices = { $in: filters.services };
    }

    if (filters.industries && filters.industries.length > 0) {
      filter.relevantIndustries = { $in: filters.industries };
    }

    if (filters.minRelevanceScore) {
      filter.relevanceScore = { $gte: filters.minRelevanceScore };
    }

    // Note: maxAgeDays/scrapedAt filter is applied as post-filter in pipeline
    // (not supported in Atlas Vector Search pre-filter without index configuration)

    return filter;
  }

  /**
   * Find similar intelligence items to a given item
   * @param {String} intelligenceId - ID of the intelligence item
   * @param {Number} limit - Number of similar items to return
   * @returns {Array} - Similar intelligence items
   */
  async findSimilar(intelligenceId, limit = 5) {
    try {
      // Get the source intelligence item with its embedding
      const sourceItem = await MarketIntelligence.findById(intelligenceId)
        .select('+embedding');

      if (!sourceItem || !sourceItem.embedding) {
        throw new Error('Intelligence item not found or has no embedding');
      }

      // Build aggregation pipeline
      const pipeline = [
        {
          $vectorSearch: {
            index: this.indexName,
            path: 'embedding',
            queryVector: sourceItem.embedding,
            numCandidates: limit * 10,
            limit: limit + 1, // +1 to exclude the source item
            filter: {
              processingStatus: { $eq: 'embedded' }
            }
          }
        },
        {
          $addFields: {
            searchScore: { $meta: 'vectorSearchScore' }
          }
        },
        {
          $match: {
            _id: { $ne: sourceItem._id } // Exclude the source item itself
          }
        },
        {
          $limit: limit
        },
        {
          $project: {
            _id: 1,
            type: 1,
            source: 1,
            sourceUrl: 1,
            title: 1,
            summary: 1,
            keyTakeaways: 1,
            relevantServices: 1,
            relevantIndustries: 1,
            relevanceScore: 1,
            scrapedAt: 1,
            searchScore: 1
          }
        }
      ];

      const results = await MarketIntelligence.aggregate(pipeline);

      logger.info(`Found ${results.length} similar items for intelligence ${intelligenceId}`);

      return results;
    } catch (error) {
      logger.error('Error finding similar intelligence:', error);
      throw error;
    }
  }

  /**
   * Hybrid search: Combine vector search with keyword filters
   * @param {String} queryText - User's query
   * @param {Object} filters - Filters to apply
   * @param {Number} vectorLimit - Number of vector search results
   * @returns {Object} - Combined results
   */
  async hybridSearch(queryText, filters = {}, vectorLimit = 10) {
    try {
      // Perform vector search
      const vectorResults = await this.semanticSearch(queryText, filters, vectorLimit);

      // Extract IDs from vector results
      const vectorIds = vectorResults.map(r => r._id);

      // Also do a keyword search on title and summary
      const keywordQuery = {
        processingStatus: 'embedded',
        $or: [
          { title: { $regex: queryText, $options: 'i' } },
          { summary: { $regex: queryText, $options: 'i' } },
          { keyTakeaways: { $elemMatch: { $regex: queryText, $options: 'i' } } }
        ]
      };

      // Apply additional filters
      if (filters.types && filters.types.length > 0) {
        keywordQuery.type = { $in: filters.types };
      }
      if (filters.services && filters.services.length > 0) {
        keywordQuery.relevantServices = { $in: filters.services };
      }
      if (filters.industries && filters.industries.length > 0) {
        keywordQuery.relevantIndustries = { $in: filters.industries };
      }

      const keywordResults = await MarketIntelligence.find(keywordQuery)
        .select('_id type source sourceUrl title summary keyTakeaways relevantServices relevantIndustries relevanceScore scrapedAt')
        .limit(vectorLimit)
        .sort({ relevanceScore: -1, scrapedAt: -1 });

      // Merge results (prioritize vector results, add unique keyword results)
      const mergedResults = [...vectorResults];
      const existingIds = new Set(vectorIds.map(id => id.toString()));

      for (const kwResult of keywordResults) {
        if (!existingIds.has(kwResult._id.toString())) {
          mergedResults.push({
            ...kwResult.toObject(),
            searchScore: 0.5 // Lower score for keyword-only matches
          });
        }
      }

      logger.info(`Hybrid search returned ${mergedResults.length} results (${vectorResults.length} vector + ${mergedResults.length - vectorResults.length} keyword)`);

      return {
        total: mergedResults.length,
        vectorCount: vectorResults.length,
        keywordCount: mergedResults.length - vectorResults.length,
        results: mergedResults.slice(0, vectorLimit) // Limit final results
      };
    } catch (error) {
      logger.error('Error performing hybrid search:', error);
      throw error;
    }
  }

  /**
   * Check if vector search index is ready
   * @returns {Object} - Index status
   */
  async checkIndexStatus() {
    try {
      const db = mongoose.connection.db;
      const coll = db.collection('marketintelligences');

      const indexes = await coll.listSearchIndexes().toArray();
      const vectorIndex = indexes.find(ix => ix.name === this.indexName);

      if (!vectorIndex) {
        return {
          exists: false,
          ready: false,
          message: 'Vector search index not found. Run: npm run db:intelligence:vector'
        };
      }

      return {
        exists: true,
        ready: vectorIndex.status === 'READY',
        status: vectorIndex.status,
        name: vectorIndex.name,
        type: vectorIndex.type
      };
    } catch (error) {
      logger.error('Error checking index status:', error);
      throw error;
    }
  }
}

module.exports = MarketIntelligenceVectorSearch;
