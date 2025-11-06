/**
 * LLM Adapter Service
 *
 * Unified interface for multiple LLM providers (OpenAI, Anthropic, xAI Grok)
 * Allows easy switching between models via environment variables
 *
 * Usage:
 *   const adapter = getLLMAdapter();
 *   const response = await adapter.generateCompletion(messages, options);
 *   const stream = await adapter.generateStreamingCompletion(messages, options);
 */

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Initialize Grok client (xAI uses OpenAI-compatible API)
const grok = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: process.env.XAI_BASE_URL || 'https://api.x.ai/v1',
});

// Model configuration from environment
const DEFAULT_MODEL_PROVIDER = process.env.LLM_PROVIDER || 'openai'; // 'openai', 'anthropic', or 'grok'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
const GROK_MODEL = process.env.GROK_MODEL || 'grok-3-mini';

/**
 * OpenAI Adapter
 */
class OpenAIAdapter {
  constructor() {
    this.client = openai;
    this.model = OPENAI_MODEL;
    this.provider = 'openai';
  }

  /**
   * Convert messages to OpenAI format
   * OpenAI uses: [{ role: 'system'|'user'|'assistant', content: '...' }]
   */
  formatMessages(messages, systemPrompt) {
    const formatted = [];

    if (systemPrompt) {
      formatted.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      formatted.push({
        role: msg.role,
        content: msg.content
      });
    }

    return formatted;
  }

  /**
   * Generate non-streaming completion
   */
  async generateCompletion(messages, systemPrompt, options = {}) {
    const {
      temperature = 0.7,
      maxTokens,
    } = options;

    const formattedMessages = this.formatMessages(messages, systemPrompt);

    logger.info(`[OpenAI] Generating completion with ${this.model}`);

    const apiOptions = {
      model: this.model,
      messages: formattedMessages,
      temperature,
    };

    // Only add max_tokens if explicitly provided
    if (maxTokens) {
      apiOptions.max_tokens = maxTokens;
    }

    const response = await this.client.chat.completions.create(apiOptions);

    return {
      content: response.choices[0].message.content,
      usage: {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
      provider: this.provider,
      model: this.model,
    };
  }

  /**
   * Generate streaming completion
   */
  async *generateStreamingCompletion(messages, systemPrompt, options = {}) {
    const {
      temperature = 0.7,
      maxTokens,
    } = options;

    const formattedMessages = this.formatMessages(messages, systemPrompt);

    logger.info(`[OpenAI] Starting streaming with ${this.model}`);

    const apiOptions = {
      model: this.model,
      messages: formattedMessages,
      temperature,
      stream: true,
    };

    // Only add max_tokens if explicitly provided
    if (maxTokens) {
      apiOptions.max_tokens = maxTokens;
    }

    const stream = await this.client.chat.completions.create(apiOptions);

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield {
          type: 'content',
          content,
        };
      }

      // Check for completion
      if (chunk.choices[0]?.finish_reason === 'stop') {
        yield {
          type: 'done',
          usage: {
            inputTokens: chunk.usage?.prompt_tokens || 0,
            outputTokens: chunk.usage?.completion_tokens || 0,
            totalTokens: chunk.usage?.total_tokens || 0,
          },
        };
      }
    }
  }
}

/**
 * Anthropic (Claude) Adapter
 */
class AnthropicAdapter {
  constructor() {
    this.client = anthropic;
    this.model = ANTHROPIC_MODEL;
    this.provider = 'anthropic';
  }

  /**
   * Convert messages to Anthropic format
   * Anthropic requires:
   * - system prompt separate (not in messages)
   * - messages must alternate user/assistant (no consecutive same role)
   */
  formatMessages(messages, systemPrompt) {
    const formatted = [];
    let lastRole = null;

    for (const msg of messages) {
      // Skip consecutive messages with same role (Anthropic requirement)
      if (msg.role === lastRole) {
        logger.warn(`[Anthropic] Skipping consecutive ${msg.role} message`);
        continue;
      }

      // Anthropic uses 'user' and 'assistant' only (no 'system' in messages)
      if (msg.role === 'system') {
        logger.warn(`[Anthropic] Skipping system message in messages array (should be in system param)`);
        continue;
      }

      formatted.push({
        role: msg.role,
        content: msg.content,
      });

      lastRole = msg.role;
    }

    return { messages: formatted, system: systemPrompt };
  }

  /**
   * Generate non-streaming completion
   */
  async generateCompletion(messages, systemPrompt, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 8192, // Anthropic requires max_tokens, set high default
    } = options;

    const { messages: formattedMessages, system } = this.formatMessages(messages, systemPrompt);

