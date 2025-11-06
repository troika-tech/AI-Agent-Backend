const openai = require('../config/openai');
const MarketIntelligence = require('../models/MarketIntelligence');
const EmbeddingService = require('./embeddingService');
const logger = require('../utils/logger');

class LLMProcessor {
  constructor() {
    this.model = 'gpt-4o-mini'; // Cost-effective for batch processing
    this.embeddingService = new EmbeddingService();
  }

  async summarizeContent(intelligence) {
    try {
      const prompt = `You are an expert business analyst summarizing competitive and industry intelligence.

Source: ${intelligence.source}
Type: ${intelligence.type}
Content: ${intelligence.rawContent}

Task: Create a concise, actionable summary (200-300 words) focusing on:
1. Key facts and developments
2. Pricing or feature changes (if applicable)
3. Market implications
4. Relevance to AI/digital services for Indian SMBs

Also extract:
- 3-5 key takeaways as bullet points
- Relevance score (0-1): How relevant is this to AI chatbots, websites, WhatsApp marketing, or voice/video AI?
- Relevant services: Which Troika Tech services does this relate to? [Supa Agent, AI Websites, WhatsApp Marketing, Video Agent, Calling Agent, RCS Messaging, SuperScan]
- Target industries: Which industries would care about this? [Real Estate, Retail, Education, Healthcare, Pharma, Politics]

Return JSON:
{
  "summary": "...",
  "keyTakeaways": ["...", "..."],
  "relevanceScore": 0.85,
  "relevantServices": ["Supa Agent"],
  "relevantIndustries": ["Real Estate", "Retail"]
}`;

      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(completion.choices[0].message.content);

      // Update the intelligence document
      intelligence.summary = result.summary;
      intelligence.keyTakeaways = result.keyTakeaways || [];
      intelligence.relevanceScore = result.relevanceScore || 0;
      intelligence.relevantServices = result.relevantServices || [];
      intelligence.relevantIndustries = result.relevantIndustries || [];
      intelligence.processingStatus = 'summarized';

      await intelligence.save();

      logger.info(`Summarized: ${intelligence.title}`);
      return intelligence;
    } catch (error) {
      logger.error(`Error summarizing ${intelligence._id}:`, error.message);
      throw error;
    }
  }

  async processBatch(limit = 10) {
    try {
      // Find unprocessed intelligence
      const unprocessed = await MarketIntelligence.find({
        processingStatus: 'scraped'
      })
        .sort({ scrapedAt: -1 })
        .limit(limit);

      if (unprocessed.length === 0) {
        logger.info('No unprocessed intelligence to summarize');
        return { processed: 0 };
      }

      logger.info(`Processing ${unprocessed.length} intelligence items...`);
      const results = [];

      for (const intelligence of unprocessed) {
        try {
          const processed = await this.summarizeContent(intelligence);
          results.push(processed);

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          logger.error(`Failed to process ${intelligence._id}:`, error.message);
        }
      }

      logger.info(`✓ Processed ${results.length} intelligence items`);

      // After summarization, generate embeddings for the processed items
      if (results.length > 0) {
        logger.info('Generating embeddings for summarized items...');
        const embeddingResult = await this.embeddingService.processUnembeddedIntelligence(results.length);
        logger.info(`Embeddings generated: ${embeddingResult.processed} items`);
      }

      return {
        processed: results.length,
        failed: unprocessed.length - results.length
      };
    } catch (error) {
      logger.error('Batch processing failed:', error);
      throw error;
    }
  }
}

module.exports = LLMProcessor;
