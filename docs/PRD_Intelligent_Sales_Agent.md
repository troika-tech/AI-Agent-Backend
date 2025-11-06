# Product Requirements Document (PRD)
## Intelligent Sales Agent for Troika Tech

**Version:** 1.4
**Date:** October 9, 2025
**Owner:** Troika Tech Development Team
**Status:** Planning Phase
**Update Notes:**
- v1.1: Introduced hybrid scraping schedule (every 3 days for news + weekly for competitors/trends)
- v1.2: Changed from dual-response to single blended conversational response
- v1.3: Added tiered intelligence levels (NONE, SUBTLE, DATA_POINTS, EXPLICIT, RECENT_UPDATES) with query-appropriate responses
- v1.4: Added comprehensive conversation context management for handling follow-ups (yes/no, why/how, tell me more) with Redis session storage

---

## 1. Executive Summary

### 1.1 Vision
Transform the Troika Tech chatbot into an intelligent sales agent that behaves like an expert salesperson with comprehensive knowledge of:
- Troika Tech's complete service portfolio
- Real-time industry trends and technology updates
- Competitive landscape and market positioning
- Client-specific industry intelligence

### 1.2 Objective
Create a dedicated chatbot endpoint for Troika Tech that delivers a single, conversational response that naturally blends:
1. **Knowledge Base Information**: Direct insights from Troika Tech's service documentation
2. **Market Intelligence Context**: Real-time industry trends, competitive landscape, and tech updates from regularly-scraped data (news every 3 days, competitors/trends weekly)

### 1.3 Success Metrics
- Response time: < 5 seconds for blended conversational response
- Intelligence freshness: News updated every 3 days, competitors/trends updated weekly
- Response relevance: User feedback on answer quality (naturalness + accuracy)
- Conversion potential: Track queries leading to sales inquiries

---

## 2. Product Scope

### 2.1 In Scope
- Intent-based trigger system for intelligent responses
- Dedicated API route for Troika Tech chatbot
- Hybrid automated web scraping: news every 3 days, competitors/trends weekly
- LLM-powered summarization and synthesis
- Automated data cleanup (30-day retention)
- Single conversational response blending KB + market intelligence
- Consultative, natural response style (not dual messages)
- Multi-source intelligence aggregation

### 2.2 Out of Scope (Phase 1)
- Admin review/approval workflow for scraped content
- Manual curation interface
- Real-time scraping per query
- Multi-tenant support (Troika Tech only initially)
- A/B testing of response formats
- Advanced analytics dashboard

---

## 3. User Stories

### 3.1 Primary User: Potential Client
**As a** potential client visiting Troika Tech's website
**I want to** ask questions about services and get informed, consultative answers
**So that** I can make confident decisions about choosing Troika Tech

### 3.2 Secondary User: Troika Tech Sales Team
**As a** sales team member
**I want** the chatbot to provide intelligent, up-to-date market context
**So that** prospects receive professional, informed responses even when I'm offline

---

## 4. Functional Requirements

### 4.1 Intent Detection System

#### 4.1.1 Intent Keywords & Intelligence Levels (Initial Set)
Store in database table: `IntelligentIntents`

The system uses **tiered intelligence levels** based on query type to provide appropriate context without overwhelming simple queries.

**Simple FAQ Intents (Intelligence Level: NONE)**
- "What's your phone number"
- "How do I contact you"
- "Your address"
- "Email"
- "What are your hours"
- Response: Direct answer from KB only, no market intelligence

**Service Inquiry Intents (Intelligence Level: SUBTLE)**
- "How can you help me"
- "What services do you offer"
- "Tell me about your company"
- "Why should I choose you"
- "What do you do"
- "Your solutions"
- "How does [service name] work"
- Response: Subtle industry context woven naturally (e.g., "Speed matters—we deliver in 4 hours")

**Competitive Intents (Intelligence Level: EXPLICIT)**
- "Compare with [competitor]"
- "Why you over [competitor]"
- "Difference between you and [competitor]"
- "Better than [competitor]"
- "[Competitor] vs you"
- Response: Direct comparisons with pricing, features, explicit competitor mentions

**Industry-Specific Intents (Intelligence Level: DATA_POINTS)**
- "For real estate business"
- "For education sector"
- "For retail/e-commerce"
- "For healthcare"
- "Political campaign"
- Response: Relevant industry statistics and trends (e.g., "78% of property buyers abandon slow inquiries")

**Technology Intents (Intelligence Level: RECENT_UPDATES)**
- "Latest AI trends"
- "What's new in [technology]"
- "Industry updates"
- "Recent developments"
- Response: Recent tech news and updates from scraped sources

#### 4.1.2 Intent Matching Logic
- Keyword-based matching (fuzzy matching for typos)
- Determine intelligence level based on matched intent category
- Fall back to standard KB-only response if no intent match
- Log unmatched queries for future intent expansion

**Intelligence Level Flow:**
```
User Query
    ↓
Intent Detection
    ↓
Matched Intent? → No → KB-only response
    ↓ Yes
Determine Intelligence Level
    ↓
├─ NONE → KB only (no market intelligence)
├─ SUBTLE → KB + subtle industry context
├─ DATA_POINTS → KB + relevant statistics
├─ EXPLICIT → KB + explicit competitor comparisons
└─ RECENT_UPDATES → KB + recent tech news
```

---

### 4.2 Data Scraping System

#### 4.2.1 Scraping Schedule
- **Frequency:** Hybrid schedule
  - **News Sources:** Every 3 days at 4:00 AM IST
  - **Competitors, Tech Trends, Marketing, Own Content:** Weekly (Mondays at 4:00 AM IST)
- **Duration:** Max 2 hours per run
- **Implementation:** Node-cron jobs (two separate schedules)

#### 4.2.2 Data Sources

**A. News Sources (Scraped Every 3 Days)**

1. **Global Tech News:**
   - TechCrunch: https://techcrunch.com (AI, startups, SaaS categories) - ~15 articles
   - VentureBeat: https://venturebeat.com (AI section) - ~10 articles

2. **Indian Tech News:**
   - YourStory: https://yourstory.com (AI, tech, startups) - ~15 articles
   - Inc42: https://inc42.com (AI, enterprise tech) - ~12 articles
   - Medianama: https://www.medianama.com (digital India, tech policy) - ~8 articles

