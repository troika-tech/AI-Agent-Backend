const logger = require('../utils/logger');
const axios = require("axios");
const OpenAI = require('openai');
const Chatbot = require("../models/Chatbot");
const { retrieveRelevantChunks } = require("./queryService");
const languageService = require("./languageService");
const { getOrCreateLLMResponse } = require('../utils/llmCache');
const { getTimeContextForLLM } = require('../utils/timeUtils');
const { buildContextAwarePrompt } = require('./contextAwarePromptService');
const { parseResponse } = require('../utils/responseParser');
const { getLLMAdapter } = require('./llmAdapter');

// Initialize OpenAI client for streaming
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const { searchProducts, isProductQuery, extractProductFilters } = require('./vectorSearch');

// Feature flag for context-aware prompts (set to 'true' to enable new system)
const ENABLE_CONTEXT_AWARE_PROMPTS = process.env.ENABLE_CONTEXT_AWARE_PROMPTS === 'true';
// Lightweight timing utility -> log via central logger so it appears in files
function time(label, fn) {
  const start = Date.now();
  return fn().finally(() => {
    const ms = Date.now() - start;
    logger.info(`TIMING ${label} ms=${ms}`);
  });
}
const CHAT_TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS || 20000); // cap LLM latency
function isAffirmative(text) {
  const normalized = text.trim().toLowerCase();

  // English affirmatives
  const englishAffirmatives = [
    'yes', 'yeah', 'yep', 'sure', 'of course', 'okay', 'ok',
    'k', 'yup', 'indeed', 'absolutely', 'definitely', 'certainly',
    'go ahead', 'proceed', 'continue', 'tell me', 'please', 'show me'
  ];

  // Hindi affirmatives (Devanagari and romanized)
  const hindiAffirmatives = [
    'haan', 'ha', 'haa', 'han', 'हां', 'हाँ', 'जी', 'ji',
    'bilkul', 'बिल्कुल', 'theek hai', 'thik hai', 'ठीक है',
    'accha', 'achha', 'अच्छा', 'sahi', 'सही'
  ];

  // Marathi affirmatives (Devanagari and romanized)
  const marathiAffirmatives = [
    'ho', 'hoy', 'होय', 'होऊ दे', 'hou de', 'barobar', 'बरोबर',
    'thik', 'thike', 'ठीक', 'nakkichi', 'nakki', 'नक्की'
  ];

  // Tamil affirmatives (Tamil script and romanized)
  const tamilAffirmatives = [
    'aam', 'aamam', 'ஆம்', 'சரி', 'sari', 'okay', 'ok',
    'nalla', 'நல்லா', 'poitu', 'போயிட்டு'
  ];

  // Telugu affirmatives (Telugu script and romanized)
  const teluguAffirmatives = [
    'avunu', 'అవును', 'avnu', 'sare', 'సరే', 'okay',
    'baagundi', 'బాగుంది'
  ];

  // Kannada affirmatives (Kannada script and romanized)
  const kannadaAffirmatives = [
    'howdu', 'ಹೌದು', 'haudu', 'sari', 'ಸರಿ', 'okay',
    'yes', 'ಯೆಸ್'
  ];

  // Bengali affirmatives (Bengali script and romanized)
  const bengaliAffirmatives = [
    'hyan', 'হ্যাঁ', 'ha', 'thik', 'ठিক', 'ঠিক আছে', 'thik ache',
    'bhalo', 'ভালো', 'accha', 'अच्छा'
  ];

  // Gujarati affirmatives (Gujarati script and romanized)
  const gujaratiAffirmatives = [
    'ha', 'haa', 'હા', 'ખરું', 'kharu', 'thik', 'ठीक', 'ठીક',
    'okay', 'બરાબર', 'barabar'
  ];

  // Punjabi affirmatives (Gurmukhi and romanized)
  const punjabiAffirmatives = [
    'haan', 'ਹਾਂ', 'ji', 'ਜੀ', 'theek', 'ठीक', 'ਠੀਕ',
    'bilkul', 'ਬਿਲਕੁਲ'
  ];

  // Combine all affirmatives
  const allAffirmatives = [
    ...englishAffirmatives,
    ...hindiAffirmatives,
    ...marathiAffirmatives,
    ...tamilAffirmatives,
    ...teluguAffirmatives,
    ...kannadaAffirmatives,
    ...bengaliAffirmatives,
    ...gujaratiAffirmatives,
    ...punjabiAffirmatives
  ];

  // Check for exact match or starts with pattern
  for (const affirmative of allAffirmatives) {
    if (normalized === affirmative || normalized.startsWith(affirmative + ' ')) {
      return true;
    }
  }

  return false;
}