    logger.info(`[Anthropic] Generating completion with ${this.model}`);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: formattedMessages,
    });

    return {
      content: response.content[0].text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      provider: this.provider,
      model: this.model,
    };
  }

  /**
   * Generate streaming completion
   */
  async *generateStreamingCompletion(messages, systemPrompt, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 8192, // Anthropic requires max_tokens, set high default
    } = options;

    const { messages: formattedMessages, system } = this.formatMessages(messages, systemPrompt);

    logger.info(`[Anthropic] Starting streaming with ${this.model}`);

    const stream = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: formattedMessages,
      stream: true,
    });

    for await (const event of stream) {
      // Content delta
      if (event.type === 'content_block_delta') {
        yield {
          type: 'content',
          content: event.delta.text,
        };
      }

      // Message completion
      if (event.type === 'message_stop') {
        // Usage info comes in message_start event, we need to track it
        yield {
          type: 'done',
          usage: {
            inputTokens: event.message?.usage?.input_tokens || 0,
            outputTokens: event.message?.usage?.output_tokens || 0,
            totalTokens: (event.message?.usage?.input_tokens || 0) + (event.message?.usage?.output_tokens || 0),
          },
        };
      }

      // Track usage from message_start
      if (event.type === 'message_start') {
        this._usage = event.message.usage;
      }

      // Use tracked usage in message_delta
      if (event.type === 'message_delta' && event.usage) {
        yield {
          type: 'done',
          usage: {
            inputTokens: this._usage?.input_tokens || 0,
            outputTokens: event.usage.output_tokens || 0,
            totalTokens: (this._usage?.input_tokens || 0) + (event.usage.output_tokens || 0),
          },
        };
      }
    }
  }
}

/**
 * Grok (xAI) Adapter
 * Uses OpenAI-compatible API, so inherits same interface as OpenAIAdapter
 */
class GrokAdapter {
  constructor() {
    this.client = grok;
    this.model = GROK_MODEL;
    this.provider = 'grok';
  }

  /**
   * Convert messages to Grok format (same as OpenAI)
   * Grok uses: [{ role: 'system'|'user'|'assistant', content: '...' }]
   */
  formatMessages(messages, systemPrompt) {
    const formatted = [];

    if (systemPrompt) {
      formatted.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      formatted.push({
        role: msg.role,
        content: msg.content
      });
    }

    return formatted;
  }

  /**
   * Generate non-streaming completion
   */
  async generateCompletion(messages, systemPrompt, options = {}) {
    const {
      temperature = 0.7,
      maxTokens,
    } = options;

    const formattedMessages = this.formatMessages(messages, systemPrompt);

    logger.info(`[Grok] Generating completion with ${this.model}`);

    const apiOptions = {
      model: this.model,
      messages: formattedMessages,
      temperature,
    };

    // Only add max_tokens if explicitly provided
    if (maxTokens) {
      apiOptions.max_tokens = maxTokens;
    }

    const response = await this.client.chat.completions.create(apiOptions);

    return {
      content: response.choices[0].message.content,
      usage: {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
      provider: this.provider,
      model: this.model,
    };
  }

  /**
   * Generate streaming completion
   */
  async *generateStreamingCompletion(messages, systemPrompt, options = {}) {
    const {
      temperature = 0.7,
      maxTokens,
    } = options;

    const formattedMessages = this.formatMessages(messages, systemPrompt);

    logger.info(`[Grok] Starting streaming with ${this.model}`);

    const apiOptions = {
      model: this.model,
      messages: formattedMessages,
      temperature,
      stream: true,
    };

    // Only add max_tokens if explicitly provided
    if (maxTokens) {
      apiOptions.max_tokens = maxTokens;
    }

    const stream = await this.client.chat.completions.create(apiOptions);

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield {
          type: 'content',
          content,
        };
      }

      // Check for completion
      if (chunk.choices[0]?.finish_reason === 'stop') {
        yield {
          type: 'done',
          usage: {
            inputTokens: chunk.usage?.prompt_tokens || 0,
            outputTokens: chunk.usage?.completion_tokens || 0,
            totalTokens: chunk.usage?.total_tokens || 0,
          },
        };
      }
    }
  }
}

/**
 * Get LLM adapter based on environment configuration
 *
 * @param {string} provider - Override provider ('openai', 'anthropic', or 'grok')
 * @returns {OpenAIAdapter|AnthropicAdapter|GrokAdapter}
 */
function getLLMAdapter(provider = null) {
  const selectedProvider = provider || DEFAULT_MODEL_PROVIDER;

  switch (selectedProvider.toLowerCase()) {
    case 'grok':
    case 'xai':
      logger.info(`[LLM Adapter] Using xAI Grok (${GROK_MODEL})`);
      return new GrokAdapter();

    case 'anthropic':
    case 'claude':
      logger.info(`[LLM Adapter] Using Anthropic Claude (${ANTHROPIC_MODEL})`);
      return new AnthropicAdapter();

    case 'openai':
    case 'gpt':
    default:
      logger.info(`[LLM Adapter] Using OpenAI GPT (${OPENAI_MODEL})`);
      return new OpenAIAdapter();
  }
}

/**
 * Get current provider name
 */
function getCurrentProvider() {
  return DEFAULT_MODEL_PROVIDER;
}

/**
 * Get model info
 */
function getModelInfo() {
  const provider = DEFAULT_MODEL_PROVIDER;

  let currentModel;
  if (provider === 'anthropic') {
    currentModel = ANTHROPIC_MODEL;
  } else if (provider === 'grok' || provider === 'xai') {
    currentModel = GROK_MODEL;
  } else {
    currentModel = OPENAI_MODEL;
  }

  return {
    provider,
    model: currentModel,
    available: {
      openai: OPENAI_MODEL,
      anthropic: ANTHROPIC_MODEL,
      grok: GROK_MODEL,
    },
  };
}

module.exports = {
  getLLMAdapter,
  getCurrentProvider,
  getModelInfo,
  OpenAIAdapter,
  AnthropicAdapter,
  GrokAdapter,
};