3. **AI-Specific:**
   - OpenAI Blog: https://openai.com/blog - ~3 articles
   - Google AI Blog: https://ai.googleblog.com - ~5 articles
   - Anthropic Blog: https://www.anthropic.com/news - ~3 articles

4. **SEO & Digital Marketing:**
   - Search Engine Journal: https://www.searchenginejournal.com (SEO updates) - ~17 articles

**Total News Articles per Run:** ~88 articles (published in last 3 days)
**Filtering:** AI, chatbot, website builder, WhatsApp marketing, SMB, digital transformation, India

---

**B. Competitor Monitoring (Scraped Weekly)**

1. **Yellow.ai** (AI Chatbot - Indian Market Leader)
   - Homepage: https://yellow.ai
   - Pricing: https://yellow.ai/pricing
   - Features page
   - About page
   - Latest blog post
   - LinkedIn: https://linkedin.com/company/yellowdotai (last 5 posts)
   **Total pages: 10**

2. **Wix** (Website Builder)
   - Homepage: https://www.wix.com/ai-website-builder
   - Pricing: https://www.wix.com/upgrade/website
   - Features page
   - About page
   - Latest blog post
   - LinkedIn: /company/wix-com (last 5 posts)
   **Total pages: 10**

3. **Hostinger** (Website Builder)
   - Homepage: https://www.hostinger.com/ai-website-builder
   - Pricing: https://www.hostinger.com/web-hosting
   - Features page
   - About page
   - Latest blog post
   - LinkedIn: /company/hostinger (last 5 posts)
   **Total pages: 10**

4. **Synthesia** (Video Avatar Platform)
   - Homepage: https://www.synthesia.io
   - Pricing: https://www.synthesia.io/pricing
   - Use cases page
   - About page
   - Latest blog post
   - LinkedIn: /company/synthesia (last 5 posts)
   **Total pages: 10**

5. **HeyGen** (Video Avatar Platform)
   - Homepage: https://www.heygen.com
   - Pricing: https://www.heygen.com/pricing
   - Features page
   - About page
   - Latest blog post
   - LinkedIn: /company/heygen (last 5 posts)
   **Total pages: 10**

6. **Interakt** (WhatsApp Marketing)
   - Homepage: https://www.interakt.shop
   - Pricing: https://www.interakt.shop/pricing
   - Features page
   - About page
   - Latest blog post
   - LinkedIn: /company/interakt (last 5 posts)
   **Total pages: 10**

7. **Gupshup** (WhatsApp Marketing)
   - Homepage: https://www.gupshup.io
   - Pricing: https://www.gupshup.io/pricing
   - Features page
   - About page
   - Latest blog post
   - LinkedIn: /company/gupshup (last 5 posts)
   **Total pages: 10**

8. **Bland.ai** (AI Calling Agent)
   - Homepage: https://www.bland.ai
   - Pricing: https://www.bland.ai/pricing
   - Features page
   - About page
   - Latest blog post
   - LinkedIn: /company/bland-ai (last 5 posts)
   **Total pages: 10**

**Total Competitor Pages per Week:** 80 pages (8 competitors × 10 pages each)

---

**C. Technology Trends (Scraped Weekly)**

1. **GitHub Trending:**
   - AI/ML repositories: https://github.com/trending (top 5) - ~5 items

2. **Product Hunt:**
   - New AI tools: https://www.producthunt.com (top 3 AI launches) - ~3 items

3. **Hacker News:**
   - Top AI discussions: https://news.ycombinator.com (AI topics) - ~1 item

**Total Tech Trends per Week:** ~9 items

---

**D. Marketing Sources (Scraped Weekly)**

1. **Social Media Today:**
   - https://www.socialmediatoday.com (latest articles) - ~5 articles

**Total Marketing Content per Week:** ~5 articles

---

**E. Troika Tech Own Content (Scraped Weekly)**

1. **Troika Tech Website:**
   - Blog: https://troikatech.co.in/blog (if exists) - latest posts

2. **Troika Tech LinkedIn:**
   - Company page: https://linkedin.com/company/troika-tech-services (last 5 posts) - ~5 posts

**Total Own Content per Week:** ~5 items

---

**Summary of Scraping Volumes:**
- **Every 3 Days:** 88 news articles
- **Weekly:** 80 competitor pages + 9 tech trends + 5 marketing articles + 5 own content = 99 items
- **Monthly Total:** (88 × 10 runs) + (99 × 4 weeks) = 880 + 396 = 1,276 pieces/month

#### 4.2.3 Scraping Technology Stack
- **Puppeteer**: For JavaScript-heavy sites (LinkedIn, dynamic content)
- **Axios + Cheerio**: For static HTML sites (faster, lightweight)
- **Retry Logic**: 3 attempts per URL with exponential backoff
- **Timeout**: 30 seconds per page
- **Error Handling**: Log failures, continue with remaining sources

#### 4.2.4 Rate Limiting & Politeness
- 2-second delay between requests to same domain
- Rotate User-Agent headers
- Respect robots.txt
- Use headless mode for Puppeteer

---

### 4.3 Data Storage Schema

#### 4.3.1 MongoDB Collection: `market_intelligence`

```javascript
{
  _id: ObjectId,

  // Classification
  type: String, // "competitor" | "industry_news" | "tech_update" | "market_trend"
  category: [String], // ["AI", "chatbot", "pricing", "feature_launch", etc.]

  // Source Information
  source: String, // "Yellow.ai", "TechCrunch", "LinkedIn", etc.
  sourceUrl: String,
  sourceType: String, // "website" | "news" | "social" | "blog"

  // Content
  title: String,
  rawContent: String, // Full scraped text
  summarizedContent: String, // LLM-generated summary (200-300 words)
  keyTakeaways: [String], // Bullet points extracted by LLM

  // Relevance Mapping
  relevantServices: [String], // ["Supa Agent", "AI Websites", "WhatsApp Marketing", etc.]
  relevantIndustries: [String], // ["Real Estate", "Education", "Retail", etc.]
  competitorMentioned: [String], // ["Yellow.ai", "Wix", etc.]

  // Embeddings for Semantic Search
  embedding: [Number], // OpenAI text-embedding-3-small (1536 dimensions)

  // Metadata
  scrapedAt: Date,
  publishedAt: Date, // Original publish date if available
  expiresAt: Date, // Auto-delete after 30 days

  // Quality Control
  processingStatus: String, // "scraped" | "summarized" | "embedded" | "ready"
  relevanceScore: Number, // 0-1, calculated by LLM

  // Indexing
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ type: 1, scrapedAt: -1 }`
- `{ relevantServices: 1, scrapedAt: -1 }`
- `{ expiresAt: 1 }` (TTL index for auto-cleanup)
- `{ embedding: "vectorSearch" }` (Atlas Vector Search)