function isNegative(text) {
  const normalized = text.trim().toLowerCase();

  // English negatives
  const englishNegatives = [
    'no', 'nah', 'nope', 'not really', 'nay', 'never mind',
    'skip', 'pass', 'maybe later', 'not now', 'later'
  ];

  // Hindi negatives (Devanagari and romanized)
  const hindiNegatives = [
    'nahi', 'nhi', 'nahin', 'नहीं', 'na', 'ना', 'mat', 'मत',
    'nahi chahiye', 'नहीं चाहिए', 'rehne do', 'rehne de', 'रहने दो',
    'baad mein', 'बाद में', 'chhodo', 'छोड़ो'
  ];

  // Marathi negatives (Devanagari and romanized)
  const marathiNegatives = [
    'nahi', 'नाही', 'nakko', 'नक्को', 'nako', 'नको',
    'rehau de', 'rahau de', 'रहाऊ दे', 'nantar', 'नंतर',
    'sodun dya', 'सोडून द्या'
  ];

  // Tamil negatives (Tamil script and romanized)
  const tamilNegatives = [
    'illa', 'இல்ல', 'illai', 'இல்லை', 'venda', 'வேண்டா',
    'vendaam', 'வேண்டாம்', 'paravala', 'பரவாலை'
  ];

  // Telugu negatives (Telugu script and romanized)
  const teluguNegatives = [
    'kadhu', 'కాదు', 'kadu', 'ledhu', 'లేదు', 'ledu',
    'vaddhu', 'వద్దు', 'vaddu', 'taruvata', 'తరువాత'
  ];

  // Kannada negatives (Kannada script and romanized)
  const kannadaNegatives = [
    'illa', 'ಇಲ್ಲ', 'beda', 'ಬೇಡ', 'beku illa', 'ಬೇಕಿಲ್ಲ',
    'hakalla', 'ಹಾಕಲ್ಲ'
  ];

  // Bengali negatives (Bengali script and romanized)
  const bengaliNegatives = [
    'na', 'না', 'naa', 'nai', 'নাই', 'dorkar nai', 'দরকার নাই',
    'lage na', 'লাগে না', 'pore', 'পরে'
  ];

  // Gujarati negatives (Gujarati script and romanized)
  const gujaratiNegatives = [
    'nahi', 'નહિ', 'na', 'ના', 'nai', 'નઈ',
    'joie nahi', 'જોઈએ નહી', 'pachhi', 'પછી'
  ];

  // Punjabi negatives (Gurmukhi and romanized)
  const punjabiNegatives = [
    'nahi', 'ਨਹੀਂ', 'na', 'ਨਾ', 'nai', 'ਨਈ',
    'rehne de', 'ਰਹਿਣ ਦੇ', 'baad vich', 'ਬਾਅਦ ਵਿੱਚ'
  ];

  // Combine all negatives
  const allNegatives = [
    ...englishNegatives,
    ...hindiNegatives,
    ...marathiNegatives,
    ...tamilNegatives,
    ...teluguNegatives,
    ...kannadaNegatives,
    ...bengaliNegatives,
    ...gujaratiNegatives,
    ...punjabiNegatives
  ];

  // Check for exact match or starts with pattern
  for (const negative of allNegatives) {
    if (normalized === negative || normalized.startsWith(negative + ' ')) {
      return true;
    }
  }

  return false;
}
function needsElaboration(query) {
  if (!query) return false;
  const q = query.toLowerCase();
  return /explain|detail|details|how|why|steps|elaborat|more info|tell me|give me|list|examples?/i.test(
    q
  );
}
function extractKeywordsFromBotMessage(botMessage) {
  if (!botMessage) return null;

  // Try to detect if the message ends with a follow-up question
  const followUpQuestionPatterns = [
    /would you like to (?:know|hear|learn|understand)(?: more)?(?: about)?\s+(.+?)\?/i,
    /want to (?:know|hear|learn)(?: more)?(?: about)?\s+(.+?)\?/i,
    /interested in(?: learning| knowing)?(?: about)?\s+(.+?)\?/i,
    /curious about\s+(.+?)\?/i,
    /should i (?:explain|tell you)(?: about)?\s+(.+?)\?/i,
    /can i (?:explain|tell you)(?: about)?\s+(.+?)\?/i,
    /(?:want|need) (?:to know|details on)\s+(.+?)\?/i
  ];

  // Try to extract the specific topic from the follow-up question
  for (const pattern of followUpQuestionPatterns) {
    const match = botMessage.match(pattern);
    if (match && match[1]) {
      // Clean and return the extracted topic
      const topic = match[1]
        .toLowerCase()
        .replace(/\b(the|a|an|our|your|my)\b/g, " ")
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (topic.length > 0) {
        logger.info(`Extracted follow-up topic from question: "${topic}"`);
        return topic;
      }
    }
  }

  // Fallback: Original keyword extraction (for non-question contexts)
  const cleanedMessage = botMessage
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(do|you|want|to|know|would|like|can|i|help|with|about|the|a|an|is|are|and|or|but|if|then|else|this|that|these|those)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const keywords = cleanedMessage
    .split(" ")
    .filter((word) => word.length > 2)
    .slice(0, 8)
    .join(" ");
  return keywords || null;
}
const KBQ_TAG_REGEX = /\[KBQ:\s*([^\]]+)\]/i;
const SUGGESTIONS_TAG_REGEX = /\[SUGGESTIONS:\s*([^\]]+)\]/i;

function extractKbqTag(text) {
  if (!text || typeof text !== "string") return null;
  const match = KBQ_TAG_REGEX.exec(text);
  return match ? match[1].trim() : null;
}

function extractSuggestions(text) {
  if (!text || typeof text !== "string") return [];
  const match = SUGGESTIONS_TAG_REGEX.exec(text);
  if (!match) return [];
  
  try {
    // Extract the suggestions string and split by delimiter
    const suggestionsStr = match[1].trim();
    // Split by pipe or semicolon
    const suggestions = suggestionsStr
      .split(/\||;/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && s.length <= 150) // Reasonable question length
      .slice(0, 3); // Max 3 suggestions
    
    return suggestions;
  } catch (err) {
    logger.warn(`Failed to parse suggestions: ${err.message}`);
    return [];
  }
}

// Generate suggestions via focused LLM call when main response doesn't include them
// async function generateSuggestionsViaLLM(answer, query, context = "") {
//   try {

//     const suggestionPrompt = `Based on this conversation, generate 3 natural follow-up questions a user might ask.

// USER ASKED: "${query}"

// BOT RESPONDED: "${answer}"

// ${context ? `CONTEXT:\n${context.substring(0, 500)}` : ''}

// Generate exactly 3 short, natural follow-up questions (under 100 characters each) that would help the user learn more. Questions should be directly related to the answer provided.

// Respond ONLY with the questions separated by | character, nothing else.
// Example: What are the pricing details? | How do I get started? | Can I see a demo?`;

//     const response = await axios.post(
//       "https://api.openai.com/v1/chat/completions",
//       {
//         model: "gpt-4o-mini",
//         messages: [{ role: "user", content: suggestionPrompt }],
//         temperature: 0.8,
//         max_tokens: 150,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//           "Content-Type": "application/json",
//         },
//         timeout: 10000, // Increase timeout to 10 seconds
//       }
//     );

//     const suggestionsText = response.data.choices[0].message.content.trim();

//     const suggestions = suggestionsText
//       .split('|')
//       .map(s => s.trim())
//       .filter(s => s.length > 0 && s.length <= 150)
//       .slice(0, 3);

//     logger.info(`LLM-generated ${suggestions.length} suggestions:`, suggestions);

//     if (suggestions.length > 0) {
//       return suggestions;
//     }
//   } catch (error) {
//     logger.error(`Failed to generate suggestions via LLM:`, {
//       message: error.message,
//       code: error.code,
//       response: error.response?.data
//     });
//   }

//   logger.warn('Returning empty suggestions array');
//   return [];
// }

