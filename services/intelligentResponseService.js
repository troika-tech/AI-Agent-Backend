const openai = require('../config/openai');
const IntentDetectionService = require('./intentDetectionService');
const MarketIntelligenceVectorSearch = require('./marketIntelligenceVectorSearch');
const RedisSessionManager = require('./redisSessionManager');
const IndustryContextService = require('./industryContextService');
const SuggestionPredictionService = require('./suggestionPredictionService');
const ObjectionHandlerService = require('./objectionHandlerService');
const RealTimeStatsService = require('./realTimeStatsService');
const { retrieveRelevantChunks } = require('./queryService');
const Chatbot = require('../models/Chatbot');
const logger = require('../utils/logger');

// Fallback KB (used only if no chatbotId provided or KB retrieval fails)
const FALLBACK_KB = {
  company: {
    name: 'Your Company',
    description: 'AI-powered digital solutions provider',
    mission: 'Provide intelligent business solutions',
  },
  services: {
    'AI Solutions': {
      description: 'AI-powered platform with multilingual support',
      features: [
        '24/7 automated customer support',
        'Lead generation',
        'Multi-channel integration',
        'Analytics and insights',
      ],
      pricing: 'Contact for pricing details',
      industries: ['Various industries supported'],
    },
  },
  contact: {
    email: 'contact@yourcompany.com',
    phone: 'Contact number',
    website: 'https://yourcompany.com',
    address: 'Your location',
  },
};

class IntelligentResponseService {
  constructor() {
    this.intentDetectionService = new IntentDetectionService();
    this.vectorSearchService = new MarketIntelligenceVectorSearch();
    this.sessionManager = new RedisSessionManager();
    this.industryContextService = new IndustryContextService();
    this.suggestionPredictionService = new SuggestionPredictionService();
    this.objectionHandlerService = new ObjectionHandlerService();
    this.realTimeStatsService = new RealTimeStatsService();
    this.model = 'gpt-4o-mini'; // Fast and efficient model matching normal chat route

    // For extracting the content of the first [SUGGESTIONS: ...] tag
    this.SUGGESTIONS_REGEX = /\[SUGGESTIONS:\s*([^\]]+)\]/i;