#### 4.3.2 MongoDB Collection: `intelligent_intents`

```javascript
{
  _id: ObjectId,
  intentKeyword: String, // "how can you help me"
  intentCategory: String, // "faq" | "service_inquiry" | "competitive" | "industry_specific" | "technology"
  intelligenceLevel: String, // "NONE" | "SUBTLE" | "DATA_POINTS" | "EXPLICIT" | "RECENT_UPDATES"
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

**Intelligence Levels Explained:**
- **NONE**: No market intelligence used (FAQ queries)
- **SUBTLE**: Light industry context woven naturally
- **DATA_POINTS**: Include relevant statistics and trends
- **EXPLICIT**: Full competitor comparisons with pricing/features
- **RECENT_UPDATES**: Recent tech news and developments

---

### 4.4 LLM Processing Pipeline

#### 4.4.1 Summarization (After Scraping)
**For each scraped piece of content:**

**Prompt Template:**
```
You are an expert business analyst summarizing competitive and industry intelligence.

Source: {source}
Type: {type}
Content: {rawContent}

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
}
```

**Model:** GPT-4o-mini (cost-effective for batch processing)

#### 4.4.2 Embedding Generation
- Use OpenAI `text-embedding-3-small` (1536 dimensions)
- Store in `embedding` field for vector search
- Create Atlas Vector Search index

#### 4.4.3 Query-Time Synthesis
**When user asks a question with matched intent:**

**Step 1: Retrieve KB Answer**
- Use existing vector search on knowledge base
- Get top 3 relevant KB chunks

**Step 2: Retrieve Market Intelligence (Based on Intelligence Level)**
- **If Intelligence Level = NONE**: Skip this step entirely
- **If Intelligence Level = SUBTLE, DATA_POINTS, EXPLICIT, or RECENT_UPDATES**:
  - Perform vector search on `market_intelligence` collection
  - Filter by relevance score > 0.6
  - Get top 3-5 most relevant intelligence pieces
  - Prioritize recent data (last 7 days weighted higher)
  - For EXPLICIT level: Specifically retrieve competitor data

**Step 3: Synthesize Single Blended Conversational Response**

**Prompt Template (Intelligence Level: NONE - FAQ)**
```
You are a helpful assistant for Troika Tech Services.

User Question: {userQuery}
Your Knowledge Base: {kbContext}

Task: Provide a direct, concise answer from the knowledge base only.
No market intelligence, no industry context, just the requested information.

Example: "Our phone number is +91 9821211755. You can also reach us at info@troikatech.in"
```

**Prompt Template (Intelligence Level: SUBTLE - Service Inquiry)**
```
You are an expert sales consultant for Troika Tech Services, a leading AI and digital services company in India.

User Question: {userQuery}
Intelligence Level: SUBTLE

Your Knowledge Base: {kbContext}
Market Intelligence: {intelligenceContext}

Task: Create a conversational response that answers the question with SUBTLE industry context.

Guidelines:
- Focus primarily on Troika Tech's services and capabilities
- Weave in light industry context naturally (e.g., "Speed matters—we deliver in 4 hours")
- Keep market intelligence minimal and organic
- NO explicit competitor mentions or pricing comparisons
- NO statistics unless absolutely natural
- Response length: 150-250 words

Example:
"We offer AI Websites starting at ₹25,000 and Supa Agent chatbots at ₹40,000 setup. Speed is crucial in today's market—we deliver in 24-72 hours with multilingual support across 80+ languages. Our solutions are built specifically for Indian businesses..."
```

**Prompt Template (Intelligence Level: DATA_POINTS - Industry-Specific)**
```
You are an expert sales consultant for Troika Tech Services.

User Question: {userQuery}
Intelligence Level: DATA_POINTS

Your Knowledge Base: {kbContext}
Market Intelligence: {intelligenceContext}

Task: Create a consultative response with relevant industry statistics and trends.

Guidelines:
- Answer the question with Troika Tech's relevant services
- Include specific data points and statistics that support the value proposition
- Use industry trends to create urgency or highlight relevance
- Light competitor mentions OK if contextually relevant
- Response length: 250-350 words

Example:
"For real estate, we offer AI Websites and Supa Agent chatbots. What's critical: 78% of property buyers abandon inquiries if they wait more than 10 minutes, and PropTech investments in India grew 45% in 2024. Our 24/7 Supa Agent handles lead qualification instantly in 80+ languages, crucial since 68% of Indian property buyers prefer regional languages..."
```

**Prompt Template (Intelligence Level: EXPLICIT - Competitive)**
```
You are an expert sales consultant for Troika Tech Services.

User Question: {userQuery}
Intelligence Level: EXPLICIT

Your Knowledge Base: {kbContext}
Market Intelligence (Competitor Data): {intelligenceContext}

Task: Provide a direct comparison with specific competitors mentioned or relevant to the query.

Guidelines:
- Create clear, factual comparisons
- Include pricing, features, delivery time comparisons
- Be objective and professional, not defensive
- Use actual data from market intelligence
- Provide comparison table or structured format when appropriate
- Response length: 250-400 words

Example:
"Here's how we compare to Yellow.ai:

Pricing: Yellow.ai starts at ₹80,000+ setup vs. our ₹40,000
Languages: Yellow.ai offers English + limited regional languages vs. our 80+ languages
Delivery: Yellow.ai takes 2-4 weeks vs. our 24-72 hours

Both are strong AI chatbot solutions. Yellow.ai is excellent for large enterprises with complex needs. We're optimized for Indian SMBs needing faster deployment, comprehensive regional language support, and more accessible pricing..."
```

**Prompt Template (Intelligence Level: RECENT_UPDATES - Technology)**
```
You are an expert technology consultant for Troika Tech Services.

User Question: {userQuery}
Intelligence Level: RECENT_UPDATES

