const openai = require('../config/openai');
const MarketIntelligence = require('../models/MarketIntelligence');
const logger = require('../utils/logger');

class EmbeddingService {
  constructor() {
    this.model = 'text-embedding-3-small';
    this.dimensions = 1536;
    this.batchSize = 100; // Process 100 items at a time
  }

  /**
   * Generate embedding for a single text
   * @param {String} text - Text to generate embedding for
   * @returns {Array<Number>} - Embedding vector
   */
  async generateEmbedding(text) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
      }

      const response = await openai.embeddings.create({
        model: this.model,
        input: text,
        dimensions: this.dimensions
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param {Array<String>} texts - Array of texts
   * @returns {Array<Array<Number>>} - Array of embedding vectors
   */
  async generateBatchEmbeddings(texts) {
    try {
      if (!texts || texts.length === 0) {
        return [];
      }

      // Filter out empty texts
      const validTexts = texts.filter(t => t && t.trim().length > 0);

      if (validTexts.length === 0) {
        return [];
      }

      const response = await openai.embeddings.create({
        model: this.model,
        input: validTexts,
        dimensions: this.dimensions
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      logger.error('Error generating batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Process unembedded market intelligence items
   * @param {Number} limit - Maximum number of items to process
   * @returns {Object} - Processing results
   */
  async processUnembeddedIntelligence(limit = 50) {
    try {
      logger.info(`Starting embedding generation for up to ${limit} items...`);

      // Find items that have been summarized but not embedded yet
      const items = await MarketIntelligence.find({
        processingStatus: 'summarized',
        summary: { $exists: true, $ne: '' }
      })
        .limit(limit)
        .select('_id title summary keyTakeaways source type');

      if (items.length === 0) {
        logger.info('No items to embed');
        return { processed: 0, failed: 0 };
      }

      logger.info(`Found ${items.length} items to embed`);

      let processed = 0;
      let failed = 0;

      // Process in smaller batches to avoid rate limits
      for (let i = 0; i < items.length; i += this.batchSize) {
        const batch = items.slice(i, i + this.batchSize);


        // Prepare text for embedding (combine title, summary, and key takeaways)
        const textsToEmbed = batch.map(item => {
          const takeawaysText = item.keyTakeaways?.join(' ') || '';
          return `${item.title}\n\n${item.summary}\n\n${takeawaysText}`.trim();
        });

        try {
          // Generate embeddings for the batch
          const embeddings = await this.generateBatchEmbeddings(textsToEmbed);

          // Update each item with its embedding
          for (let j = 0; j < batch.length; j++) {
            try {
              await MarketIntelligence.findByIdAndUpdate(batch[j]._id, {
                embedding: embeddings[j],
                processingStatus: 'embedded',
                embeddedAt: new Date()
              });
              processed++;
            } catch (updateError) {
              logger.error(`Failed to update item ${batch[j]._id}:`, updateError);
              failed++;
            }
          }

          // Rate limiting: wait 1 second between batches
          if (i + this.batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (batchError) {
          logger.error('Batch embedding failed:', batchError);
          failed += batch.length;
        }
      }

      logger.info(`Embedding generation completed: ${processed} processed, ${failed} failed`);

      return { processed, failed };
    } catch (error) {
      logger.error('Error processing unembedded intelligence:', error);
      throw error;
    }
  }

  /**
   * Regenerate embedding for a specific intelligence item
   * @param {String} intelligenceId - ID of the intelligence item
   * @returns {Boolean} - Success status
   */
  async regenerateEmbedding(intelligenceId) {
    try {
      const item = await MarketIntelligence.findById(intelligenceId)
        .select('title summary keyTakeaways');

      if (!item) {
        throw new Error('Intelligence item not found');
      }

      if (!item.summary) {
        throw new Error('Item has no summary to embed');
      }

      // Prepare text for embedding
      const takeawaysText = item.keyTakeaways?.join(' ') || '';
      const textToEmbed = `${item.title}\n\n${item.summary}\n\n${takeawaysText}`.trim();

      // Generate embedding
      const embedding = await this.generateEmbedding(textToEmbed);

      // Update the item
      await MarketIntelligence.findByIdAndUpdate(intelligenceId, {
        embedding,
        processingStatus: 'embedded',
        embeddedAt: new Date()
      });

      logger.info(`Regenerated embedding for item ${intelligenceId}`);
      return true;
    } catch (error) {
      logger.error(`Error regenerating embedding for item ${intelligenceId}:`, error);
      throw error;
    }
  }

  /**
   * Get statistics about embedding status
   * @returns {Object} - Statistics
   */
  async getEmbeddingStats() {
    try {
      const total = await MarketIntelligence.countDocuments();
      const embedded = await MarketIntelligence.countDocuments({ processingStatus: 'embedded' });
      const summarized = await MarketIntelligence.countDocuments({ processingStatus: 'summarized' });
      const scraped = await MarketIntelligence.countDocuments({ processingStatus: 'scraped' });

      return {
        total,
        embedded,
        summarized,
        scraped,
        pendingEmbedding: summarized
      };
    } catch (error) {
      logger.error('Error getting embedding stats:', error);
      throw error;
    }
  }
}

module.exports = EmbeddingService;
