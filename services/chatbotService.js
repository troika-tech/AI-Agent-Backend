// services/chatbotService.js
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const logger = require("../utils/logger");
const { getClient: getRedisClient } = require("../lib/redis");

const Subscription = require("../models/Subscription");
const Chatbot = require("../models/Chatbot");
const Message = require("../models/Message");

const { retrieveRelevantChunks } = require("./queryService");
const { generateAnswer } = require("./chatService");
const { getClientConfig } = require("./configService");
const { isProductQuery, extractProductFilters } = require("./productIntentService");
const { cachedSearchProducts: searchProducts } = require("./productSearchService");

const { normStr, emptyOrMissing } = require("../utils/validationHelpers");
const { formatPrice, replaceRupeesForTTS } = require("../utils/formatters");
const { cleanInputText } = require("../utils/textCleaner");
const ApiError = require("../utils/ApiError");
const { getMatchingIntentLink } = require("../utils/intentHelpers");
const { processAnswerQuerySchema } = require("../schemas/serviceSchemas");
const { calculateTypingDelay } = require("../utils/typingIndicator");

// Lightweight timing utility
function time(label, fn) {
  const start = Date.now();
  return fn().finally(() => {
    const ms = Date.now() - start;
    logger.info(`TIMING ${label} ms=${ms}`);
  });
}

const PRODUCT_WAIT_MS = Number(process.env.PRODUCT_WAIT_MS || 2000); // don't block longer than 2s
// New: feature flags via env
const PRODUCT_SEARCH_ENABLED = String(process.env.PRODUCT_SEARCH_ENABLED || 'true').toLowerCase() === 'true';
// New: soft cap waiting for TTS before returning text
const TTS_WAIT_BUDGET_MS = Number(process.env.TTS_WAIT_BUDGET_MS || 8000);