Your Knowledge Base: {kbContext}
Market Intelligence (Recent Tech News): {intelligenceContext}

Task: Share recent technology updates and how Troika Tech's offerings relate.

Guidelines:
- Highlight recent tech developments and industry trends
- Connect these trends to Troika Tech's capabilities
- Be forward-looking and informative
- Include relevant tech news from last 7 days when available
- Response length: 200-350 words

Example:
"The AI chatbot landscape is evolving rapidly. Recent developments include multimodal capabilities (text + voice + image) and improved multilingual models. Our Supa Agent already supports voice integration and 80+ languages. With OpenAI's latest GPT-4o updates, conversational quality has improved significantly—we've integrated these advances to make our chatbots even more natural and effective..."
```

**Model:** GPT-4o (higher quality for customer-facing responses)

---

### 4.5 API Endpoint Design

#### 4.5.1 New Route: `/api/troika-intelligent-chat`

**Method:** POST

**Request Body:**
```javascript
{
  "message": "How can your company help my real estate business?",
  "sessionId": "uuid-v4", // For conversation context
  "userId": "optional-user-id",
  "chatbotId": "troika-tech-main" // Troika's specific chatbot
}
```

**Response Examples by Intelligence Level:**

**Example 1: FAQ Query (Intelligence Level: NONE)**
```javascript
{
  "success": true,
  "data": {
    "response": "Our phone number is +91 9821211755. You can also reach us at info@troikatech.in or visit our office at 702, B44, Sector 1, Shanti Nagar, Mira Road East, Maharashtra 401107.",
    "responseType": "standard",
    "metadata": {
      "intentMatched": "faq_contact",
      "intelligenceLevel": "NONE",
      "kbChunksUsed": 1,
      "intelligencePiecesUsed": 0,
      "processingTime": "0.8s"
    }
  }
}
```

**Example 2: Service Inquiry (Intelligence Level: SUBTLE)**
```javascript
{
  "success": true,
  "data": {
    "response": "We offer AI Websites starting at ₹25,000 and Supa Agent chatbots at ₹40,000 setup. Speed is crucial in today's market—we deliver in 24-72 hours with multilingual support across 80+ languages. Our solutions are built specifically for Indian businesses, combining AI-powered automation with local market understanding.\n\nWould you like to know more about any specific service?",
    "responseType": "intelligent",
    "metadata": {
      "intentMatched": "service_inquiry",
      "intelligenceLevel": "SUBTLE",
      "kbChunksUsed": 3,
      "intelligencePiecesUsed": 2,
      "processingTime": "2.1s"
    }
  }
}
```

**Example 3: Industry-Specific (Intelligence Level: DATA_POINTS)**
```javascript
{
  "success": true,
  "data": {
    "response": "Troika Tech specializes in AI-powered solutions for real estate businesses. We offer AI Websites (₹25,000) and Supa Agent chatbots (₹40,000 setup + monthly rental).\n\nWhat's critical for real estate right now: 78% of property buyers abandon inquiries if they wait more than 10 minutes, and PropTech investments in India grew 45% in 2024. Our 24/7 Supa Agent handles lead qualification instantly in 80+ languages—crucial since 68% of Indian property buyers prefer communicating in regional languages like Hindi, Marathi, or Gujarati.\n\nWe've helped a real estate developer achieve 3× more inquiries. Our AI Website + Supa Agent combo delivers in 24-72 hours.\n\nWould you like to see how we can customize a solution for your real estate business?",
    "responseType": "intelligent",
    "metadata": {
      "intentMatched": "industry_real_estate",
      "intelligenceLevel": "DATA_POINTS",
      "kbChunksUsed": 3,
      "intelligencePiecesUsed": 5,
      "processingTime": "3.2s",
      "dataFreshness": "News: Oct 9 | Competitors: Oct 7"
    }
  }
}
```

**Example 4: Competitive Query (Intelligence Level: EXPLICIT)**
```javascript
{
  "success": true,
  "data": {
    "response": "Here's how Troika Tech compares to Yellow.ai:\n\n**Pricing:**\n- Yellow.ai: ₹80,000+ setup (as of Oct 7, 2025)\n- Troika Tech: ₹40,000 setup\n\n**Languages:**\n- Yellow.ai: English + limited regional languages\n- Troika Tech: 80+ languages including Hindi, Marathi, Gujarati\n\n**Delivery Time:**\n- Yellow.ai: 2-4 weeks\n- Troika Tech: 24-72 hours\n\n**Target Market:**\n- Yellow.ai: Large enterprises with complex needs\n- Troika Tech: Indian SMBs needing fast deployment\n\nBoth are strong AI chatbot solutions. We're optimized for Indian SMBs needing faster deployment, comprehensive regional language support, and more accessible pricing. Yellow.ai is excellent for large enterprises.\n\nWhich features matter most for your business?",
    "responseType": "intelligent",
    "metadata": {
      "intentMatched": "competitive_comparison",
      "intelligenceLevel": "EXPLICIT",
      "kbChunksUsed": 2,
      "intelligencePiecesUsed": 4,
      "competitorsCompared": ["Yellow.ai"],
      "processingTime": "3.5s"
    }
  }
}
```

**Note:** The `response` field always contains a SINGLE blended message. The intelligence level determines how much market context is included and how it's presented.

**Error Response:**
```javascript
{
  "success": false,
  "error": {
    "code": "INTELLIGENCE_UNAVAILABLE",
    "message": "Market intelligence temporarily unavailable. Providing standard response.",
    "fallbackResponse": "KB-only answer here"
  }
}
```

#### 4.5.2 Fallback Logic
If market intelligence retrieval fails:
1. Log error
2. Return KB-only response
3. Include note: "Providing answer based on our knowledge base"
4. Don't expose error to user

---

### 4.6 Conversation Context Management

#### 4.6.1 Session Context Storage
To handle follow-up queries like "yes", "tell me more", "why?", the system must maintain conversation context.

**Redis Session Storage:**
```javascript
{
  sessionId: "uuid-v4",
  userId: "optional",
  chatbotId: "troika-tech-main",
  conversationContext: {
    lastIntent: "service_inquiry",
    lastIntelligenceLevel: "SUBTLE",
    mentionedServices: ["AI Websites", "Supa Agent"],
    mentionedPricing: {
      "AI Websites": "₹25,000",
      "Supa Agent": "₹40,000"
    },
    mentionedCompetitors: ["Yellow.ai"],
    lastOfferOrQuestion: "Would you like to speak with our team?",
    contactInfo: {
      phone: "+91 9821211755",
      email: "info@troikatech.in"
    },
    conversationHistory: [
      {
        role: "user",
        message: "How can you help my real estate business?",
        timestamp: "2025-10-09T10:30:00Z"
      },
      {
        role: "assistant",
        message: "We offer AI Websites...",
        timestamp: "2025-10-09T10:30:05Z"
      }
    ]
  },
  createdAt: Date,
  expiresAt: Date // 24 hours from last message
}
```

#### 4.6.2 Follow-Up Intent Detection
Detect common follow-up patterns:

**Affirmative Responses:**
- "yes", "sure", "okay", "sounds good", "interested", "tell me more", "go ahead"

**Clarification Requests:**
- "why?", "how?", "explain", "what do you mean?", "tell me more about [X]"

**Negative Responses:**
- "no", "not interested", "maybe later", "not now"

**Continuation:**
- "and?", "what else?", "continue", "more details"

#### 4.6.3 Context-Aware Response Logic

**When user says "Yes" or "Sure":**
1. Check `lastOfferOrQuestion` in session context
2. If it was "Would you like to speak with our team?" → Provide contact info
3. If it was "Want to see pricing?" → Show detailed pricing
4. If it was "Interested in [service]?" → Provide service details

**Example Flow:**
```
Bot: "We offer AI Websites at ₹25,000. Would you like to speak with our team?"
[System stores: lastOfferOrQuestion = "Would you like to speak with our team?"]