    // For removing ALL [SUGGESTIONS: ...] tags from the final answer
    this.SUGGESTIONS_REMOVE_ALL = /\[SUGGESTIONS:\s*[^\]]+\]/gi;
  }

  /**
   * Extract suggestions from AI response
   * @private
   */
  _extractSuggestions(text) {
    if (!text || typeof text !== 'string') return [];
    const match = this.SUGGESTIONS_REGEX.exec(text);
    if (!match) return [];
    try {
      const suggestionsStr = match[1].trim();
      const suggestions = suggestionsStr
        .split(/\||;/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 150)
        .slice(0, 3);
      return suggestions;
    } catch (err) {
      logger.warn(`Failed to parse suggestions: ${err.message}`);
      return [];
    }
  }

  /**
   * Ensure exactly three suggestions (dedupe, then pad with defaults)
   * @private
   * DISABLED: Suggestions generation has been turned off
   */
  _ensureThreeSuggestions(primary = [], fallback = []) {
    // Suggestions disabled - return empty array
    return [];

    /* ORIGINAL CODE - COMMENTED OUT
    const deduped = Array.from(new Set((primary || []).filter(Boolean)));
    for (const s of fallback || []) {
      if (deduped.length >= 3) break;
      if (s && !deduped.includes(s)) deduped.push(s);
    }
    const pads = [
      'Tell me about AI Websites',
      'How does Supa Agent work?',
      'What's the pricing?',
    ];
    for (const p of pads) {
      if (deduped.length >= 3) break;
      if (!deduped.includes(p)) deduped.push(p);
    }
    return deduped.slice(0, 3);
    */
  }

  /**
   * Clean suggestions tag from answer (remove all occurrences)
   * @private
   */
  _cleanAnswer(text) {
    if (!text) return '';
    return text.replace(this.SUGGESTIONS_REMOVE_ALL, '').trim();
  }

  /**
   * Generate intelligent response with market intelligence
   * @param {Object} params - Request parameters
   * @returns {Object} - Response with answer, intelligence, and session info
   */
  async generateResponse({ query, chatbotId, sessionId, email, phone, name, context = {} }) {
    try {
      logger.info(`Generating intelligent response for: "${query}" (chatbot: ${chatbotId || 'none'})`);

      // Detect intent and intelligence level
      const intentAnalysis = await this.intentDetectionService.analyzeQuery(query);
      const intelligenceLevel = intentAnalysis.intelligenceLevel;
      logger.info(`Intelligence level: ${intelligenceLevel}`);

      // Detect objections
      const detectedObjections = this.objectionHandlerService.detectObjection(query);
      const hasObjection = detectedObjections.length > 0;

      // Check if follow-up
      const isFollowUp = this.intentDetectionService.isFollowUp(query);

      // Detect if user is requesting details/explanations
      const detailRequestKeywords = [
        'tell me more',
        'explain more',
        'more details',
        'elaborate',
        'in detail',
        'how does it work',
        'how can it',
        'how do you',
        'how will',
        'explain',
        'tell me about',
        'what are the details',
        'can you explain',
        'give me more',
        'more info',
        'detailed',
        'expand on',
        'walk me through',
        'break it down',
        'describe',
      ];
      const isDetailRequest = detailRequestKeywords.some((keyword) => query.toLowerCase().includes(keyword));

      // Decide whether to include real-time stats
      const shouldIncludeStats = this.realTimeStatsService.shouldIncludeStats(query, intelligenceLevel);

      // Parallel data fetch
      const [chatbotPersona, kbContext, session, marketIntelligence, objectionHandlers, realTimeStats, currentOffer] =
        await Promise.all([
          // Persona
          chatbotId
            ? Chatbot.findById(chatbotId)
                .select('persona_text')
                .lean()
                .then((botDoc) => {
                  const persona = botDoc?.persona_text;
                  if (persona) {
                    logger.info(`✅ Retrieved custom persona for chatbot ${chatbotId}`);
                    if (process.env.NODE_ENV !== 'production') {
                      console.log('📋 Chatbot Persona Preview:', persona.substring(0, 200) + '...');
                    }
                  } else {
                    logger.warn(`⚠️ No persona found for chatbot ${chatbotId}, using fallback`);
                  }
                  return persona;
                })
                .catch((error) => {
                  logger.error('Error fetching chatbot persona:', error);
                  return null;
                })
            : Promise.resolve(null),

          // KB chunks
          chatbotId
            ? retrieveRelevantChunks(query, chatbotId, 10, 0)
                .then((chunks) => chunks.map((c) => c.content)) // avoid shadowing "context"
                .catch((error) => {
                  logger.error('Error retrieving KB chunks:', error);
                  return [];
                })
            : Promise.resolve([]),

          // Session
          sessionId ? this.sessionManager.getSession(sessionId).catch(() => null) : Promise.resolve(null),

          // Market intelligence
          // TEMPORARILY COMMENTED OUT - Market Intelligence KB Source
          // intelligenceLevel !== 'NONE' ? this._retrieveIntelligence(query, intelligenceLevel, context) : Promise.resolve([]),
          Promise.resolve([]),

          // Objection handlers
          hasObjection ? this.objectionHandlerService.getObjectionHandlers(detectedObjections) : Promise.resolve([]),

          // Real-time stats
          shouldIncludeStats ? this.realTimeStatsService.getStats() : Promise.resolve(null),

          // Current offers
          shouldIncludeStats ? this.realTimeStatsService.getCurrentOffers() : Promise.resolve(null),
        ]);

      // Follow-up but missing session
      if (isFollowUp && !session) {
        logger.warn('Follow-up detected but no session found, treating as new query');
      }

      // Objection logs
      if (hasObjection) {
        logger.info(`🚨 Objection handling: ${objectionHandlers.length} handlers retrieved`);
        if (objectionHandlers.length > 0) {
          logger.info(`   📋 Handlers: ${objectionHandlers.map((h) => h.title).join(', ')}`);
        }
      }

      // Industry context
      const industryContext = this.industryContextService.getIndustryContext(
        query,
        'AI Websites', // default service
        context
      );

      if (industryContext?.hasContext) {
        logger.info(`🏢 Industry detected: ${industryContext.industry}`);
        logger.info(`   📋 Pain points: ${industryContext.painPoints?.length || 0}`);
        logger.info(`   📅 Workflow: ${industryContext.workflow ? 'yes' : 'no'}`);
        logger.info(
          `   ⭐ Benefits: ${industryContext.benefits ? Object.keys(industryContext.benefits).length : 0}`
        );
      }

      // Real-time stats logs
      if (shouldIncludeStats) {
        logger.info(`📊 Real-time stats included`);
        if (realTimeStats) {
          logger.info(`   👥 Active clients: ${realTimeStats.activeClients}+`);
          logger.info(`   📅 Years in business: ${realTimeStats.yearsInBusiness}`);
        }
        if (currentOffer?.hasOffer) {
          logger.info(`   🎁 Current offer: ${currentOffer.offerText}`);
        }
      }

      // Response mode
      const useDetailedMode = isDetailRequest || (isFollowUp && session?.detailRequested);
      logger.info(useDetailedMode ? '🔵 DETAILED MODE activated' : '🟢 BRIEF MODE activated');

      // Prompts - normalize empty strings to null
      const userContext = {
        name: name && name.trim() ? name.trim() : null,
        email: email && email.trim() ? email.trim() : null,
        phone: phone && phone.trim() ? phone.trim() : null
      };
      logger.info(`🔍 User Context: name="${userContext.name || 'NONE'}", email="${userContext.email || 'NONE'}", phone="${userContext.phone || 'NONE'}"`);
      const systemPrompt = this._buildSystemPrompt(intelligenceLevel, chatbotPersona, useDetailedMode, userContext);
      if (userContext.name || userContext.phone || userContext.email) {
        logger.info(`✅ User context IS present - system prompt should include customer information`);
      } else {
        logger.info(`⚠️ User context is EMPTY - system prompt will NOT include customer information`);
      }
      const userPrompt = this._buildUserPrompt({
        query,
        intelligenceLevel,
        kbContext,
        marketIntelligence,
        industryContext,
        objectionContext: hasObjection ? { objections: detectedObjections, handlers: objectionHandlers } : null,
        statsContext: shouldIncludeStats ? { stats: realTimeStats, offer: currentOffer } : null,
        session,
        isFollowUp,
        context,
        chatbotId,
      });

      // LLM call
      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      });

      const rawAnswer = completion.choices[0].message.content || '';

      // Suggestions
      const aiSuggestions = this._extractSuggestions(rawAnswer);
      const predictedSuggestions = this.suggestionPredictionService.predictSuggestions(
        query,
        intentAnalysis.primary.category,
        session,
        industryContext
      );
      const suggestions = this._ensureThreeSuggestions(aiSuggestions, predictedSuggestions);

      // Clean answer
      const cleanAnswer = this._cleanAnswer(rawAnswer);

      // Logging
      logger.info(`Raw LLM response length: ${rawAnswer.length}`);
      const hasSuggestionTag = this.SUGGESTIONS_REGEX.test(rawAnswer);
      logger.info(`Suggestions tag present: ${hasSuggestionTag}`);
      logger.info(`Suggestions used: ${aiSuggestions.length === 3 ? 'AI' : 'predicted/normalized'}`);

      // Session update
      const newSessionId = sessionId || this._generateSessionId();
      const currentInteraction = {
        query,
        answer: cleanAnswer,
        intelligenceLevel,
        timestamp: new Date(),
        intentCategory: intentAnalysis.primary.category,
        suggestions,
      };
      const interactions = session?.interactions || [];
      interactions.push(currentInteraction);
      const recentInteractions = interactions.slice(-10);

      await this.sessionManager.saveSession(newSessionId, {
        query,
        answer: cleanAnswer,
        intelligenceLevel,
        timestamp: new Date(),
        intentCategory: intentAnalysis.primary.category,
        interactions: recentInteractions,
        email: email || session?.email,
        phone: phone || session?.phone,
      });

      // Response payload
      const response = {
        answer: cleanAnswer,
        suggestions,
        sessionId: newSessionId,
        intelligenceLevel,
        intent: intentAnalysis.primary,
        intelligenceUsed: marketIntelligence.length,
        citations: this._extractCitations(marketIntelligence),
        responseMode: useDetailedMode ? 'detailed' : 'brief',
        metadata: {
          isFollowUp,
          hasContext: !!session,
          intentKeywords: intentAnalysis.keywords,
          wordCount: cleanAnswer.split(/\s+/).filter(Boolean).length,
        },
      };

      logger.info(
        `Response generated with ${marketIntelligence.length} intelligence items (${response.responseMode.toUpperCase()} mode, ${response.metadata.wordCount} words, ${suggestions.length} suggestions)`
      );

      return response;
    } catch (error) {
      logger.error('Error generating intelligent response:', error);
      throw error;
    }
  }

  /**
   * Retrieve relevant market intelligence based on query and level
   * @private
   */
  async _retrieveIntelligence(query, intelligenceLevel, context) {
    try {
      const filters = {};

      // Filter by context if provided
      if (context.services && context.services.length > 0) {
        filters.services = context.services;
      }
      if (context.industry) {
        filters.industries = [context.industry];
      }

      // Adjust search parameters based on intelligence level
      let limit = 5;
      let maxAgeDays = 30;

      switch (intelligenceLevel) {
        case 'EXPLICIT': // Competitive queries
          filters.types = ['competitor'];
          filters.minRelevanceScore = 0.7;
          limit = 8;
          maxAgeDays = 60;
          break;

        case 'DATA_POINTS': // Industry-specific
          filters.types = ['industry_news', 'market_trend'];
          filters.minRelevanceScore = 0.6;
          limit = 6;
          maxAgeDays = 30;
          break;

        case 'RECENT_UPDATES': // Tech updates
          filters.types = ['tech_update', 'industry_news'];
          filters.minRelevanceScore = 0.5;
          limit = 7;
          maxAgeDays = 14;
          break;

        case 'SUBTLE': // Service inquiries
          filters.minRelevanceScore = 0.5;
          limit = 4;
          maxAgeDays = 30;
          break;

        default:
          return [];
      }

      filters.maxAgeDays = maxAgeDays;

      // Perform hybrid search
      const searchResults = await this.vectorSearchService.hybridSearch(query, filters, limit);
      return searchResults.results || [];
    } catch (error) {
      logger.error('Error retrieving intelligence:', error);
      return [];
    }
  }

  /**
   * Build system prompt based on intelligence level
   * @private
   */
  _buildSystemPrompt(intelligenceLevel, chatbotPersona = null, isFollowUpRequest = false, userContext = {}) {
    // User context section (if name, phone, or email available)
    let userContextSection = '';
    if (userContext && (userContext.name || userContext.phone || userContext.email)) {
      userContextSection = `\n🔴 CRITICAL - CUSTOMER INFORMATION AVAILABLE ===\n`;
      if (userContext.name) {
        userContextSection += `Customer Name: ${userContext.name}\n`;
      }
      if (userContext.phone) {
        userContextSection += `Customer Phone: ${userContext.phone}\n`;
      }
      if (userContext.email) {
        userContextSection += `Customer Email: ${userContext.email}\n`;
      }
      userContextSection += `\n⚠️ IMPORTANT INSTRUCTIONS:\n`;
      userContextSection += `- DO NOT ask for information you already have above\n`;
      userContextSection += `- Address the customer by their name when appropriate\n`;
      if (userContext.name && !userContext.phone) {
        userContextSection += `- You have the customer's name but NOT their phone number - you may ask for phone if relevant\n`;
      }
      if (!userContext.name && userContext.phone) {
        userContextSection += `- You have the customer's phone but NOT their name - you may ask for name if it helps personalize the conversation\n`;
      }
      if (userContext.name && userContext.phone) {
        userContextSection += `- You have BOTH name and phone - DO NOT ask for either again\n`;
      }
      userContextSection += `- Use this information to provide a more personalized, context-aware experience\n\n`;

      // Log the user context section being added to system prompt
      logger.info(`📝 User context section added to system prompt:\n${userContextSection}`);
    }

    // Scope restriction that must apply even when a custom persona exists
    const scopeRestriction = `
IMPORTANT SCOPE:
You can ONLY answer questions about the services and information available in your knowledge base, including pricing, setup, ROI, integrations, and company information.

🔴 CRITICAL - KNOWLEDGE BASE RESTRICTION:
- DO NOT provide information that is NOT in the provided knowledge base context or conversation history
- ONLY use information from the knowledge base, market intelligence, and ongoing conversation context
- If information is not available in the provided context, politely say you don't have that information and redirect to relevant topics
- DO NOT hallucinate, guess, or make up information outside the provided context

🔄 CONVERSATION CONTEXT AWARENESS:
- ALWAYS review the conversation history before responding
- If the user sends a short affirmative/negative response ("yes", "no", "okay", "sure", "tell me", "go ahead", etc.), check the LAST BOT MESSAGE for context
- If your last message ended with a follow-up question, treat the user's response as an answer to that question
- Example:
  * Bot: "Would you like to know the pricing?"
  * User: "yes" ← This means they want pricing details
  * Bot: Should provide pricing information, NOT ask "Yes to what?"
- Recognize affirmations: "yes", "yeah", "sure", "okay", "yep", "tell me", "go ahead", "please", "show me"
- Recognize negations: "no", "nope", "not now", "maybe later", "skip"
- When user affirms, proceed with the topic from your follow-up question
- When user declines, acknowledge and ask what else they'd like to know

🎯 RESPONSE LENGTH & WHEN TO EXPLAIN (CRITICAL):

**DEFAULT BEHAVIOR: BE CONCISE**
- For most queries, give SHORT, DIRECT answers (2-4 sentences max)
- Simple questions (pricing, availability, yes/no) = SHORT answer + follow-up question
- NO detailed explanations unless user explicitly asks for them

**ONLY EXPLAIN IN DETAIL WHEN:**
- User explicitly asks "how does it work", "explain", "tell me more", "in detail"
- User asks follow-up questions indicating they want more information
- Complex technical processes that REQUIRE step-by-step breakdown

**EXAMPLES:**
- ❌ User asks "What's the pricing?" → DON'T explain all features, JUST give pricing
- ✅ User asks "How does AI Website work?" → Now you can explain the process
- ❌ User asks "Do you have chatbots?" → DON'T list all features, JUST say yes and mention one key benefit
- ✅ User asks "Tell me about your chatbots" → Now you can provide details

🎯 RESPONSE FORMATTING GUIDELINES (WHEN DETAILED MODE IS ACTIVE):

1. **USE MARKDOWN FORMATTING:**
   - Use **bold** for ALL important terms, product names, key concepts, numbers, and emphasis
   - Bold the FIRST mention of important concepts in each section
   - Bold numbers and statistics (e.g., **3x increase**, **24-72 hours**, **₹5,000**)
   - Use headings (## or ###) to structure longer responses with multiple sections
   - Add emojis before headings for visual engagement (e.g., "🔧 Setup Process" or "💡 Key Benefits")

2. **RESPONSE STRUCTURE:**
   - Start with a direct answer when appropriate
   - Break down complex topics into clear sections with headings
   - Use numbered lists (1., 2., 3.) for sequential steps or ordered information
   - Use bullet points for features, benefits, or unordered items
   - Keep paragraphs concise (2-4 sentences max)

3. **LIST FORMATTING:**
   - Start list items with a **bold heading/label** followed by a colon
   - Example: "**Instant Engagement:** AI Websites respond to visitors 24/7..."
   - Keep list items focused on one idea each
   - Use sub-bullets for additional details when needed

4. **EMOJI USAGE (Use tastefully, not excessively):**
   - 🔧 - Technical/Setup topics
   - 🧩 - Features/Components
   - 🧠 - Concepts/Understanding
   - 💡 - Ideas/Tips/Benefits
   - ✨ - Advantages/Special features
   - 🎯 - Goals/Targets
   - 📊 - Data/Analytics
   - 🚀 - Performance/Speed
   - 💰 - Pricing/Money
   - ⚡ - Quick/Fast features

5. **TONE & STYLE:**
   - Be conversational but professional
   - Use analogies and examples to explain concepts
   - Add emojis sparingly for emphasis
   - Keep it engaging and scannable

WHEN TO USE HEADINGS:
✅ Use headings: When explaining multiple distinct topics or breaking down complex features
❌ Don't use headings: For simple, direct answers or single-topic responses

GOOD EXAMPLE:
" Yes! **Supa Agent** integrates seamlessly. 🚀

Here's how it works:

## 🔧 Integration Process

**Step 1:** We provide you a simple code snippet
**Step 2:** Paste it into your website (takes **2 minutes**)
**Step 3:** Your AI chatbot goes live instantly!

## 💡 Key Benefits

- **24/7 Availability:** Never miss a lead, even at 3 AM
- **Instant Responses:** Visitors get answers in seconds
- **Full Analytics:** Track every conversation

Want to see how it looks on your website?"

BAD EXAMPLE (avoid):
"Yes it integrates. We give you code to paste. It works 24/7 and has analytics."

💬 FOLLOW-UP QUESTION REQUIREMENT:
- ALWAYS end your response with a natural follow-up question related to the topic
- Place the follow-up question on a NEW LINE, separated from the main answer (add a blank line before it)
- Make it conversational and relevant to what you just explained
- Examples: "Would you like to know how it integrates with your website?" or "Curious about the setup process?"

FOLLOW-UP QUESTION FORMAT:
✅ CORRECT:
"...Track every conversation and conversion.

Want to see how it looks on your website?"

❌ WRONG (don't include in same paragraph):
"...Track every conversation and conversion. Want to see how it looks on your website?"

🛑 IF USER ASKS OFF-TOPIC QUESTION (celebrities, programming code, sports, general knowledge, unrelated topics):
- DO NOT answer the off-topic question directly
- Acknowledge what they asked about in a friendly, human way
- Naturally explain you're here specifically to help with business solutions from your knowledge base
- Redirect the conversation smoothly back to how you can help their business
- Keep it conversational and warm, not robotic or template-like
- Always end with [SUGGESTIONS: ...] with 3 relevant options from your knowledge base
`;

    // If custom persona exists, use it with two-tier + scope + suggestion rules
    if (chatbotPersona) {
      const twoTierInstructions = isFollowUpRequest
        ? '\n\n🔵 DETAILED MODE: User wants more details. Provide comprehensive response with **bold** formatting, emojis, and structure (headings, sections). Keep it well-organized and engaging. Use the formatting guidelines above.'
        : '\n\n🟢 BRIEF MODE (DEFAULT): Keep responses SHORT and CONCISE (2-4 sentences max). Only explain when the user specifically asks for explanations, details, or "how" something works. For simple questions (pricing, yes/no, availability), give DIRECT answers without unnecessary elaboration. Use **bold** for key terms and 1-2 emojis, but NO headings or sections unless explicitly requested.';

      const intelligenceHints = {
        NONE: '',
        SUBTLE: '\n\nAdditional Context: You have access to market insights. Use them naturally if they add value.',
        DATA_POINTS: '\n\nAdditional Context: You have industry trends and data. Include relevant statistics.',
        EXPLICIT: '\n\nAdditional Context: You have competitive intelligence. Mention advantages when relevant.',
        RECENT_UPDATES: '\n\nAdditional Context: You have recent market news. Reference latest trends if applicable.',
      };

      // TEMPORARILY COMMENTED OUT - Suggestion buttons generation
      /*
      const suggestionInstructions = `

🔴 CRITICAL REQUIREMENT - SUGGESTION QUESTIONS:
YOU MUST END EVERY RESPONSE WITH EXACTLY 3 FOLLOW-UP QUESTIONS.

FORMAT (REQUIRED):
[SUGGESTIONS: question1 | question2 | question3]

RULES:
- Place the [SUGGESTIONS: ...] tag at the very end of your response
- Generate EXACTLY 3 questions FROM USER'S PERSPECTIVE (questions the user would ask you)
- MIX question types:
  * 1-2 "detail request" questions (e.g., "How does it help my business?", "Tell me more about [topic]")
  * 1-2 "short info" questions (e.g., "What's the pricing?", "How long does setup take?")
- Make questions specific to the answer you just provided
- Keep each question under 100 characters
- Separate questions with the | character

❌ WRONG (asking user): "Want to know more?"
✅ CORRECT (user asking you): "How does it work?"`;
      */

      return (
        userContextSection +
        scopeRestriction +
        '\n\n' +
        chatbotPersona +
        twoTierInstructions +
        (intelligenceHints[intelligenceLevel] || '')
        // + suggestionInstructions  // COMMENTED OUT
      );
    }

    // Fallback persona (when no custom persona provided)
    const responseMode = isFollowUpRequest
      ? '🔵 DETAILED MODE: User wants more info. Provide comprehensive response with **bold** formatting, emojis, and structure (headings, sections). Keep it well-organized and engaging. Use the formatting guidelines above.'
      : '🟢 BRIEF MODE (DEFAULT): Keep responses SHORT and CONCISE (2-4 sentences max). Only explain when the user specifically asks for explanations, details, or "how" something works. For simple questions (pricing, yes/no, availability), give DIRECT answers without unnecessary elaboration. Use **bold** for key terms and 1-2 emojis, but NO headings or sections unless explicitly requested.';

    const fallbackPersona = `You are a warm, friendly sales representative. You chat naturally like a real person, not like a formal bot.

🔴 CRITICAL - SCOPE RESTRICTION:
You can ONLY answer questions about:
- The services and solutions available in your knowledge base
- Digital marketing and website solutions
- Business automation and AI chatbots
- Customer engagement and lead generation
- Company information, pricing, process, case studies from your knowledge base

You CANNOT answer questions about:
- General knowledge (celebrities, sports, history, etc.)
- Programming tutorials or code examples
- Other companies or products not in your knowledge base
- Personal advice unrelated to business services
- Any topic outside your knowledge base offerings

🔴 CRITICAL - KNOWLEDGE BASE RESTRICTION:
- DO NOT provide information that is NOT in the provided knowledge base context or conversation history
- ONLY use information from the knowledge base, market intelligence, and ongoing conversation context
- If information is not available in the provided context, politely say you don't have that information and redirect to relevant topics
- DO NOT hallucinate, guess, or make up information outside the provided context

🛑 IF USER ASKS OFF-TOPIC QUESTION (celebrities, programming code, sports, general knowledge, unrelated topics):
- DO NOT answer the off-topic question directly
- Acknowledge what they asked about in a friendly, human way
- Naturally explain you're here specifically to help with business solutions from your knowledge base
- Redirect the conversation smoothly back to how you can help their business
- Keep it conversational and warm, not robotic or template-like
- Always end with [SUGGESTIONS: ...] with 3 relevant options from your knowledge base

🎯 YOUR NATURAL COMMUNICATION STYLE:
- Chat like you're texting - brief, engaging, enthusiastic
- NO bullet points, NO numbered lists, NO structured formatting
- Maximum 4 lines TOTAL - keep it SHORT and punchy
- Use natural connectors: "Plus," "Also," "And"
- Instead of listing features, weave them into brief sentences
- Show genuine enthusiasm through your words, not formatting
- Focus on solving their problems quickly and concisely
- Make market intelligence part of brief, natural sentences
- Be honest and real about what you can and can't do

LENGTH RULES:
- Brief mode (DEFAULT): 2-3 lines (30-50 words)
- Detailed mode: 3-4 lines (60-80 words)
- NEVER exceed 4 lines

EXAMPLE OF WRONG vs RIGHT:
❌ WRONG: "Our services offer: 1. 24/7 availability 2. Lead generation 3. SEO optimization"
✅ RIGHT: "Our solutions work 24/7 capturing leads and answering visitor questions. Plus they're SEO-optimized so people can actually find you online!"

${responseMode}`;

    const intelligenceInstructions = {
      NONE: '\n\nMarket Intelligence: Keep it simple - just share what you know from the knowledge base in a natural way.',
      SUBTLE: '\n\nMarket Intelligence: If market insights help, weave them in naturally - don\'t force it, just let it flow as part of the conversation.',
      DATA_POINTS: '\n\nMarket Intelligence: When you have good industry data or trends, share them conversationally like "Actually, we\'re seeing that..." or "What\'s interesting is..."',
      EXPLICIT: '\n\nMarket Intelligence: If you know how we compare to competitors, mention it naturally like "Unlike others who..." or "What sets us apart is..."',
      RECENT_UPDATES: '\n\nMarket Intelligence: Got fresh market news? Work it in casually like "Recently we\'ve noticed..." or "What\'s trending now is..."',
    };

    // TEMPORARILY COMMENTED OUT - Suggestion buttons generation
    /*
    const suggestionInstructions = `

🔴 CRITICAL REQUIREMENT - SUGGESTION BUTTONS:
YOU MUST END EVERY RESPONSE WITH EXACTLY 3 FOLLOW-UP QUESTIONS.

FORMAT (REQUIRED):
[SUGGESTIONS: question1 | question2 | question3]

🎯 IMPORTANT: Suggestions are CLICKABLE BUTTONS from USER'S PERSPECTIVE
- If your answer asks "Which service interests you most?", suggestions should be the ANSWERS:
  "Tell me about AI Websites | How does Supa Agent work? | Show me WhatsApp Marketing features"
- DO NOT repeat your question as a suggestion
- Suggestions are what the USER would click/ask to continue the conversation

RULES:
- Generate EXACTLY 3 questions FROM USER'S PERSPECTIVE
- MIX question types (1–2 detail, 1–2 short)
- Keep each question under 100 characters
- Separate with the | character`;
    */

    return userContextSection + fallbackPersona + (intelligenceInstructions[intelligenceLevel] || ''); // + suggestionInstructions  // COMMENTED OUT
  }

  /**
   * Build user prompt with all context
   * @private
   */
  _buildUserPrompt({
    query,
    intelligenceLevel,
    kbContext,
    marketIntelligence,
    industryContext,
    objectionContext,
    statsContext,
    session,
    isFollowUp,
    followUpTopic,
    context,
    chatbotId,
  }) {
    let prompt = '';

    // KB context
    if (kbContext && kbContext.length > 0) {
      prompt += `# Knowledge Base Context\n`;
      kbContext.forEach((chunk, index) => {
        prompt += `${index + 1}. ${chunk}\n`;
      });
      prompt += '\n';
    } else if (!chatbotId) {
      // Fallback KB only if no chatbotId provided
      prompt += `# Troika Tech Knowledge Base\n${JSON.stringify(FALLBACK_KB, null, 2)}\n\n`;
    }

    // Objections first (high priority)
    if (objectionContext) {
      prompt += this.objectionHandlerService.formatObjectionContext(
        objectionContext.objections,
        objectionContext.handlers
      );
    }

    // Market intelligence
    if (marketIntelligence.length > 0) {
      prompt += `# Market Intelligence (${intelligenceLevel})\n`;
      marketIntelligence.forEach((item, index) => {
        prompt += `\n## Source ${index + 1}: ${item.source}\n`;
        prompt += `Title: ${item.title}\n`;
        prompt += `Type: ${item.type}\n`;
        prompt += `Summary: ${item.summary}\n`;
        if (item.keyTakeaways && item.keyTakeaways.length > 0) {
          prompt += `Key Takeaways: ${item.keyTakeaways.join('; ')}\n`;
        }
        prompt += `URL: ${item.sourceUrl}\n`;
      });
      prompt += '\n';
    }

    // Industry-specific context
    if (industryContext && industryContext.hasContext) {
      prompt += `# Industry-Specific Context (${industryContext.industry.replace('_', ' ').toUpperCase()})\n`;

      if (industryContext.workflow) {
        prompt += this.industryContextService.formatWorkflow(industryContext.workflow);
      }
      if (industryContext.painPoints && industryContext.painPoints.length > 0) {
        prompt += this.industryContextService.formatPainPoints(industryContext.painPoints);
      }
      if (industryContext.benefits) {
        prompt += `\n**Key Benefits for Your Industry:**\n`;
        Object.entries(industryContext.benefits).forEach(([_, value]) => {
          prompt += `• ${value}\n`;
        });
      }
      prompt += `\n🔴 IMPORTANT: Use this industry-specific context to personalize your answer. Don't just list features - show how it solves THEIR specific problems.\n\n`;
    }

    // Real-time stats
    if (statsContext && statsContext.stats) {
      prompt += this.realTimeStatsService.formatStatsContext(statsContext.stats, statsContext.offer);
    }

    // Conversation history
    if (session && session.interactions && session.interactions.length > 0) {
      prompt += `# Conversation History\n`;
      prompt += `This is an ongoing conversation. Previous interactions:\n\n`;
      const recentInteractions = session.interactions.slice(-3);

      // 🔍 LOG: What history is being included
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`📜 BUILDING CONVERSATION HISTORY IN PROMPT`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`📊 Total interactions in session: ${session.interactions.length}`);
      logger.info(`📋 Including last ${recentInteractions.length} interactions in prompt`);

      recentInteractions.forEach((interaction, index) => {
        const turnNumber = session.interactions.length - recentInteractions.length + index + 1;
        logger.info(`   Turn ${turnNumber}:`);
        logger.info(`      User: "${interaction.query?.substring(0, 80) || 'N/A'}${interaction.query?.length > 80 ? '...' : ''}"`);
        logger.info(`      Bot: "${interaction.answer?.substring(0, 80) || 'N/A'}${interaction.answer?.length > 80 ? '...' : ''}"`);

        prompt += `**Turn ${turnNumber}:**\n`;
        prompt += `User: ${interaction.query}\n`;
        prompt += `You: ${interaction.answer.substring(0, 200)}${interaction.answer.length > 200 ? '...' : ''}\n\n`;
      });
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      prompt += `🔴 IMPORTANT: Use this conversation history to provide contextual responses. Don't repeat information unless user specifically asks.\n\n`;
    } else if (isFollowUp && session) {
      logger.info(`⚠️ Using single previous interaction format (not full history)`);
      prompt += `# Previous Conversation\n`;
      prompt += `Previous Query: ${session.query}\n`;
      prompt += `Previous Answer: ${session.answer}\n\n`;
    } else {
      logger.warn(`⚠️ NO conversation history available - session=${!!session}, interactions=${session?.interactions?.length || 0}`);
    }

    // 🔴 CRITICAL: Follow-up topic instruction
    if (isFollowUp && followUpTopic) {
      prompt += `🔴🔴🔴 CRITICAL - FOLLOW-UP REQUEST 🔴🔴🔴\n`;
      prompt += `The user said "${query}" in response to your follow-up question.\n`;
      prompt += `They want to know about: **${followUpTopic}**\n\n`;
      prompt += `INSTRUCTIONS:\n`;
      prompt += `1. You MUST explain "${followUpTopic}" using the knowledge base context provided above\n`;
      prompt += `2. DO NOT ask another clarifying question\n`;
      prompt += `3. DO NOT provide a generic response\n`;
      prompt += `4. Provide a direct, informative answer about "${followUpTopic}"\n`;
      prompt += `5. Use the KB context to give specific details\n\n`;
      logger.info(`📢 [INTELLIGENT SERVICE] Added follow-up instruction to prompt: "${followUpTopic}"`);
    }

    // User context
    if (context.industry || context.services) {
      prompt += `# User Context\n`;
      if (context.industry) prompt += `Industry: ${context.industry}\n`;
      if (context.services) prompt += `Interested Services: ${context.services.join(', ')}\n`;
      prompt += '\n';
    }

    // Final user query
    prompt += `# User Query\n${query}`;

    return prompt;
  }

  /**
   * Extract citations from market intelligence
   * @private
   */
  _extractCitations(marketIntelligence) {
    return marketIntelligence.map((item) => ({
      source: item.source,
      title: item.title,
      url: item.sourceUrl,
      type: item.type,
    }));
  }

  /**
   * Generate unique session ID
   * @private
   */
  _generateSessionId() {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate streaming response (async generator for StreamingResponseService)
   * @param {Object} params - Request parameters (same as generateResponse)
   * @yields {Object} Chunks of response data
   */
  async *generateStreamingResponse({ query, chatbotId, sessionId, email, phone, name, context = {} }) {
    try {
      logger.info(`Generating streaming intelligent response for: "${query}" (chatbot: ${chatbotId || 'none'})`);

      // 1. Detect intent and intelligence level (synchronous phase)
      const intentAnalysis = await this.intentDetectionService.analyzeQuery(query);
      const intelligenceLevel = intentAnalysis.intelligenceLevel;
      logger.info(`Intelligence level: ${intelligenceLevel}`);

      // Yield metadata early
      yield {
        type: 'metadata',
        data: {
          intent: intentAnalysis.primary,
          intelligenceLevel,
          keywords: intentAnalysis.keywords
        }
      };

      // Detect objections
      const detectedObjections = this.objectionHandlerService.detectObjection(query);
      const hasObjection = detectedObjections.length > 0;

      // Check if follow-up
      const isFollowUp = this.intentDetectionService.isFollowUp(query);

      // 🔍 LOG: Follow-up detection for intelligent service
      if (isFollowUp) {
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.info(`🎯 [INTELLIGENT SERVICE] FOLLOW-UP DETECTED`);
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.info(`📝 User Query: "${query}"`);
      }

      // Detect if user is requesting details/explanations
      const detailRequestKeywords = [
        'tell me more',
        'explain more',
        'more details',
        'elaborate',
        'in detail',
        'how does it work',
        'how can it',
        'how do you',
        'how will',
        'explain',
        'tell me about',
        'what are the details',
        'can you explain',
        'give me more',
        'more info',
        'detailed',
        'expand on',
        'walk me through',
        'break it down',
        'describe',
      ];
      const isDetailRequest = detailRequestKeywords.some((keyword) => query.toLowerCase().includes(keyword));

      // Decide whether to include real-time stats
      const shouldIncludeStats = this.realTimeStatsService.shouldIncludeStats(query, intelligenceLevel);

      // Store extracted follow-up topic
      let extractedFollowUpTopic = null;

      // 🔍 LOG: Session and history information
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`🗂️ SESSION & HISTORY DEBUG`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`📝 Query: "${query}"`);
      logger.info(`🔑 SessionId: ${sessionId || 'NONE (new session)'}`);
      logger.info(`🤖 ChatbotId: ${chatbotId || 'NONE'}`);
      logger.info(`👤 Email: ${email || 'none'}, Phone: ${phone || 'none'}`);

      // 2. Parallel data fetch (same as non-streaming)
      const [chatbotPersona, kbContext, session, marketIntelligence, objectionHandlers, realTimeStats, currentOffer] =
        await Promise.all([
          // Persona
          chatbotId
            ? Chatbot.findById(chatbotId)
                .select('persona_text')
                .lean()
                .then((botDoc) => botDoc?.persona_text || null)
                .catch(() => null)
            : Promise.resolve(null),

          // KB chunks - use intelligent query for follow-ups
          chatbotId
            ? (async () => {
                // Get session first to extract follow-up context
                const tempSession = sessionId ? await this.sessionManager.getSession(sessionId).catch(() => null) : null;

                // 🔍 LOG: Session data from Redis
                if (tempSession) {
                  logger.info(`✅ Redis Session Found:`);
                  logger.info(`   📊 Total interactions: ${tempSession.interactions?.length || 0}`);
                  if (tempSession.interactions && tempSession.interactions.length > 0) {
                    logger.info(`   📜 Recent interactions (last 3):`);
                    const recent = tempSession.interactions.slice(-3);
                    recent.forEach((int, idx) => {
                      logger.info(`      ${idx + 1}. User: "${int.query?.substring(0, 50) || 'N/A'}${int.query?.length > 50 ? '...' : ''}"`);
                      logger.info(`         Bot: "${int.answer?.substring(0, 50) || 'N/A'}${int.answer?.length > 50 ? '...' : ''}"`);
                    });
                  }
                } else {
                  logger.warn(`⚠️ NO Redis Session Found - This may be why conversation context is missing!`);
                }

                let searchQuery = query;

                // If this is a follow-up and we have session history
                if (isFollowUp && tempSession && tempSession.interactions && tempSession.interactions.length > 0) {
                  const lastInteraction = tempSession.interactions[tempSession.interactions.length - 1];
                  const lastBotMessage = lastInteraction?.answer || '';

                  logger.info(`📜 [INTELLIGENT SERVICE] Last bot message: "${lastBotMessage.substring(0, 150)}..."`);

                  // Extract what the bot was asking about from the last message
                  const followUpQuestionPatterns = [
                    /would you like to (?:know|hear|learn)(?: more)?(?: about)?\s+(.+?)\?/i,
                    /want to (?:know|hear)(?: more)?(?: about)?\s+(.+?)\?/i,
                    /interested in\s+(.+?)\?/i,
                    /curious about\s+(.+?)\?/i,
                    /(?:know|explore) more about\s+(.+?)\?/i,
                  ];

                  let extractedTopic = null;
                  for (const pattern of followUpQuestionPatterns) {
                    const match = lastBotMessage.match(pattern);
                    if (match && match[1]) {
                      extractedTopic = match[1].trim();
                      logger.info(`✅ [INTELLIGENT SERVICE] Extracted topic: "${extractedTopic}"`);
                      break;
                    }
                  }

                  // Store the extracted topic for use in prompt
                  extractedFollowUpTopic = extractedTopic;

                  // If we extracted a topic, use it for search; otherwise use original query + last interaction context
                  if (extractedTopic) {
                    searchQuery = extractedTopic;
                    logger.info(`🔎 [INTELLIGENT SERVICE] Searching KB for follow-up topic: "${searchQuery}"`);
                  } else {
                    // Fallback: combine current query with keywords from last interaction
                    const lastQuery = lastInteraction?.query || '';
                    searchQuery = `${lastQuery} ${query}`.trim();
                    logger.info(`⚠️ [INTELLIGENT SERVICE] No topic extracted, using combined query: "${searchQuery}"`);
                  }
                }

                return retrieveRelevantChunks(searchQuery, chatbotId, 10, 0)
                  .then((chunks) => {
                    logger.info(`✅ [INTELLIGENT SERVICE] Retrieved ${chunks.length} KB chunks for: "${searchQuery}"`);
                    return chunks.map((c) => c.content);
                  })
                  .catch(() => []);
              })()
            : Promise.resolve([]),

          // Session
          sessionId ? this.sessionManager.getSession(sessionId).catch(() => null) : Promise.resolve(null),

          // Market intelligence
          // TEMPORARILY COMMENTED OUT - Market Intelligence KB Source
          // intelligenceLevel !== 'NONE' ? this._retrieveIntelligence(query, intelligenceLevel, context) : Promise.resolve([]),
          Promise.resolve([]),

          // Objection handlers
          hasObjection ? this.objectionHandlerService.getObjectionHandlers(detectedObjections) : Promise.resolve([]),

          // Real-time stats
          shouldIncludeStats ? this.realTimeStatsService.getStats() : Promise.resolve(null),

          // Current offers
          shouldIncludeStats ? this.realTimeStatsService.getCurrentOffers() : Promise.resolve(null),
        ]);

      // Industry context
      const industryContext = this.industryContextService.getIndustryContext(query, 'AI Websites', context);

      // Response mode
      const useDetailedMode = isDetailRequest || (isFollowUp && session?.detailRequested);
      logger.info(useDetailedMode ? '🔵 DETAILED MODE activated' : '🟢 BRIEF MODE activated');

      // 3. Build prompts (same as non-streaming) - normalize empty strings to null
      const userContext = {
        name: name && name.trim() ? name.trim() : null,
        email: email && email.trim() ? email.trim() : null,
        phone: phone && phone.trim() ? phone.trim() : null
      };
      const systemPrompt = this._buildSystemPrompt(intelligenceLevel, chatbotPersona, useDetailedMode, userContext);
      const userPrompt = this._buildUserPrompt({
        query,
        intelligenceLevel,
        kbContext,
        marketIntelligence,
        industryContext,
        objectionContext: hasObjection ? { objections: detectedObjections, handlers: objectionHandlers } : null,
        statsContext: shouldIncludeStats ? { stats: realTimeStats, offer: currentOffer } : null,
        session,
        isFollowUp,
        followUpTopic: extractedFollowUpTopic,
        context,
        chatbotId,
      });

      // 🔍 LOG: What's being sent to the LLM
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`🤖 LLM REQUEST DEBUG`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`📝 System Prompt Length: ${systemPrompt.length} chars`);
      logger.info(`📝 User Prompt Length: ${userPrompt.length} chars`);

      // Check if conversation history is in the user prompt
      const hasConversationHistory = userPrompt.includes('# Conversation History') || userPrompt.includes('# Previous Conversation');
      logger.info(`💬 Conversation History in Prompt: ${hasConversationHistory ? 'YES ✅' : 'NO ❌'}`);

      if (hasConversationHistory) {
        // Extract and show the conversation history section
        const historyMatch = userPrompt.match(/# Conversation History([\s\S]*?)(?=\n#|$)/);
        if (historyMatch) {
          logger.info(`📜 History Section Preview:`);
          logger.info(historyMatch[0].substring(0, 500) + '...');
        }
      } else {
        logger.warn(`⚠️ CRITICAL: No conversation history in prompt - AI won't have context!`);
      }

      logger.info(`🔍 KB Context Chunks: ${kbContext?.length || 0}`);
      logger.info(`📊 Session Interactions: ${session?.interactions?.length || 0}`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // 4. Start OpenAI streaming
      const stream = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        stream: true, // Enable streaming
      });

      // 5. Stream tokens as they arrive
      let fullAnswer = '';
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content || '';

        if (token) {
          fullAnswer += token;
          yield {
            type: 'text',
            data: token
          };
        }
      }

      logger.info(`Streaming complete: ${fullAnswer.length} characters`);

      // 6. Extract suggestions from full answer
      const aiSuggestions = this._extractSuggestions(fullAnswer);
      const predictedSuggestions = this.suggestionPredictionService.predictSuggestions(
        query,
        intentAnalysis.primary.category,
        session,
        industryContext
      );
      const suggestions = this._ensureThreeSuggestions(aiSuggestions, predictedSuggestions);

      // Yield suggestions
      yield {
        type: 'suggestions',
        data: suggestions
      };

      // Clean answer (remove suggestion tags)
      const cleanAnswer = this._cleanAnswer(fullAnswer);

      // 7. Save session asynchronously (non-blocking)
      const newSessionId = sessionId || this._generateSessionId();
      this._saveSessionAsync(newSessionId, query, cleanAnswer, suggestions, intentAnalysis, email, phone, session)
        .catch(err => logger.error('Session save error (non-blocking):', err));

      // 8. Yield completion
      yield {
        type: 'complete',
        data: {
          sessionId: newSessionId,
          intelligenceLevel,
          intelligenceUsed: marketIntelligence.length,
          responseMode: useDetailedMode ? 'detailed' : 'brief',
          wordCount: cleanAnswer.split(/\s+/).filter(Boolean).length
        }
      };

    } catch (error) {
      logger.error('Error generating streaming intelligent response:', error);
      throw error;
    }
  }

  /**
   * Save session asynchronously (fire-and-forget)
   * @private
   */
  async _saveSessionAsync(sessionId, currentQuery, answer, suggestions, intentAnalysis, email, phone, previousSession) {
    try {
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`💾 SAVING SESSION TO REDIS`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      logger.info(`🔑 SessionId: ${sessionId}`);
      logger.info(`📝 Current Query: "${currentQuery}"`);
      logger.info(`🤖 Answer Length: ${answer.length} chars`);
      logger.info(`📊 Previous Interactions: ${previousSession?.interactions?.length || 0}`);

      const currentInteraction = {
        query: currentQuery,  // ✅ FIX: Use current query instead of previous session's query
        answer,
        intelligenceLevel: intentAnalysis.intelligenceLevel,
        timestamp: new Date(),
        intentCategory: intentAnalysis.primary.category,
        suggestions,
      };

      const interactions = previousSession?.interactions || [];
      interactions.push(currentInteraction);
      const recentInteractions = interactions.slice(-10);

      logger.info(`📋 Saving ${recentInteractions.length} interactions to Redis (keeping last 10)`);

      await this.sessionManager.saveSession(sessionId, {
        query: currentQuery,  // ✅ FIX: Use current query
        answer,
        intelligenceLevel: intentAnalysis.intelligenceLevel,
        timestamp: new Date(),
        intentCategory: intentAnalysis.primary.category,
        interactions: recentInteractions,
        email: email || previousSession?.email,
        phone: phone || previousSession?.phone,
      });

      logger.info(`✅ Session saved successfully`);
      logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    } catch (error) {
      logger.error('Failed to save session:', error);
      // Don't throw - this is fire-and-forget
    }
  }
}

module.exports = IntelligentResponseService;