async function processAnswerQuery({ query, chatbotId, sessionId, email, phone, name, language }) {
  // Validate inputs via centralized schema
  const { error, value } = processAnswerQuerySchema.validate(
    { query, chatbotId, sessionId, email, phone, name },
    { convert: true, stripUnknown: true }
  );
  if (error) {
    throw ApiError.badRequest("Invalid input: " + error.details.map(d => d.message).join(", "));
  }
  ({ query, chatbotId, sessionId, email, phone, name } = value);
  query = normStr(query);
  email = normStr(email);
  phone = normStr(phone);
  const languageHint = language || null; // Accept language from voice input

  if (!query) {
    throw ApiError.badRequest("Please ask anything");
  }

  if (!sessionId) sessionId = uuidv4();

  // Phase 1: Parallel independent operations
  const [subscription, clientConfig, botDoc, productIntent] = await Promise.all([
    Subscription.findOne({ chatbot_id: chatbotId, status: "active" }).populate("plan_id"),
    getClientConfig(chatbotId),
    Chatbot.findById(chatbotId).lean().catch(() => null),
    // Intent detection can safely run early; failures are non-fatal
    isProductQuery(query).catch(() => false),
  ]);

  if (!subscription) {
    throw ApiError.forbidden("This chatbot's subscription is inactive");
  }
  if (new Date() > new Date(subscription.end_date)) {
    throw ApiError.forbidden("This chatbot's subscription has expired");
  }

  const authMethod = clientConfig?.auth_method || "email";
  const freeMessages = typeof clientConfig?.free_messages === "number" ? clientConfig.free_messages : 1;
  const requireAuthText = clientConfig?.require_auth_text || "Sign in to continue.";

  let guestFilter;
  if (authMethod === "email") {
    guestFilter = emptyOrMissing("email");
  } else if (authMethod === "whatsapp") {
    guestFilter = emptyOrMissing("phone");
  } else {
    guestFilter = { $and: [emptyOrMissing("email"), emptyOrMissing("phone")] };
  }

  const isAuthenticated = authMethod === "email" ? !!email : authMethod === "whatsapp" ? !!phone : !!(email || phone);

  // Early gate: compute guest message count before expensive context retrieval
  const guestMessageCount = await Message.countDocuments({ chatbot_id: chatbotId, session_id: sessionId, sender: "user", ...guestFilter });
  if (!isAuthenticated && guestMessageCount >= freeMessages) {
    return {
      type: "NEED_AUTH",
      payload: {
        error: "NEED_AUTH",
        message: requireAuthText,
        auth_method: authMethod,
        free_messages: freeMessages,
        sessionId,
      },
    };
  }

  // Determine if product feature is enabled from config or bot doc
  const productFeatureEnabled = !!(clientConfig?.product_enabled || botDoc?.product_enabled);

  // If enabled and intent detected, kick off product search in background while we fetch context
  let productSearchPromise = Promise.resolve(null);
  if (PRODUCT_SEARCH_ENABLED && productFeatureEnabled && productIntent) {
    productSearchPromise = (async () => {
      try {
        const filters = await extractProductFilters(query);
        const searchArgs = {
          q: query,
          productId: filters.productId,
          url: filters.url,
          size: filters.size,
          color: filters.color,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          exactPrice: filters.exactPrice,
          in_stock: true,
          limit: 3,
        };
        return await searchProducts(searchArgs);
      } catch (err) {
        logger.warn(`Product search crashed: ${err.message}`);
        return null;
      }
    })();
  }

  // Phase 2: Parallel context retrieval and message history
  const [chunks, recentMessages] = await Promise.all([
    time('retrieve context', () => retrieveRelevantChunks(query, chatbotId)),
    Message.find({ chatbot_id: chatbotId, session_id: sessionId })
      .sort({ timestamp: -1 })
      .limit(25) // Fetch more to ensure we have enough pairs after deduplication
      .lean(),
  ]);
  const topContext = chunks.map((c) => c.content);

  const historyContext = recentMessages.reverse().map((msg) => ({
    role: msg.sender === "user" ? "user" : "bot",
    content: msg.content,
    sessionId: msg.session_id, // Include sessionId for filtering in chatService
  }));

  const matchedLink = getMatchingIntentLink(query, clientConfig?.link_intents || []);

  // Await product search result if it was started
  // Bound the wait: if product search is slow, don't block core answer
  const productSearchResult = await Promise.race([
    productSearchPromise,
    new Promise((resolve) => setTimeout(() => resolve(null), PRODUCT_WAIT_MS)),
  ]).catch(() => null);

  // Build product context for LLM
  let productContext = "No specific products were found for this query.";
  if (productSearchResult && productSearchResult.results && productSearchResult.results.length > 0) {
    productContext = "Here are the top products found that match the user's query:\n\n";
    productSearchResult.results.slice(0, 5).forEach((product, index) => {
      productContext += `Product ${index + 1}:\n`;
      productContext += `- Title: ${product.title}\n`;
      productContext += `- Price: ${product.price} ${product.currency}\n`;
      productContext += `- Description: ${product.description}\n`;
      productContext += `- In Stock: ${product.in_stock ? 'Yes' : 'No'}\n`;
      if (product.available_sizes && product.available_sizes.length > 0) {
        productContext += `- Available Sizes: ${product.available_sizes.join(', ')}\n`;
      }
      if (product.colors && product.colors.length > 0) {
        productContext += `- Available Colors: ${product.colors.join(', ')}\n`;
      }
      productContext += `- Product URL: ${product.url}\n\n`;
    });
    productContext += `Total products found: ${productSearchResult.results.length}\n`;
  }

  // Phase 3: Generate answer (sequential)
  const { answer, tokens, assistantMessageForHistory, kbFollowUpQuery, suggestions } = await time('generate answer', () => generateAnswer(
    query,
    topContext,
    clientConfig,
    historyContext,
    chatbotId,
    botDoc,
    sessionId, // Pass sessionId for session-based history filtering
    languageHint, // Pass language hint from voice input to skip detection
    { name, email, phone } // Pass user context (name, phone, email)
  ));

  const linkMarkup = `🔗 [Click here for more info](${matchedLink})`;
  let finalAnswer = matchedLink ? `${answer}\n\n${linkMarkup}` : answer;
  let historyAnswer = matchedLink
    ? `${assistantMessageForHistory || answer}\n\n${linkMarkup}`
    : assistantMessageForHistory || answer;
  finalAnswer = finalAnswer.replace(/₹(\d{1,3}(?:,\d{3})*)/g, (match) => formatPrice(match));
  historyAnswer = historyAnswer.replace(/₹(\d{1,3}(?:,\d{3})*)/g, (match) => formatPrice(match));

  const ttsInput = cleanInputText(replaceRupeesForTTS(finalAnswer));
  const cleanedAnswer = cleanInputText(ttsInput);

  logger.info('TIMING post processing ms=0'); // Placeholder, as it's sync

  // TTS in parallel with DB writes to minimize tail latency
  const ttsPromise = time('tts', () => (async () => {
    try {
      const TTS_BASE_URL = process.env.TTS_BASE_URL || "https://api.0804.in";
      // Use a larger request timeout to allow background completion; initial response is still capped by TTS_WAIT_BUDGET_MS
      const TTS_REQUEST_TIMEOUT_MS = Number(process.env.TTS_REQUEST_TIMEOUT_MS || 20000);
      // Trim overly long texts sent to TTS to avoid slow synthesis
      const ttsText = (cleanedAnswer || '').slice(0, Number(process.env.TTS_MAX_CHARS || 800));
      const ttsResponse = await axios.post(`${TTS_BASE_URL}/api/text-to-speech`, { text: ttsText }, { timeout: TTS_REQUEST_TIMEOUT_MS });
      const ttsJson = ttsResponse && ttsResponse.data && typeof ttsResponse.data === 'object' ? ttsResponse.data : JSON.parse(ttsResponse.data);
      const dataUrl = String(ttsJson.audio || '');
      const base64String = dataUrl.split(",")[1] || '';
      const audioBuffer = base64String ? Buffer.from(base64String, "base64") : null;
      const contentType = dataUrl.split(";")[0].replace("data:", "");
      return { data: audioBuffer, dataUrl, contentType };
    } catch (ttsError) {
      logger.warn(`TTS unavailable; sending response without audio: ${ttsError.message}`);
      return null;
    }
  })());

  // Prepare a TTS job id and persist the finished audio in Redis for later polling
  const ttsJobId = uuidv4();
  ttsPromise.then(async (audioObj) => {
    try {
      if (!audioObj || !audioObj.dataUrl) return;
      const redis = getRedisClient && getRedisClient();
      if (!redis) return;
      const payload = { audio: audioObj.dataUrl, contentType: audioObj.contentType };
      await redis.setEx(`tts:job:${ttsJobId}`, Number(process.env.TTS_JOB_TTL_SEC || 600), JSON.stringify(payload));
    } catch (e) {
      logger.warn(`Failed to cache TTS job ${ttsJobId}: ${e.message}`);
    }
  }).catch(() => {});

  // Persist messages and token usage in parallel
  await Promise.all([
    Message.insertMany([
      { chatbot_id: chatbotId, session_id: sessionId, email: email || null, phone: phone || null, sender: "user", content: query, timestamp: new Date(), token_count: 0, is_guest: !isAuthenticated },
      { chatbot_id: chatbotId, session_id: sessionId, email: email || null, phone: phone || null, sender: "bot", content: historyAnswer, timestamp: new Date(), token_count: tokens, is_guest: !isAuthenticated },
    ]),
    Chatbot.findByIdAndUpdate(
      chatbotId,
      { $inc: { used_tokens: tokens, used_today: tokens } },
      { lean: true }
    ).catch(() => {}),
  ]);

  const newGuestCount = guestMessageCount + 1;
  const requiresAuthNext = !isAuthenticated && newGuestCount >= freeMessages;

  // Wait strategy: if TTS isn't ready within 8s, send text now and let client poll for TTS via job id.
  const audio = await Promise.race([
    ttsPromise,
    new Promise((resolve) => setTimeout(() => resolve(null), TTS_WAIT_BUDGET_MS))
  ]);

  // Calculate typing indicator delay for frontend
  const typingDelay = calculateTypingDelay(finalAnswer);

  // Build response payload: include text answer; include audio if ready; otherwise attach polling info.
  const payload = {
    answer: finalAnswer,
    link: matchedLink || null,
    tokens,
    audio,
    sessionId,
    requiresAuthNext,
    auth_method: authMethod,
    typingDelay, // Time in ms for frontend to show typing indicator
    ...(audio ? {} : { tts_job_id: ttsJobId, tts_poll_url: `/api/text-to-speech/${ttsJobId}` }),
  };

  if (kbFollowUpQuery) {
    payload.kb_follow_up_query = kbFollowUpQuery;
  }

  // Return suggestions in a separate response field (not embedded in answer text)
  // Note: The suggestions tag [SUGGESTIONS: ...] is already removed from the answer text
  // by prepareAssistantMessage() in chatService.js
  if (suggestions && suggestions.length > 0) {
    payload.suggestions = suggestions;
  }

  if (productSearchResult) {
    const results = Array.isArray(productSearchResult.results)
      ? productSearchResult.results
      : Array.isArray(productSearchResult.products)
      ? productSearchResult.products
      : Array.isArray(productSearchResult)
      ? productSearchResult
      : [];

    const inStock = results.filter((r) => r.in_stock === true);
    const uniqueProducts = [];
    const seenIds = new Set();
    const seenUrls = new Set();

    for (const product of inStock) {
      const productId = product.productId || product._id;
      const productUrl = product.url;
      if (seenIds.has(productId) || seenUrls.has(productUrl)) continue;
      seenIds.add(productId);
      seenUrls.add(productUrl);
      uniqueProducts.push(product);
      if (uniqueProducts.length >= 3) break;
    }

    if (uniqueProducts.length) {
      payload.product_cards = {
        query,
        total: uniqueProducts.length,
        cards: uniqueProducts.map((r) => ({ url: r.url, title: r.title, image: r.image, price: r.price, available_sizes: r.available_sizes })),
      };
    }
  }

  return { type: "OK", payload };
}

module.exports = {
  processAnswerQuery,
};