User: "Yes"
[System detects: affirmative + lastOfferOrQuestion exists]

Bot: "Great! You can reach our team at:
     Phone: +91 9821211755
     Email: info@troikatech.in

     Our team is available Monday-Friday, 9 AM - 6 PM IST.
     Would you like me to share more details about AI Websites?"
```

**When user says "Why?" or "Tell me more":**
1. Check `mentionedServices` or `lastIntent` in context
2. Retrieve relevant KB chunks + intelligence for that topic
3. Provide deeper explanation

**Example Flow:**
```
Bot: "We deliver AI Websites in 24-72 hours."

User: "Why so fast?"
[System detects: clarification request + context = delivery speed]

Bot: "We use AI-powered website generation combined with pre-built industry templates.
     Traditional agencies take weeks because they build from scratch.
     Our process: 1) You share requirements, 2) AI generates structure,
     3) Our team customizes, 4) Deploy. While competitors like Wix require
     you to build it yourself, we handle everything."
```

#### 4.6.4 Context Injection into LLM Prompts

Update all LLM prompts to include conversation context:

```
You are an expert sales consultant for Troika Tech Services.

User Question: {userQuery}
Conversation Context:
- Last Intent: {lastIntent}
- Previously Mentioned Services: {mentionedServices}
- Previously Mentioned Pricing: {mentionedPricing}
- Last Question/Offer: {lastOfferOrQuestion}
- Last 3 Messages: {conversationHistory}

Your Knowledge Base: {kbContext}
Market Intelligence: {intelligenceContext}

Task: Respond to the user's follow-up query with full awareness of the conversation context.

If the user says "yes", "sure", or affirmative:
- Check lastOfferOrQuestion and respond accordingly
- Provide contact info if they agreed to connect with team
- Provide pricing details if they wanted to see pricing
- Provide service details if they showed interest

If the user asks "why?", "how?", or seeks clarification:
- Reference what was previously discussed
- Provide deeper explanation with relevant data

If the user asks a new question:
- Treat as a new query but maintain awareness of previous context
```

#### 4.6.5 Contact Information Availability

**Always include in session context:**
```javascript
contactInfo: {
  phone: "+91 9821211755",
  email: "info@troikatech.in",
  address: "702, B44, Sector 1, Shanti Nagar, Mira Road East, Maharashtra 401107",
  hours: "Monday-Friday, 9 AM - 6 PM IST",
  website: "https://troikatech.co.in"
}
```

**Trigger contact info automatically when:**
- User says "yes" after "Would you like to connect with our team?"
- User asks "how do I contact you?"
- User shows strong buying intent (e.g., "I want to get started")

#### 4.6.6 Session Expiration
- **Duration:** 24 hours from last message
- **Cleanup:** Redis TTL automatically removes expired sessions
- **Reactivation:** If user returns after expiration, treat as new conversation

---

### 4.7 Automated Cleanup

#### 4.7.1 Market Intelligence Data Retention Policy
- **Default:** 30 days from `scrapedAt`
- **Implementation:** MongoDB TTL index on `expiresAt` field
- **Rationale:** Keep data fresh, reduce storage costs, maintain relevance

#### 4.7.2 Market Intelligence Cleanup Exceptions
- High-value intelligence (relevanceScore > 0.9) retained for 60 days
- Competitor pricing changes flagged and retained longer
- Failed scrapes logged separately (7-day retention)

#### 4.7.3 Storage Management
- Monitor collection size weekly
- Alert if > 10GB (indicates scraping issue)
- Backup before bulk deletions

---

## 5. Non-Functional Requirements

### 5.1 Performance
- **Response Time:** < 5 seconds (95th percentile)
- **Scraping Job:** Complete within 2 hours
- **Concurrent Requests:** Support 100 simultaneous queries
- **Database Queries:** < 500ms for vector search

### 5.2 Reliability
- **Uptime:** 99.5% for chat endpoint
- **Scraping Success Rate:** > 80% of sources successfully scraped per run (news every 3 days, others weekly)
- **Fallback:** Always provide KB answer even if intelligence fails

### 5.3 Scalability
- Architecture supports future multi-tenant expansion
- Scraping system can add new competitors/sources without code changes
- LLM processing pipeline can handle 10x data volume

### 5.4 Security
- API endpoint secured with existing auth middleware
- No sensitive Troika Tech data exposed in responses
- Scraped competitor data stored securely
- Rate limiting on intelligent chat endpoint (stricter than standard chat)

### 5.5 Monitoring & Logging
- Log all scraping jobs (success/failure, duration)
- Track intelligence retrieval accuracy
- Monitor LLM token usage and costs
- Alert on scraping failures > 50%
- User query analytics (which intents most common)

---

## 6. Technical Architecture

### 6.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT APPLICATION                       │
│                   (Troika Tech Website)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ POST /api/troika-intelligent-chat
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXPRESS API SERVER                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Route: troikaIntelligentChatRoutes.js               │  │
│  │  Controller: troikaIntelligentChatController.js      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              INTELLIGENCE SERVICE LAYER                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  intentDetectionService.js                            │  │
│  │  - Match query against intent keywords                │  │
│  │  - Determine if intelligent response needed           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  intelligentResponseService.js                        │  │
│  │  - Retrieve KB context (existing vector search)       │  │
│  │  - Retrieve market intelligence (vector search)       │  │
│  │  - Call LLM synthesis                                 │  │
│  │  - Format final response                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────┴─────────────┐
         ▼                          ▼
┌──────────────────┐      ┌──────────────────────┐
│   MONGODB        │      │   OPENAI API         │
│                  │      │                      │
│ • knowledge_base │      │ • GPT-4o (synthesis) │
│ • market_intel   │      │ • GPT-4o-mini (summ) │
│ • intents        │      │ • text-embedding     │
└──────────────────┘      └──────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│           HYBRID SCRAPING SYSTEM (Cron Jobs)                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  scrapingOrchestrator.js                              │  │
│  │  - News: Every 3 days at 4:00 AM IST                  │  │
│  │  - Competitors/Trends: Weekly (Mon) at 4:00 AM IST    │  │
│  │  - Coordinates all scraping tasks                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  scrapers/                                            │  │
│  │  - competitorScraper.js (8 competitors)               │  │
│  │  - newsScraper.js (9 news sources)                    │  │
│  │  - trendingScraper.js (GitHub, Product Hunt, HN)      │  │
│  │  - marketingScraper.js (Social Media Today)           │  │
│  │  - troikaScraper.js (own content)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  llmProcessor.js                                      │  │
│  │  - Summarize scraped content (GPT-4o-mini)            │  │
│  │  - Extract key takeaways                              │  │
│  │  - Calculate relevance scores                         │  │
│  │  - Tag services & industries                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  embeddingGenerator.js                                │  │
│  │  - Generate embeddings for all new content            │  │
│  │  - Store in market_intelligence collection            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Data Flow

**Every-3-Days Scraping Flow (News):**
```
1. Cron triggers every 3 days at 4:00 AM IST
   ↓