function prepareAssistantMessage(rawText) {
  if (!rawText) {
    return { 
      cleanAnswer: "", 
      assistantMessageForHistory: "", 
      kbFollowUpQuery: null,
      suggestions: []
    };
  }
  
  const kbFollowUpQuery = extractKbqTag(rawText);
  const suggestions = extractSuggestions(rawText);
  
  // Remove both KBQ and SUGGESTIONS tags from the answer
  let cleanAnswer = rawText
    .replace(KBQ_TAG_REGEX, "")
    .replace(SUGGESTIONS_TAG_REGEX, "")
    .trim();
  
  // Reconstruct message for history with tags
  let assistantMessageForHistory = cleanAnswer;
  if (kbFollowUpQuery) {
    assistantMessageForHistory += `${cleanAnswer ? " " : ""}[KBQ: ${kbFollowUpQuery}]`;
  }
  if (suggestions.length > 0) {
    assistantMessageForHistory += ` [SUGGESTIONS: ${suggestions.join(" | ")}]`;
  }
  assistantMessageForHistory = assistantMessageForHistory.trim();
  
  return { cleanAnswer, assistantMessageForHistory, kbFollowUpQuery, suggestions };
}
async function generateAnswer(
  query,
  contextChunks,
  clientConfig = {},
  historyContext = [],
  chatbotId,
  botDoc, // Pass botDoc to avoid redundant fetch
  sessionId = null, // Add sessionId for session-based history filtering
  languageHint = null, // Add language hint from voice input
  userContext = {} // Add user context (name, phone, email)
) {
  // Process query for language once (with optional hint from Whisper)
  const processedQuery = await languageService.processQuery(query, languageHint);
  historyContext = historyContext.map((h) => ({
    role:
      h.role.toLowerCase() === "bot"
        ? "assistant"
        : h.role.toLowerCase() === "user"
        ? "user"
        : h.role,
    content: h.content,
  }));
  const normalisedChunks = (Array.isArray(contextChunks) ? contextChunks : [])
    .map((chunk) => (typeof chunk === "string" ? chunk.trim() : String(chunk ?? "").trim()))
    .filter((chunk) => chunk.length > 0);
  const seenChunks = new Set();
  const cleanedChunks = [];
  for (const chunk of normalisedChunks) {
    if (!seenChunks.has(chunk)) {
      seenChunks.add(chunk);
      cleanedChunks.push(chunk);
    }
  }
  const hasKbContext = cleanedChunks.length > 0;
  const topChunks = cleanedChunks.slice(0, 5);
  const context = topChunks.join("\n---\n");
  
  // Deduplicate messages (DB query already filtered by sessionId)
  // historyContext comes from DB with correct session_id filter applied
  const uniqueHistory = [];
  const seenMessages = new Set();
  for (const message of historyContext) {
    if (message.content && !seenMessages.has(message.content)) {
      uniqueHistory.push(message);
      seenMessages.add(message.content);
    }
  }
  
  // Limit to last 10 PAIRS (user-bot), which is 20 messages max
  let trimmedHistory = uniqueHistory;
  if (uniqueHistory.length > 20) {
    trimmedHistory = uniqueHistory.slice(-20);
  }
  const lastBotMessage =
    trimmedHistory.filter((m) => m.role === "assistant").slice(-1)[0]
      ?.content || "";

  // 🔍 LOG: Follow-up detection start
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`🔍 FOLLOW-UP DETECTION ANALYSIS`);
  logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`📝 User Query: "${query}"`);
  logger.info(`📜 Last Bot Message: "${lastBotMessage.substring(0, 150)}${lastBotMessage.length > 150 ? '...' : ''}"`);

  const lastKbFollowUpQuery = extractKbqTag(lastBotMessage);

  // 🔍 LOG: KBQ tag extraction result
  if (lastKbFollowUpQuery) {
    logger.info(`✅ [KBQ TAG] Found in bot message: "${lastKbFollowUpQuery}"`);
  } else {
    logger.warn(`⚠️ [KBQ TAG] NOT FOUND in bot message - will use keyword extraction`);
  }

  if (isAffirmative(query)) {
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`✅ AFFIRMATIVE RESPONSE DETECTED`);
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`🌍 User said: "${query}" (multilingual support active)`);

    const followUpQuery =
      lastKbFollowUpQuery || extractKeywordsFromBotMessage(lastBotMessage);

    // 🔍 LOG: Follow-up query determination
    if (lastKbFollowUpQuery) {
      logger.info(`✅ [FOLLOW-UP QUERY] Using KBQ tag: "${followUpQuery}"`);
    } else {
      logger.warn(`⚠️ [FOLLOW-UP QUERY] No KBQ tag, using keyword extraction: "${followUpQuery}"`);
    }

    let relevantKbContext = "";
    if (followUpQuery) {
      logger.info(`🔎 [KB RETRIEVAL] Starting retrieval for: "${followUpQuery}"`);
      try {
        const kbChunks = await time(
          "retrieve context",
          () => retrieveRelevantChunks(followUpQuery, chatbotId, 3, 0.7),
        );
        if (kbChunks && kbChunks.length > 0) {
          relevantKbContext = kbChunks.map((chunk) => chunk.content).join("\n---\n");
          logger.info(`✅ [KB RETRIEVAL] Retrieved ${kbChunks.length} chunks (${relevantKbContext.length} chars)`);
          logger.info(`📚 [KB PREVIEW] "${relevantKbContext.substring(0, 200)}..."`);
        } else {
          logger.warn(`⚠️ [KB RETRIEVAL] No chunks found for: "${followUpQuery}"`);
        }
      } catch (err) {
        logger.error(`❌ [KB RETRIEVAL] Error: ${err.message}`);
      }
    } else {
      logger.error(`❌ [FOLLOW-UP QUERY] No query extracted! Cannot retrieve KB context.`);
    }
    const followUpSections = [
      `The last assistant message was:
"${lastBotMessage}"`,
      `The user replied with "${query}", meaning they want to proceed and get more details.`,
    ];
    if (followUpQuery) {
      followUpSections.push(`FOLLOW-UP QUERY:
${followUpQuery}`);
    }
    if (relevantKbContext) {
      followUpSections.push(`RELEVANT KNOWLEDGE BASE CONTEXT:
${relevantKbContext}`);
    }
    if (context) {
      followUpSections.push(`PRIMARY CONTEXT:
${context}`);
    }
    followUpSections.push(
      getTimeContextForLLM(),
      "RESPONSE STYLE:\n- Write like you're texting - brief, engaging, and natural\n- NO bullet points, NO numbered lists - use flowing sentences\n- Maximum 4 lines (60-80 words) - keep it SHORT and impactful\n- Weave details into sentences using connectors like 'Plus,' 'Also,' 'And'\n- Do NOT repeat introductions or ask the same question again\n- Pack maximum value into minimum words\n- Do NOT provide any links",
      "🔴 CRITICAL - KNOWLEDGE BASE RESTRICTION:\n" +
      "- DO NOT provide information that is NOT in the provided knowledge base context or conversation history\n" +
      "- ONLY use information from the knowledge base and ongoing conversation context\n" +
      "- If information is not available in the provided context, politely say you don't have that information\n" +
      "- DO NOT hallucinate, guess, or make up information outside the provided context",
      // TEMPORARILY COMMENTED OUT - Suggestion buttons generation
      /*
      "🔴 CRITICAL - SUGGESTION QUESTIONS:\n" +
      "YOU MUST END YOUR RESPONSE WITH 2-3 FOLLOW-UP QUESTIONS.\n" +
      "Format: [SUGGESTIONS: question1 | question2 | question3]\n" +
      "Example: [SUGGESTIONS: What are the pricing details? | How do I get started? | Can I see a demo?]\n" +
      "⚠️ ALWAYS include this tag at the end of your response!"
      */
      ""
    );
    const followUpPrompt = `${followUpSections.join("\n\n")}
`;
    const followUpMessages = [
      { role: "system", content: followUpPrompt },
      { role: "assistant", content: lastBotMessage },
      { role: "user", content: query },
    ];
    try {
      // 🔍 LOG: LLM request start
      logger.info(`🤖 [LLM REQUEST] Calling OpenAI with follow-up context...`);
      logger.info(`📊 [LLM CONFIG] Model: gpt-4o-mini, Temperature: 0.7`);

      const promptKey = `followup:${JSON.stringify(followUpMessages)}`;
      const response = await time("llm call", () =>
        getOrCreateLLMResponse(
          promptKey,
          async () =>
            axios.post(
              "https://api.openai.com/v1/chat/completions",
              {
                model: "gpt-4o-mini",
                messages: followUpMessages,
                temperature: 0.7,
              },
              {
                headers: {
                  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                  "Content-Type": "application/json",
                },
                timeout: CHAT_TIMEOUT_MS,
              },
            ),
        ),
      );
      const rawAnswer = response.data.choices[0].message.content || "";

      // 🔍 LOG: LLM response received
      logger.info(`✅ [LLM RESPONSE] Received response (${rawAnswer.length} chars, ${response.data.usage?.total_tokens || 0} tokens)`);
      logger.info(`📝 [LLM RESPONSE PREVIEW] "${rawAnswer.substring(0, 300)}..."`);

      // 🔍 LOG: Check for KBQ tag in response
      const hasKbqTag = /\[KBQ:/i.test(rawAnswer);
      if (hasKbqTag) {
        const kbqMatch = rawAnswer.match(/\[KBQ:\s*([^\]]+)\]/i);
        logger.info(`✅ [BOT GENERATED KBQ] Found in response: "${kbqMatch ? kbqMatch[1] : 'unknown'}"`);
      } else {
        logger.warn(`⚠️ [BOT GENERATED KBQ] NOT FOUND in response - bot forgot to add [KBQ: ...] tag!`);
      }

      // Debug logging for follow-up suggestions
      const hasSuggestionTag = /\[SUGGESTIONS:/i.test(rawAnswer);
      logger.info(`[SUGGESTIONS] Tag present: ${hasSuggestionTag}`);
      if (!hasSuggestionTag) {
        logger.warn(`[SUGGESTIONS] LLM did not generate suggestions tag`);
      }

      let { cleanAnswer, assistantMessageForHistory, kbFollowUpQuery, suggestions } =
        prepareAssistantMessage(rawAnswer);
      logger.info(`[PARSING] Cleaned answer: ${cleanAnswer.length} chars`);
      logger.info(`[PARSING] Suggestions count: ${suggestions?.length || 0}`);
      logger.info(`[PARSING] KBQ for next turn: "${kbFollowUpQuery || 'none'}"`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`✅ FOLLOW-UP RESPONSE COMPLETE`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Fallback: Generate suggestions via separate LLM call if not included
      // if (!suggestions || suggestions.length === 0) {
      //   logger.info('Follow-up: Generating suggestions via separate LLM call');
      //   suggestions = await generateSuggestionsViaLLM(cleanAnswer, query, relevantKbContext);
      //   logger.info(`Follow-up: Generated ${suggestions.length} suggestions via LLM`);
      // }
      
      if (processedQuery.needsTranslation) {
        const translatedResponse = await languageService.processResponse(
          cleanAnswer,
          processedQuery.language,
          processedQuery.isRomanized, // Pass romanized flag
        );
        return {
          answer: translatedResponse.translatedResponse,
          tokens: response.data.usage?.total_tokens || 0,
          originalLanguage: processedQuery.language,
          assistantMessageForHistory,
          kbFollowUpQuery,
          suggestions,
        };
      }
    return {
      answer: cleanAnswer,
      tokens: response.data.usage?.total_tokens || 0,
      assistantMessageForHistory,
      kbFollowUpQuery,
      suggestions,
      productContext,
      productFeatureEnabled,
    };
    } catch (error) {
      logger.error(
        `Error generating follow-up: ${
          error.response?.data ? JSON.stringify(error.response.data) : error.message
        }`,
      );
      const fallback = "Sorry, I couldn't retrieve the details right now.";
      return {
        answer: fallback,
        tokens: 0,
        assistantMessageForHistory: fallback,
        kbFollowUpQuery: null,
        suggestions: [],
        productContext: "",
        productFeatureEnabled: false,
      };
    }
  }
  if (isNegative(query)) {
    logger.info(`❌ Negative response detected: "${query}" (multilingual support active)`);
    const moveOn = "Alright, we can move on. What would you like to talk about next?";
    return {
      answer: moveOn,
      tokens: 0,
      assistantMessageForHistory: moveOn,
      kbFollowUpQuery: null,
      suggestions: [],
      productContext: "",
      productFeatureEnabled: false,
    };
  }
  
  // Retrieve knowledge base chunks for main query if not already provided
  let relevantKbContext = "";
  if (cleanedChunks.length === 0 && chatbotId) {
    try {
      const kbChunks = await time(
        "retrieve context",
        () => retrieveRelevantChunks(query, chatbotId, 5, 0.7),
      );
      if (kbChunks && kbChunks.length > 0) {
        relevantKbContext = kbChunks.map((chunk) => chunk.content).join("\n---\n");
        // Update cleanedChunks with knowledge base content
        cleanedChunks.push(...kbChunks.map(chunk => chunk.content));
      }
    } catch (err) {
      logger.warn(`KB retrieval error in main query: ${err.message}`);
    }
  }

  // Check if this is a product-related query and search products
  let productContext = "";
  let productFeatureEnabled = false;

  const isProduct = isProductQuery(query);

  if (isProduct) {
    try {
      const filters = extractProductFilters(query);
      const products = await time(
        "product search",
        () => searchProducts({ 
          text: query, 
          limit: 3, 
          minScore: 0.01, // Lowered to 0.01 for better matching
          filters 
        })
      );
      
      if (products && products.length > 0) {
        productFeatureEnabled = true;
        productContext = products.map(product => {
          const price = product.priceNum ? `₹${product.priceNum}` : `₹${product.price}`;
          const sizes = product.available_sizes ? product.available_sizes.slice(0, 3).join(', ') : 'Various sizes';
          const colors = product.colors && product.colors.length > 0 ? product.colors.slice(0, 2).join(', ') : 'Various colors';
          const materials = product.materials && product.materials.length > 0 ? product.materials.slice(0, 2).join(', ') : 'Premium materials';
          
          return `PRODUCT: ${product.title}
PRICE: ${price}
SIZES: ${sizes}
COLORS: ${colors}
MATERIALS: ${materials}
IMAGE: ${product.image}
SIMILARITY: ${(product.similarity * 100).toFixed(1)}%`;
        }).join('\n\n');
        
        logger.info(`Found ${products.length} products for query: "${query}"`);
      }
    } catch (err) {
      logger.warn(`Product search error: ${err.message}`);
    }
  }

  // Check if query should trigger interactive buttons
  if (query.includes('service') || query.includes('offer') || query.includes('provide') || 
      query.includes('what do you') || query.includes('help') || query.includes('options')) {
    relevantKbContext += "\n\n[RESPONSE_TRIGGER: SEND_BUTTONS]";
  } else if (query.includes('price') || query.includes('cost') || query.includes('pricing') || 
             query.includes('plan') || query.includes('package')) {
    relevantKbContext += "\n\n[RESPONSE_TRIGGER: SEND_LIST]";
  }
  
  const mainTopic =
    cleanedChunks[0]?.split(" ").slice(0, 8).join(" ") ||
    "the current discussion";
  let chatbotPersona;
  try {
    chatbotPersona = botDoc?.persona_text;
  } catch (err) {
    console.error("Error fetching chatbot persona:", err.message);
  }
  const fallbackPersona = `
You are Supa Agent - an enthusiastic company rep who chats like you're texting a friend about something exciting.

🎯 YOUR COMMUNICATION STYLE:
- Write in short, punchy, engaging sentences - like quick text messages
- Maximum 4 lines TOTAL - be brief and impactful
- NO bullet points, NO numbered lists, NO structured formatting
- Use energy and enthusiasm in your word choice
- Be warm, approachable, and genuinely helpful
- Think: "How would I explain this in an exciting 3-line text?"

🔴 CRITICAL - KNOWLEDGE BASE RESTRICTION:
- DO NOT provide information that is NOT in the provided knowledge base context or conversation history
- ONLY use information from the knowledge base and ongoing conversation context
- If information is not available in the provided context, politely say you don't have that information and redirect to relevant topics
- DO NOT hallucinate, guess, or make up information outside the provided context

BREVITY RULES:
- Brief answers: 2-3 lines max (30-50 words) - This is the DEFAULT
- Detailed answers (only when asked): 3-4 lines max (60-80 words)
- Use natural connectors like "Plus," "Also," "And"
- Pack maximum value into minimum words
- ONLY elaborate when the user explicitly asks for more detail (e.g., "explain", "how", "details", "steps", "examples")
- Never say you're an AI - you're a helpful team member
- When you ask for confirmation before sharing more details, end the message with a hidden tag like [KBQ: pricing tiers] that captures the retrieval keywords
- Do NOT provide any links

EXAMPLE OF WRONG vs RIGHT:
❌ WRONG (too long): "Here are the key features: 1. 24/7 availability 2. Multi-language support 3. Lead capture. It works around the clock answering questions."
✅ RIGHT (brief & engaging): "It works 24/7 in any language, captures every lead, and never sleeps. Your business stays open even when you don't!"
`;
  // Dynamically build the product-related part of the prompt
  let productInstructions = `MAIN GOAL:
- If the user asks something unrelated, politely decline and steer back to "${mainTopic}".`;

  if (productFeatureEnabled) {
    productInstructions = `--- RELEVANT PRODUCTS FOUND FOR THIS QUERY ---
${productContext}

CRITICAL INSTRUCTIONS FOR PRODUCT QUERIES:
- Products are listed above - mention them naturally and briefly (max 4 lines)
- NEVER say "we don't have" or "not available" when products are listed above
- Talk about them like you're texting a friend a quick exciting recommendation
- Use the exact product titles, prices, and details provided above
- Do not share product links

BRIEF PRODUCT STYLE:
- Keep it SHORT - 2-3 lines maximum
- Example: "Check out the [Product Name] in [color] for just ₹[price]! It's perfect for [use case] and comes in [sizes]."
- Sound excited but brief - like you're sharing a quick hot tip
- NO long descriptions - just the essentials that excite them`;
  }

  // BUILD SYSTEM PROMPT - Use context-aware version if enabled
  let systemPrompt;

  if (ENABLE_CONTEXT_AWARE_PROMPTS) {
    // NEW: Context-aware prompt with anti-repetition and language matching
    logger.info('🎯 [CONTEXT-AWARE] Building clean, focused system prompt');
    systemPrompt = buildContextAwarePrompt({
      persona: chatbotPersona || fallbackPersona,
      kbContext: hasKbContext ? context : null,
      conversationHistory: trimmedHistory,
      userQuery: processedQuery.translatedQuery || query,
      productInstructions: productInstructions,
      userContext: userContext,
    });
  } else {
    // OLD: Original cluttered prompt (fallback)
    logger.info('⚠️ [LEGACY MODE] Using original system prompt');
    systemPrompt = `🔴🔴🔴 CRITICAL INSTRUCTION - READ FIRST 🔴🔴🔴

KNOWLEDGE BASE RESTRICTION:
- You can ONLY answer questions using information from the "Your knowledge base" section provided below
- If the user's question is NOT related to the knowledge base content, you MUST politely decline
- DO NOT use your general training knowledge to answer questions outside the knowledge base
- DO NOT answer questions about: programming, code, celebrities, sports, history, science, or any general knowledge topics
- When a question is outside your knowledge base, respond with: "I apologize, but I can only help with [mention 2-3 topics from your knowledge base]. Is there anything related to these services I can help you with?"

---

🎯 CONVERSATIONAL STYLE (ABSOLUTELY CRITICAL - READ THIS):
- Write like a real human texting - warm, friendly, engaging, and BRIEF
- NEVER use bullet points, numbered lists, or any structured formatting
- Use short, punchy sentences with natural connectors: "Plus," "Also," "And," "What's great is..."
- Maximum 4 lines of text - keep it SHORT and impactful
- Sound enthusiastic and helpful through your word choice, not through formatting
- Think: "How would I explain this in a quick, exciting text message?"

LENGTH REQUIREMENT:
- Brief responses: 2-3 lines maximum (30-50 words)
- Detailed responses (when asked): 3-4 lines maximum (60-80 words)
- NEVER exceed 4 lines - if you can't fit it, you're saying too much

EXAMPLE OF WRONG vs RIGHT:
❌ WRONG: "Here are the benefits: 1. 24/7 availability 2. Multi-language support 3. Lead capture"
✅ RIGHT: "It works 24/7 answering questions in any language and captures every lead automatically. Never miss an opportunity again!"

---

${chatbotPersona || fallbackPersona}

---

${getTimeContextForLLM()}

KB_CONTEXT_AVAILABLE: ${hasKbContext}`;

    if (hasKbContext && context) {
      systemPrompt += `\n\n=== YOUR KNOWLEDGE BASE (ONLY SOURCE OF TRUTH) ===\n${context}\n=== END OF KNOWLEDGE BASE ===`;
    } else {
      systemPrompt += `\n\n⚠️ WARNING: No knowledge base provided. You should politely decline to answer and suggest the user contact support.`;
    }

    if (productInstructions) {
      systemPrompt += `\n\n${productInstructions}`;
    }
  }

  // Add critical instructions for follow-up tagging (ONLY in legacy mode)
  // Context-aware mode already includes simplified KBQ instructions
  if (!ENABLE_CONTEXT_AWARE_PROMPTS) {
    systemPrompt += `\n\n🔴🔴🔴 CRITICAL REQUIREMENT - FOLLOW-UP QUESTION TAGGING 🔴🔴🔴
⚠️⚠️⚠️ SYSTEM WILL FAIL IF YOU DO NOT INCLUDE THIS TAG ⚠️⚠️⚠️

MANDATORY RULE (NON-NEGOTIABLE):
- WHENEVER you end your response with a follow-up question (asking if the user wants more info), you MUST add a [KBQ: keywords] tag
- The [KBQ: ...] tag should contain specific keywords that describe what information to retrieve when the user says "yes"
- This tag is HIDDEN from the user but CRITICAL for maintaining conversation context
- WITHOUT this tag, the system will provide INCORRECT information when the user responds

WHEN TO ADD [KBQ: ...] TAG:
✅ When asking: "Would you like to know...", "Want to hear more about...", "Interested in...", "Curious about..."
✅ When asking: "Would you like to explore...", "Should I explain...", "Can I tell you more about..."
✅ ANY question that expects a yes/no response for more details
✅ EVERY single follow-up question - NO EXCEPTIONS

HOW TO CREATE THE TAG (CRITICAL):
- Extract the EXACT TOPIC from your follow-up question
- Use 2-4 specific keywords that describe WHAT the user wants to learn (not HOW they'll use it)
- The keywords should match the SUBJECT of what you're offering to explain next
- Place the tag at the very end of your response (after the question)

REAL-WORLD EXAMPLES (STUDY THESE):

Example 1 - Features Question:
❌ WRONG: "Would you like to explore how these features can specifically benefit your business?" (NO TAG!)
✅ CORRECT: "Would you like to explore how these features can specifically benefit your business? [KBQ: agent benefits business applications ROI advantages]"

Example 2 - Pricing Question:
❌ WRONG: "Want to know the pricing? [KBQ: info]" (too vague)
✅ CORRECT: "Want to know the pricing? [KBQ: pricing plans cost packages fees]"

Example 3 - Setup Question:
❌ WRONG: "Interested in the setup process?" (NO TAG!)
✅ CORRECT: "Interested in the setup process? [KBQ: setup implementation timeline onboarding steps]"

Example 4 - Integration Question:
❌ WRONG: "Should I explain how it integrates? [KBQ: integration]" (too short)
✅ CORRECT: "Should I explain how it integrates? [KBQ: integration process API CRM connections setup]"

Example 5 - Benefits Question:
❌ WRONG: "Curious about the benefits? [KBQ: benefits]" (too generic)
✅ CORRECT: "Curious about the benefits? [KBQ: benefits advantages ROI value impact results]"

Example 6 - Use Cases Question:
❌ WRONG: "Want to know how businesses use it?" (NO TAG!)
✅ CORRECT: "Want to know how businesses use it? [KBQ: use cases applications examples industries success stories]"

🔴 CRITICAL MATCHING RULE:
The keywords in [KBQ: ...] MUST match what you're ACTUALLY offering to explain.
- If asking about "benefits" → use keywords: benefits, advantages, ROI, value
- If asking about "pricing" → use keywords: pricing, cost, plans, packages
- If asking about "features" → use keywords: features, capabilities, functionality
- If asking about "setup" → use keywords: setup, implementation, onboarding, timeline

⚠️ SYSTEM BEHAVIOR WITHOUT TAG:
If you forget the [KBQ: ...] tag, when the user says "yes", the system will:
1. NOT know what topic you were asking about
2. Extract wrong keywords from your message
3. Provide COMPLETELY WRONG information (e.g., pricing when they asked about benefits)
4. Create a BROKEN user experience

✅ COMPLIANCE CHECK:
Before sending your response, ask yourself:
1. Does my response end with a follow-up question? → YES/NO
2. If YES, did I add [KBQ: keywords]? → YES/NO
3. Do the keywords match what I'm offering to explain? → YES/NO
4. Are there 2-4 specific keywords (not generic ones)? → YES/NO

If ANY answer is NO, ADD THE TAG NOW!

⚠️⚠️⚠️ THIS IS ABSOLUTELY CRITICAL - DO NOT SKIP THIS STEP! ⚠️⚠️⚠️`;
  } // End of !ENABLE_CONTEXT_AWARE_PROMPTS check


  // Strong emphasis on suggestions
  // TEMPORARILY COMMENTED OUT - Suggestion buttons generation
  /*
  systemPrompt += `\n\n🔴 CRITICAL REQUIREMENT - SUGGESTION QUESTIONS:\n` +
    `YOU MUST END EVERY RESPONSE WITH 2-3 FOLLOW-UP QUESTIONS.\n\n` +
    `FORMAT (REQUIRED):\n` +
    `[SUGGESTIONS: question1 | question2 | question3]\n\n` +
    `RULES:\n` +
    `- Place the [SUGGESTIONS: ...] tag at the very end of your response\n` +
    `- Generate 2-3 questions the user would naturally ask next\n` +
    `- Make questions specific to the answer you just provided\n` +
    `- Keep each question under 100 characters\n` +
    `- Use simple, natural language\n` +
    `- Separate questions with the | character\n\n` +
    `EXAMPLE RESPONSE:\n` +
    `"We offer three pricing plans starting at $99/month. Each plan includes 24/7 support and unlimited users.\n\n` +
    `[SUGGESTIONS: What's included in each plan? | Do you offer discounts? | Can I try it free?]"\n\n` +
    `⚠️ DO NOT SKIP THIS STEP - ALWAYS include the [SUGGESTIONS: ...] tag!`;
  */

  const messages = [
    ...trimmedHistory,
    { role: "user", content: query },
  ];

  try {
    // Use LLM adapter (supports both OpenAI and Claude)
    const llmAdapter = getLLMAdapter();
    logger.info(`[Generate Answer] Using provider: ${llmAdapter.provider}, model: ${llmAdapter.model}`);

    const promptKey = `main:${llmAdapter.provider}:${JSON.stringify(messages)}`;
    const response = await time('llm call', () => getOrCreateLLMResponse(promptKey, async () => {
      // Use adapter's generateCompletion method (no maxTokens limit)
      return await llmAdapter.generateCompletion(messages, systemPrompt, {
        temperature: 0.7,
      });
    }));

    // Adapter returns normalized response format
    const rawAnswer = response.content || "";
    
    // Debug logging for suggestion generation
    logger.info(`Raw LLM response length: ${rawAnswer.length}`);
    const hasSuggestionTag = /\[SUGGESTIONS:/i.test(rawAnswer);
    logger.info(`Suggestions tag present: ${hasSuggestionTag}`);
    if (!hasSuggestionTag) {
      logger.warn(`LLM did not generate suggestions tag. Raw response: ${rawAnswer.substring(0, 200)}...`);
    }
    
    let { cleanAnswer, assistantMessageForHistory, kbFollowUpQuery, suggestions } = prepareAssistantMessage(rawAnswer);
    logger.info(`Parsed suggestions count: ${suggestions?.length || 0}`);
    
    // Check for button response triggers and convert them
    if (cleanAnswer.includes('[RESPONSE_TRIGGER: SEND_BUTTONS]')) {
      cleanAnswer = cleanAnswer.replace(/\[RESPONSE_TRIGGER: SEND_BUTTONS\]/g, '[SEND_BUTTONS]');
    }
    if (cleanAnswer.includes('[RESPONSE_TRIGGER: SEND_LIST]')) {
      cleanAnswer = cleanAnswer.replace(/\[RESPONSE_TRIGGER: SEND_LIST\]/g, '[SEND_LIST]');
    }
    
    // Fallback: Generate suggestions via separate LLM call if not included
    // if (!suggestions || suggestions.length === 0) {
    //   logger.info('Main: Generating suggestions via separate LLM call');
    //   const contextSummary = topChunks.slice(0, 2).join('\n');
    //   suggestions = await generateSuggestionsViaLLM(cleanAnswer, query, contextSummary);
    //   logger.info(`Main: Generated ${suggestions.length} suggestions via LLM`);
    // }
    
    // Translate response if original query was not in English
    if (processedQuery.needsTranslation) {
      const translatedResponse = await languageService.processResponse(
        cleanAnswer,
        processedQuery.language,
        processedQuery.isRomanized, // Pass romanized flag
      );
      return {
        answer: translatedResponse.translatedResponse,
        tokens: response.usage?.totalTokens || 0,
        originalLanguage: processedQuery.language,
        assistantMessageForHistory,
        kbFollowUpQuery,
        suggestions,
        productContext,
        productFeatureEnabled,
      };
    }
    return {
      answer: cleanAnswer,
      tokens: response.usage?.totalTokens || 0,
      assistantMessageForHistory,
      kbFollowUpQuery,
      suggestions,
      productContext,
      productFeatureEnabled,
    };
  } catch (error) {
    logger.error(`Error generating response: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
    return {
      answer:
        "Sorry, I'm having trouble right now. Could you try rephrasing your request?",
      tokens: 0,
      assistantMessageForHistory: "Sorry, I'm having trouble right now. Could you try rephrasing your request?",
      kbFollowUpQuery: null,
      suggestions: [],
      productContext: "",
      productFeatureEnabled: false,
    };
  }
}
/**
 * Generate streaming answer (async generator for StreamingResponseService)
 * Similar to generateAnswer but yields chunks as they arrive
 */
async function* generateStreamingAnswer(
  query,
  contextChunks,
  clientConfig = {},
  historyContext = [],
  chatbotId,
  productContext,
  productFeatureEnabled,
  botDoc,
  sessionId = null,
  languageHint = null,
  userContext = {}
) {
  try {
    // Process query for language
    const processedQuery = await languageService.processQuery(query, languageHint);

    // Prepare history context (same as non-streaming)
    historyContext = historyContext.map((h) => ({
      role: h.role.toLowerCase() === "bot" ? "assistant" : h.role.toLowerCase() === "user" ? "user" : h.role,
      content: h.content,
    }));

    // Clean and dedupe chunks
    const normalisedChunks = (Array.isArray(contextChunks) ? contextChunks : [])
      .map((chunk) => {
        if (typeof chunk === "string") return chunk.trim();
        if (chunk && typeof chunk === "object" && chunk.content) return chunk.content.trim();
        return String(chunk ?? "").trim();
      })
      .filter((chunk) => chunk.length > 0 && chunk !== "[object Object]");

    const seenChunks = new Set();
    const cleanedChunks = [];
    for (const chunk of normalisedChunks) {
      if (!seenChunks.has(chunk)) {
        seenChunks.add(chunk);
        cleanedChunks.push(chunk);
      }
    }

    // Deduplicate messages (DB query already filtered by sessionId)
    // historyContext comes from DB with correct session_id filter applied
    const uniqueHistory = [];
    const seenMessages = new Set();
    for (const message of historyContext) {
      if (message.content && !seenMessages.has(message.content)) {
        uniqueHistory.push(message);
        seenMessages.add(message.content);
      }
    }

    let trimmedHistory = uniqueHistory;
    if (uniqueHistory.length > 20) {
      trimmedHistory = uniqueHistory.slice(-20);
    }

    // Check for affirmative/negative follow-up responses (multilingual support)
    const lastBotMessage = trimmedHistory.filter((m) => m.role === "assistant").slice(-1)[0]?.content || "";

    // 🔍 LOG: Streaming follow-up detection start
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`🌊 [STREAMING] FOLLOW-UP DETECTION ANALYSIS`);
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`📝 User Query: "${query}"`);
    logger.info(`📜 Last Bot Message: "${lastBotMessage.substring(0, 150)}${lastBotMessage.length > 150 ? '...' : ''}"`);

    const lastKbFollowUpQuery = extractKbqTag(lastBotMessage);

    // 🔍 LOG: KBQ tag extraction result for streaming
    if (lastKbFollowUpQuery) {
      logger.info(`✅ [STREAMING KBQ TAG] Found: "${lastKbFollowUpQuery}"`);
    } else {
      logger.warn(`⚠️ [STREAMING KBQ TAG] NOT FOUND - will use keyword extraction`);
    }

    // Handle affirmative follow-ups (yes, ho, haan, etc.)
    if (isAffirmative(query)) {
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`✅ [STREAMING] AFFIRMATIVE RESPONSE DETECTED`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`🌍 User said: "${query}" (multilingual support active)`);

      const followUpQuery = lastKbFollowUpQuery || extractKeywordsFromBotMessage(lastBotMessage);

      // 🔍 LOG: Follow-up query determination for streaming
      if (lastKbFollowUpQuery) {
        logger.info(`✅ [STREAMING FOLLOW-UP QUERY] Using KBQ tag: "${followUpQuery}"`);
      } else {
        logger.warn(`⚠️ [STREAMING FOLLOW-UP QUERY] No KBQ, using keywords: "${followUpQuery}"`);
      }

      // Retrieve additional context for the follow-up
      if (followUpQuery && chatbotId) {
        logger.info(`🔎 [STREAMING KB RETRIEVAL] Starting for: "${followUpQuery}"`);
        try {
          const kbChunks = await retrieveRelevantChunks(followUpQuery, chatbotId, 3, 0.7);
          if (kbChunks && kbChunks.length > 0) {
            const followUpContext = kbChunks.map((chunk) => chunk.content).join("\n---\n");
            // Add follow-up context to cleaned chunks (prepend for priority)
            cleanedChunks.unshift(followUpContext);
            logger.info(`✅ [STREAMING KB RETRIEVAL] Added ${kbChunks.length} chunks (${followUpContext.length} chars)`);
            logger.info(`📚 [STREAMING KB PREVIEW] "${followUpContext.substring(0, 200)}..."`);
          } else {
            logger.warn(`⚠️ [STREAMING KB RETRIEVAL] No chunks found for: "${followUpQuery}"`);
          }
        } catch (err) {
          logger.error(`❌ [STREAMING KB RETRIEVAL] Error: ${err.message}`);
        }
      } else {
        logger.error(`❌ [STREAMING FOLLOW-UP QUERY] No query! Cannot retrieve KB context.`);
      }
    }

    // Handle negative follow-ups (no, nahi, nakko, etc.)
    if (isNegative(query)) {
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`❌ [STREAMING] NEGATIVE RESPONSE DETECTED`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`🌍 User said: "${query}" (multilingual support active)`);
    }

    // Build context from chunks (including any follow-up context added above)
    const hasKbContext = cleanedChunks.length > 0;
    const topChunks = cleanedChunks.slice(0, 5);
    const context = topChunks.join("\n---\n");

    // Build system prompt - Use context-aware version if enabled
    const basePersona = botDoc?.persona_text || "You are a helpful assistant.";
    const cleanPersona = basePersona.replace(/\[SUGGESTIONS:.*?\]/gi, '').replace(/SUGGESTION QUESTIONS.*?(?=\n\n|\n[A-Z]|$)/gs, '').trim();

    let systemPrompt;

    if (ENABLE_CONTEXT_AWARE_PROMPTS) {
      // NEW: Context-aware prompt for streaming
      logger.info('🎯 [STREAMING CONTEXT-AWARE] Building clean, focused system prompt');
      systemPrompt = buildContextAwarePrompt({
        persona: cleanPersona,
        kbContext: hasKbContext ? context : null,
        conversationHistory: trimmedHistory,
        userQuery: processedQuery.translatedQuery || query,
        productInstructions: '', // No product instructions in streaming
        userContext: userContext,
      });
    } else {
      // OLD: Original streaming prompt
      logger.info('⚠️ [STREAMING LEGACY] Using original system prompt');
      const timeContext = getTimeContextForLLM();

      systemPrompt = `🔴🔴🔴 CRITICAL INSTRUCTION - READ FIRST 🔴🔴🔴

KNOWLEDGE BASE RESTRICTION:
- You can ONLY answer questions using information from the "Your knowledge base" section provided below
- If the user's question is NOT related to the knowledge base content, you MUST politely decline
- DO NOT use your general training knowledge to answer questions outside the knowledge base
- DO NOT answer questions about: programming, code, celebrities, sports, history, science, or any general knowledge topics
- When a question is outside your knowledge base, respond with: "I apologize, but I can only help with [mention 2-3 topics from your knowledge base]. Is there anything related to these services I can help you with?"

---

${cleanPersona}

---

🎯 CONVERSATIONAL STYLE (CRITICAL):
- Write like you're texting - brief, engaging, natural
- NO bullet points, NO numbered lists, NO structured formatting at all
- Maximum 4 lines TOTAL - keep it SHORT and punchy
- Use flowing sentences with natural connectors: "Plus," "Also," "And"
- Sound genuine and enthusiastic through your words, not formatting
- Target: 2-3 lines (30-50 words) for best engagement

---

${timeContext}`;

      if (hasKbContext) {
        systemPrompt += `\n\n=== YOUR KNOWLEDGE BASE (ONLY SOURCE OF TRUTH) ===\n${context}\n=== END OF KNOWLEDGE BASE ===`;
      } else {
        systemPrompt += `\n\n⚠️ WARNING: No knowledge base provided. You should politely decline to answer and suggest the user contact support.`;
      }

      // Add instruction to NOT include suggestions in response
      systemPrompt += `\n\nIMPORTANT: Provide a clear, natural, conversational answer without any special tags, bullet points, or numbered lists. Do NOT include [SUGGESTIONS:...] or similar tags in your response.`;

      // Add KBQ tagging instructions for follow-up support
      systemPrompt += `\n\n🔴🔴🔴 CRITICAL REQUIREMENT - FOLLOW-UP QUESTION TAGGING 🔴🔴🔴
⚠️⚠️⚠️ SYSTEM WILL FAIL IF YOU DO NOT INCLUDE THIS TAG ⚠️⚠️⚠️

MANDATORY RULE (NON-NEGOTIABLE):
- WHENEVER you end your response with a follow-up question, you MUST add a [KBQ: keywords] tag
- WITHOUT this tag, the system will provide INCORRECT information when the user responds
- The keywords MUST match the EXACT TOPIC you're offering to explain

WHEN TO ADD [KBQ: ...] TAG:
✅ EVERY follow-up question - NO EXCEPTIONS
✅ When asking: "Would you like to know/explore...", "Interested in...", "Curious about..."

REAL-WORLD EXAMPLES:
❌ WRONG: "Would you like to explore how these features benefit your business?" (NO TAG!)
✅ CORRECT: "Would you like to explore how these features benefit your business? [KBQ: agent benefits business applications ROI]"

❌ WRONG: "Want to know the pricing?" (NO TAG!)
✅ CORRECT: "Want to know the pricing? [KBQ: pricing plans cost packages]"

🔴 CRITICAL MATCHING RULE:
- Asking about "benefits" → [KBQ: benefits advantages ROI value]
- Asking about "pricing" → [KBQ: pricing cost plans packages]
- Asking about "features" → [KBQ: features capabilities functionality]
- Asking about "setup" → [KBQ: setup implementation timeline steps]

⚠️ WITHOUT TAG: User says "yes" → System provides WRONG information!
⚠️⚠️⚠️ THIS IS ABSOLUTELY CRITICAL - DO NOT SKIP! ⚠️⚠️⚠️`;
    }


    // Build messages array
    let messages = [{ role: "system", content: systemPrompt }];

    // Add history (filter out null content)
    for (const msg of trimmedHistory) {
      if (msg.content && typeof msg.content === 'string' && msg.content.trim().length > 0) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current user query (use translatedQuery for processing, or originalQuery if translation not needed)
    const queryContent = processedQuery.translatedQuery || processedQuery.originalQuery || query;
    messages.push({ role: "user", content: queryContent });

    // 🔍 LOG: Streaming LLM request start
    const llmAdapter = getLLMAdapter();
    logger.info(`🤖 [STREAMING LLM] Calling ${llmAdapter.provider} (${llmAdapter.model})...`);
    logger.info(`📝 [STREAMING LLM] Context: ${hasKbContext ? `${topChunks.length} KB chunks` : 'No KB context'}`);

    // Prepare messages for adapter (exclude system prompt from messages array)
    const messagesForAdapter = messages.filter(msg => msg.role !== 'system');

    // Start streaming using LLM adapter (supports both OpenAI and Claude, no maxTokens limit)
    const stream = llmAdapter.generateStreamingCompletion(messagesForAdapter, systemPrompt, {
      temperature: 0.7,
    });

    // Process stream using adapter's unified format
    let fullAnswer = '';
    const MAX_RESPONSE_LENGTH = 2000; // Edge case: limit response length to prevent very long responses
    let tokenCount = 0;
    let firstTokenReceived = false;
    let usage = null;

    for await (const event of stream) {
      if (event.type === 'content') {
        const token = event.content;

        if (!firstTokenReceived) {
          logger.info(`✅ [STREAMING LLM] First token received, starting stream...`);
          firstTokenReceived = true;
        }

        // Edge case: Check if we've exceeded max response length
        if (fullAnswer.length >= MAX_RESPONSE_LENGTH) {
          logger.warn(`⚠️ [STREAMING LLM] Response truncated at ${MAX_RESPONSE_LENGTH} characters`);
          fullAnswer += '...';
          yield {
            type: 'text',
            data: '...'
          };
          break; // Stop streaming
        }

        tokenCount++;
        fullAnswer += token;
        yield {
          type: 'text',
          data: token
        };
      }

      // Capture usage information
      if (event.type === 'done' && event.usage) {
        usage = event.usage;
      }
    }

    // 🔍 LOG: Streaming complete
    logger.info(`✅ [STREAMING LLM] Stream complete (${fullAnswer.length} chars, ${tokenCount} tokens)`);
    logger.info(`📝 [STREAMING RESPONSE] "${fullAnswer.substring(0, 300)}..."`);

    // 🔍 LOG: Check for KBQ tag in streaming response
    const hasKbqTag = /\[KBQ:/i.test(fullAnswer);
    if (hasKbqTag) {
      const kbqMatch = fullAnswer.match(/\[KBQ:\s*([^\]]+)\]/i);
      logger.info(`✅ [STREAMING BOT KBQ] Found: "${kbqMatch ? kbqMatch[1] : 'unknown'}"`);
    } else {
      logger.warn(`⚠️ [STREAMING BOT KBQ] NOT FOUND - bot forgot to add [KBQ: ...] tag!`);
    }

    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.info(`✅ [STREAMING] RESPONSE COMPLETE`);
    logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);


    // Generate suggestions via separate LLM call (don't rely on text stream)
    // logger.info('Streaming: Generating suggestions via separate LLM call');
    // const contextSummary = topChunks.slice(0, 2).join('\n');
    // const suggestions = await generateSuggestionsViaLLM(fullAnswer, query, contextSummary);
    // logger.info(`Streaming: Generated ${suggestions.length} suggestions`);

    // Yield suggestions
    if (suggestions && suggestions.length > 0) {
      yield {
        type: 'suggestions',
        data: suggestions
      };
    }

    // Yield completion
    yield {
      type: 'complete',
      data: {
        detectedLanguage: processedQuery.detectedLanguage,
        wordCount: fullAnswer.split(/\s+/).filter(Boolean).length
      }
    };

  } catch (error) {
    logger.error('Error in streaming chat generation:', error);
    throw error;
  }
}

module.exports = {
  generateAnswer,
  generateStreamingAnswer,
  // Export helper functions for testing
  extractSuggestions,
  prepareAssistantMessage,
  // generateSuggestionsViaLLM
};