2. scrapingOrchestrator starts news collection
   ↓
3. newsScraper runs:
   - TechCrunch → ~15 articles
   - VentureBeat → ~10 articles
   - YourStory → ~15 articles
   - Inc42 → ~12 articles
   - Medianama → ~8 articles
   - OpenAI Blog → ~3 articles
   - Google AI Blog → ~5 articles
   - Anthropic Blog → ~3 articles
   - Search Engine Journal → ~17 articles
   Total: ~88 articles
   ↓
4. Raw data stored temporarily (status: "scraped")
   ↓
5. llmProcessor batch processes:
   - Summarize each article
   - Extract takeaways
   - Calculate relevance
   - Tag services/industries
   ↓
6. embeddingGenerator creates vectors
   ↓
7. Update status to "ready"
   ↓
8. Log completion report
```

**Weekly Scraping Flow (Competitors + Trends):**
```
1. Cron triggers weekly (Mondays at 4:00 AM IST)
   ↓
2. scrapingOrchestrator starts comprehensive collection
   ↓
3. Parallel scraping tasks:
   - competitorScraper → 8 companies × 10 pages = 80 pages
   - trendingScraper → GitHub + Product Hunt + HN = ~9 items
   - marketingScraper → Social Media Today = ~5 articles
   - troikaScraper → Own blog + LinkedIn = ~5 items
   Total: ~99 items
   ↓
4. Raw data stored temporarily (status: "scraped")
   ↓
5. llmProcessor batch processes:
   - Summarize each piece
   - Extract takeaways
   - Calculate relevance
   - Tag services/industries
   ↓
6. embeddingGenerator creates vectors
   ↓
7. Update status to "ready"
   ↓
8. Log completion report
```

**Query-Time Flow:**
```
1. User sends message to /api/troika-intelligent-chat
   ↓
2. intentDetectionService checks for keyword match
   ↓
3a. No match → Return standard KB response
   ↓
3b. Match found → Continue to intelligent response
   ↓
4. intelligentResponseService:
   - Vector search knowledge_base → top 3 chunks
   - Vector search market_intelligence → top 5 pieces
   ↓
5. Send to GPT-4o for synthesis
   ↓
6. Return conversational response to user
```

### 6.3 Technology Stack

**Core:**
- Node.js v18+
- Express.js v5
- MongoDB v8+ (with Atlas Vector Search)
- Redis (for caching expensive LLM calls)

**Scraping:**
- Puppeteer v24 (JS-heavy sites)
- Axios v1.10 + Cheerio v1.1 (static sites)
- axios-retry v3.9 (retry logic)

**AI/ML:**
- OpenAI API v5.8
  - GPT-4o (query-time synthesis)
  - GPT-4o-mini (batch summarization)
  - text-embedding-3-small (embeddings)

**Scheduling:**
- node-cron v4.2

**Utilities:**
- winston v3.17 (logging)
- dayjs v1.11 (date handling)

---

## 7. Implementation Plan

### Phase 1: Foundation (Week 1-2)
**Goal:** Set up data collection infrastructure

**Tasks:**
1. Create `market_intelligence` MongoDB collection with schema
2. Create `intelligent_intents` collection and seed initial keywords
3. Implement basic scraping system:
   - `scrapingOrchestrator.js`
   - `competitorScraper.js` (start with 2 competitors)
   - `newsScraper.js` (start with 2 news sources)
4. Set up cron jobs (news every 3 days, competitors/trends weekly)
5. Test scraping pipeline, verify data collection
6. Implement basic LLM summarization

**Deliverables:**
- Scraping system running on hybrid schedule
- Raw data being collected and summarized
- Initial market intelligence database populated

### Phase 2: Intelligence Processing (Week 3)
**Goal:** Enrich data with embeddings and relevance scoring

**Tasks:**
1. Implement `llmProcessor.js`:
   - Summarization prompt engineering
   - Key takeaway extraction
   - Relevance scoring
   - Service/industry tagging
2. Implement `embeddingGenerator.js`
3. Set up Atlas Vector Search index on `market_intelligence`
4. Test vector search retrieval accuracy
5. Implement TTL cleanup (30-day expiration)

**Deliverables:**
- Fully processed intelligence data
- Vector search functional
- Automated cleanup working

### Phase 3: API Development (Week 4)
**Goal:** Build intelligent chat endpoint

**Tasks:**
1. Create route: `routes/troikaIntelligentChatRoutes.js`
2. Create controller: `controllers/troikaIntelligentChatController.js`
3. Create services:
   - `services/intentDetectionService.js`
   - `services/intelligentResponseService.js`
4. Implement query-time synthesis logic with single blended response
5. Add fallback handling
6. Implement Redis caching for similar queries

**Deliverables:**
- `/api/troika-intelligent-chat` endpoint live
- Intent detection working
- Single blended response generation functional (not dual messages)

### Phase 4: Testing & Refinement (Week 5)
**Goal:** Ensure quality and reliability

**Tasks:**
1. Write unit tests for core services
2. Write integration tests for API endpoint
3. Manual testing with real queries
4. Prompt engineering refinement based on response quality
   - Focus on naturalness of KB + intelligence blending
   - Ensure responses feel unified, not disjointed
5. Performance optimization (caching, query efficiency)
6. Error handling improvements
7. Add monitoring and logging

**Deliverables:**
- Test coverage > 70%
- Response quality validated (blending feels natural)
- System stable and monitored

### Phase 5: Expansion (Week 6)
**Goal:** Scale to full competitor and source list

**Tasks:**
1. Add remaining 6 competitors to scraping (expand to 8 total)
2. Add remaining 7 news sources (expand to 9 total)
3. Add trending sources (GitHub, Product Hunt, HN)
4. Add marketing sources (Social Media Today)
5. Add Troika Tech own content scraping
6. Expand intent keyword list based on real usage
7. Fine-tune relevance scoring

**Deliverables:**
- All 8 competitors monitored
- All 9 news sources scraped
- Comprehensive market intelligence coverage

### Phase 6: Production Launch (Week 7)
**Goal:** Deploy to production

**Tasks:**
1. Production environment setup
2. Monitor scraping job performance
3. Monitor API response times and quality
4. Gather user feedback
5. Iterate on prompt improvements
6. Document system for future maintenance

**Deliverables:**
- System live in production
- Monitoring dashboards active
- Documentation complete

---

## 8. Success Criteria

### 8.1 Technical Metrics
- ✅ Scraping success rate > 80%
- ✅ API response time < 5 seconds (p95)
- ✅ System uptime > 99.5%
- ✅ Data freshness: news updated every 3 days, competitors/trends updated weekly
- ✅ Zero data loss during cleanup

### 8.2 Quality Metrics
- ✅ Response relevance (manual review): > 85% quality score
- ✅ Response naturalness: KB + intelligence blend seamlessly (not disjointed)
- ✅ Intent detection accuracy: > 90%
- ✅ User feedback: Positive sentiment > 75%

### 8.3 Business Metrics
- ✅ Increased engagement time with chatbot
- ✅ Higher conversion rate for qualified leads
- ✅ Reduced "I don't know" responses
- ✅ Sales team reports improved lead quality

---

## 9. Risks & Mitigation

### 9.1 Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Competitor sites block scraping | High | Medium | Use rotating proxies, respect rate limits, fallback to manual updates |
| LLM API downtime | High | Low | Implement fallback to KB-only responses, cache recent summaries |
| MongoDB Atlas Vector Search limitations | Medium | Low | Test thoroughly in dev, have backup semantic search approach |
| Scraping job exceeds 2-hour window | Medium | Medium | Optimize scraping logic, parallelize tasks, reduce source count if needed |
| High OpenAI API costs | Medium | Medium | Monitor token usage, implement aggressive caching, use GPT-4o-mini where possible |

### 9.2 Quality Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| LLM generates inaccurate comparisons | High | Medium | Strong prompt guardrails, manual spot-checks, user feedback loop |
| Scraped data is irrelevant/noisy | Medium | Medium | Improve relevance scoring, refine source selection |
| Response too long/verbose | Low | Medium | Prompt engineering for conciseness, test with real users |
| Intent detection misses queries | Medium | High | Log unmatched queries, expand keyword list iteratively |

### 9.3 Business Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Competitors object to scraping | Medium | Low | Only scrape public data, follow robots.txt, consult legal if needed |
| System provides overly aggressive competitor criticism | High | Low | Prompt guardrails to stay factual and professional |
| Data becomes stale during scraping failures | Medium | Medium | Alert on scraping failures, manual fallback process |

---

## 10. Cost Estimation

### 10.1 OpenAI API Costs (Monthly)

**Scraping/Summarization (Hybrid Schedule):**

*Every 3 Days (News):*
- 88 articles per run × 10 runs/month = 880 articles/month
- GPT-4o-mini for summarization:
  - Input: ~500 tokens/piece × 880 = 440,000 tokens/month
  - Output: ~300 tokens/piece × 880 = 264,000 tokens/month
  - Cost: ($0.15/1M input) + ($0.60/1M output) = $0.066 + $0.158 = **~$0.22/month**

*Weekly (Competitors + Trends):*
- 99 items per week × 4 weeks = 396 items/month
- GPT-4o-mini for summarization:
  - Input: ~500 tokens/piece × 396 = 198,000 tokens/month
  - Output: ~300 tokens/piece × 396 = 118,800 tokens/month
  - Cost: ($0.15/1M input) + ($0.60/1M output) = $0.030 + $0.071 = **~$0.10/month**

*Combined Summarization: ~$0.32/month*

**Embeddings (Combined):**
- Total pieces: 880 + 396 = 1,276 pieces/month
- 1,276 pieces × 300 tokens = 382,800 tokens/month
- text-embedding-3-small: $0.02/1M tokens
- **Monthly: ~$0.008 (negligible, round to ~$0.01)**

**Query-Time Synthesis:**
- Assume 100 intelligent queries/day
- GPT-4o for synthesis:
  - Input: ~2,000 tokens/query (KB + intelligence context)
  - Output: ~400 tokens/query
  - Cost per query: ~$0.012
  - Daily: $1.20
  - **Monthly: ~$36**

**Total OpenAI: ~$36.50/month**
- Summarization: $0.32
- Embeddings: $0.01
- Query Synthesis: $36.00
- **Grand Total: $36.50/month**

### 10.2 Infrastructure Costs

**MongoDB Atlas:**
- Additional storage: ~3GB/month for market_intelligence (reduced due to less frequent scraping)
- Vector Search: Included in M10+ tier
- **Estimated: $6/month additional**

**Puppeteer/Scraping:**
- CPU/memory for hybrid scraping jobs (every 3 days + weekly)
- **Estimated: $2/month** (reduced from $5 due to less frequent scraping)

**Total Monthly Cost: ~$44.50**
- OpenAI API: $36.50
- MongoDB: $6.00
- Scraping Infrastructure: $2.00
- **Grand Total: ~$44.50/month** (down from ~$53/month with daily scraping)

### 10.3 Development Cost (One-Time)
- 6-7 weeks development
- 1 senior backend developer
- Estimate based on your internal rates

---

## 11. Monitoring & Maintenance

### 11.1 Regular Monitoring
- Scraping job completion status (news every 3 days, competitors/trends weekly)
- Success/failure rate per source
- Data volume collected per run
- LLM processing completion
- Storage usage

### 11.2 Weekly Reviews
- Response quality spot-checks (10 random queries)
  - Check naturalness of blending (KB + intelligence feel unified?)
  - Verify accuracy of facts and data points
- Intent detection accuracy
- User feedback analysis
- Cost tracking (OpenAI usage)

### 11.3 Monthly Tasks
- Review and expand intent keywords
- Add/remove competitor sources based on relevance
- Prompt engineering improvements
- Performance optimization

### 11.4 Alerts
- Scraping job fails to complete
- Scraping success rate < 70%
- API response time > 10 seconds
- OpenAI API costs > $60/month
- Storage > 10GB

---

## 12. Future Enhancements (Phase 2+)

### 12.1 Admin Dashboard
- View scraped intelligence
- Manually approve/reject content
- Pin important updates
- Edit summaries
- Add custom intelligence

### 12.2 Multi-Tenant Support
- Enable for other Troika Tech clients
- Per-company competitor lists
- Customizable intelligence sources

### 12.3 Advanced Features
- Real-time alerts for major competitor changes
- Automatic competitive battle cards generation
- Sentiment analysis on competitor reviews
- Price change tracking with notifications
- A/B testing of response formats

### 12.4 Analytics
- Dashboard showing:
  - Most asked question categories
  - Intelligence pieces most referenced
  - Conversion correlation analysis
  - User satisfaction scores

---

## 13. Appendices

### Appendix A: Sample Intent Keywords (Full List)

**Service Inquiry:**
- how can you help
- what services
- tell me about your company
- what do you do
- your solutions
- how does [service] work
- explain [service]
- pricing
- cost
- packages

**Competitive:**
- compare with
- vs [competitor]
- why you over
- difference between
- better than
- advantages
- why choose you
- alternative to

**Industry-Specific:**
- real estate
- education
- retail
- e-commerce
- healthcare
- pharma
- political campaign
- NGO
- fashion

**Technology:**
- AI trends
- latest in AI
- chatbot technology
- WhatsApp business
- voice AI
- video AI
- what's new
- industry updates

### Appendix B: Competitor URLs Reference

| Competitor | Homepage | Pricing | LinkedIn |
|------------|----------|---------|----------|
| Yellow.ai | https://yellow.ai | https://yellow.ai/pricing | /company/yellowdotai |
| Wix | https://www.wix.com/ai-website-builder | https://www.wix.com/upgrade/website | /company/wix-com |
| Hostinger | https://www.hostinger.com/ai-website-builder | https://www.hostinger.com/web-hosting | /company/hostinger |
| Synthesia | https://www.synthesia.io | https://www.synthesia.io/pricing | /company/synthesia |
| HeyGen | https://www.heygen.com | https://www.heygen.com/pricing | /company/heygen |
| Interakt | https://www.interakt.shop | https://www.interakt.shop/pricing | /company/interakt |
| Gupshup | https://www.gupshup.io | https://www.gupshup.io/pricing | /company/gupshup |
| Bland.ai | https://www.bland.ai | https://www.bland.ai/pricing | /company/bland-ai |

### Appendix C: LLM Prompt Templates

**See Section 4.4 for detailed prompt templates**

### Appendix D: Error Codes

| Code | Description | User Message |
|------|-------------|--------------|
| INTENT_NOT_MATCHED | No intelligent intent detected | Standard KB response |
| INTELLIGENCE_UNAVAILABLE | Market intelligence retrieval failed | Fallback to KB only |
| LLM_TIMEOUT | OpenAI API timeout | "Processing your request..." + retry |
| SCRAPING_FAILED | Scraping job failed (news/competitors/trends) | Internal alert, no user impact |
| EMBEDDING_ERROR | Failed to generate embeddings | Log and continue with text search |

---

## 14. Sign-off

**Product Owner:** ____________________
**Technical Lead:** ____________________
**Date:** ____________________

---

**Document Version History:**
- v1.0 (Oct 9, 2025): Initial PRD draft with daily scraping and dual-response format
- v1.1 (Oct 9, 2025): Updated to hybrid scraping schedule - news every 3 days (88 articles/run), competitors/trends weekly (99 items/week). Reduced monthly cost from ~$53 to ~$44.50. Total monthly content: 1,276 pieces (down from 5,250)
- v1.2 (Oct 9, 2025): Changed response format from dual messages (KB + Intelligence separate) to single blended conversational response. Updated LLM prompts, API response format, and success metrics to reflect unified response approach
- v1.3 (Oct 9, 2025): Introduced tiered intelligence levels (NONE, SUBTLE, DATA_POINTS, EXPLICIT, RECENT_UPDATES) to provide query-appropriate responses. FAQ queries get KB-only answers, service inquiries get subtle context, industry queries get statistics, competitive queries get explicit comparisons, and tech queries get recent updates. Added intelligenceLevel field to intents schema and created 5 distinct prompt templates for each level
- v1.4 (Oct 9, 2025): Added comprehensive conversation context management system (Section 4.6) with Redis session storage to handle follow-ups like "yes/no", "why/how", "tell me more". System tracks lastOfferOrQuestion, mentionedServices, mentionedPricing, conversationHistory to provide context-aware responses. Contact info automatically provided when user agrees to connect with team. Session expires after 24 hours
