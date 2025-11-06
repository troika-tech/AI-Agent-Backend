# Persona Length Recommendations

## TL;DR

**Recommended Persona Length:**
- **Minimum**: 200 characters (50 words)
- **Optimal**: 800-1200 characters (200-300 words)
- **Maximum**: 2000 characters (500 words)

**Token Budget**: ~300-500 tokens for persona

---

## Token Budget Analysis

### GPT-4o-mini Context Window
- **Total**: 128,000 tokens
- **Usable for input**: ~120,000 tokens (reserve some for output)

### Current Context Allocation

#### 1. System Prompt Components (Total: ~3000-5000 tokens)

```
Component                          | Chars  | Tokens | Priority
-----------------------------------|--------|--------|----------
Persona Text                       | 800    | ~200   | HIGH
Current Date/Time                  | 50     | ~15    | LOW
KB Context (5 chunks)              | 1500   | ~375   | HIGH
Conversation Awareness             | 200    | ~50    | MEDIUM
Language Instruction               | 150    | ~40    | MEDIUM
Response Style Guide               | 300    | ~75    | HIGH
Follow-up Instructions             | 400    | ~100   | HIGH
Product Instructions (optional)    | 500    | ~125   | MEDIUM
-----------------------------------|--------|--------|----------
TOTAL SYSTEM PROMPT                | ~3900  | ~980   |
```

#### 2. Conversation History (~2000-8000 tokens)

```
Messages  | Avg Length | Total Chars | Tokens
----------|------------|-------------|--------
20 msgs   | 100 chars  | 2000        | ~500
20 msgs   | 200 chars  | 4000        | ~1000
20 msgs   | 400 chars  | 8000        | ~2000
```

#### 3. User Query (~50-500 tokens)

```
Query Type    | Chars  | Tokens
--------------|--------|--------
Simple        | 20     | ~5
Medium        | 100    | ~25
Complex       | 500    | ~125
```

#### 4. Response Generation (~500-1000 tokens reserved)

```
Response Type | Tokens
--------------|--------
Brief (60w)   | ~80
Detailed(80w) | ~100
```

---

## Total Token Usage Breakdown

### Scenario 1: Minimal Conversation (NEW USER)

```
System Prompt:        1000 tokens
Conversation History:    0 tokens (new user)
User Query:            100 tokens
Response Reserved:     500 tokens
----------------------
TOTAL INPUT:          1100 tokens
Available Context: 118,900 tokens (97% unused)
```

**Persona Budget**: Can afford **2000-3000 tokens** (~8000-12000 chars)
But this is wasteful!

---

### Scenario 2: Medium Conversation (10-15 messages)

```
System Prompt:        1000 tokens
Conversation History: 1500 tokens (15 messages)
User Query:            100 tokens
Response Reserved:     500 tokens
----------------------
TOTAL INPUT:          3100 tokens
Available Context: 116,900 tokens (96% unused)
```

**Persona Budget**: Can afford **2000 tokens** (~8000 chars)

---

### Scenario 3: Long Conversation (20+ messages)

```
System Prompt:        1000 tokens
Conversation History: 3000 tokens (20 messages, some long)
KB Context:           1500 tokens (complex query needs more chunks)
User Query:            100 tokens
Response Reserved:     500 tokens
----------------------
TOTAL INPUT:          6100 tokens
Available Context: 113,900 tokens (94% unused)
```

**Persona Budget**: Can afford **1500 tokens** (~6000 chars)

---

## Optimal Persona Length Calculation

### Token-to-Character Ratio
- **English**: ~1 token = 4 characters
- **With formatting**: ~1 token = 3.5 characters (markdown, newlines)

### Recommended Allocation

#### **Option 1: Concise Persona (RECOMMENDED)**

**200-300 words (~800-1200 characters)**

**Tokens**: ~200-300 tokens (~20-30% of system prompt)

**Example:**
```
You are Troika's WhatsApp Marketing Assistant – a friendly expert helping
businesses launch compliant, high-ROI WhatsApp campaigns.

EXPERTISE:
- WhatsApp bulk messaging (3L to 20L+ plans)
- Lead verification and targeting (city, profession filters)
- Campaign strategy for brands, institutes, and startups

PERSONALITY:
- Conversational yet professional
- Helpful marketing advisor, not pushy salesperson
- Warm, outcome-focused, contextually aware

APPROACH:
1. Understand business name, industry, campaign goal
2. Explain WhatsApp Marketing value (instant reach, 80-90% delivery)
3. Share relevant packages (3L/5L/10L/20L+)
4. Guide to WhatsApp verification
5. Confirm next steps

[~800 characters, ~200 tokens]
```

**Benefits:**
✅ Clear and focused
✅ Leaves room for KB context
✅ Fast to process
✅ Easy to update

---

#### **Option 2: Detailed Persona**

**400-500 words (~1600-2000 characters)**

**Tokens**: ~400-500 tokens (~40-50% of system prompt)

**Example:**
```
You are Troika's WhatsApp Marketing Assistant – an AI consultant helping
businesses run compliant, high-ROI WhatsApp campaigns.

EXPERTISE:
- WhatsApp bulk messaging: 3L to 20L+ verified number plans
- Lead verification: City/profession/industry filters
- Campaign strategy: Promotions, events, lead generation
- Compliance: 100% legal under Indian IT Act
- ROI focus: 80-90% delivery, cost recovery in 1-2 conversions

PERSONALITY:
- Conversational yet professional
- Helpful marketing advisor, not a pushy salesperson
- Warm, outcome-focused, contextually aware
- Patient with objections, confident in value

CONVERSATION APPROACH:
1. Understand: Business name, industry, campaign goal
2. Educate: WhatsApp Marketing value (reach, delivery, verified data)
3. Present: Package options relevant to their scale
4. Verify: Request WhatsApp number (once per conversation)
5. Handoff: Confirm callback timing for personalized consultation

KEY PACKAGES:
- 3L (2+1): ₹1.2L → ₹0.40/msg
- 5L (3+2): ₹1.8L → ₹0.35/msg
- 10L (5+5): ₹3L → ₹0.30/msg
- Enterprise: Custom pricing, bulk discounts up to 50%

OBJECTION HANDLING:
- Price: Most clients recover costs with one conversion
- Legality: 100% compliant, virtual numbers (not TRAI-regulated)
- Data quality: 80-90% delivery, verified sources
- Privacy: Data auto-deletes after 21 days

COMPLIANCE NOTES:
- Legal under Indian IT Act
- No alcohol/gambling/adult content
- GST 18%, TDS 2%

CONVERSATION MEMORY:
- Never repeat questions already asked
- Reference previous messages naturally
- Once verified, don't ask again
- Personalize based on industry/goal

[~1800 characters, ~450 tokens]
```

**Benefits:**
✅ Comprehensive guidance
✅ Covers objections
✅ Package details included
⚠️ Longer = more tokens
⚠️ Risk of overwhelming simple queries

---

#### **Option 3: Minimal Persona** (Not recommended)

**50-100 words (~200-400 characters)**

**Tokens**: ~50-100 tokens

**Example:**
```
You are Troika's WhatsApp Marketing Assistant. Help businesses launch
WhatsApp campaigns. Be friendly, professional, and helpful. Guide them
through packages (3L/5L/10L) and collect WhatsApp numbers for verification.

[~200 characters, ~50 tokens]
```

**Problems:**
❌ Too vague
❌ No personality
❌ Missing key details
❌ LLM will improvise (bad!)

---

## Impact on Context Quality

### Persona Length vs Context Quality

| Persona Size | Tokens | KB Context Available | Conversation History | Quality |
|--------------|--------|---------------------|---------------------|---------|
| 200 chars    | ~50    | 2000+ tokens        | 3000+ tokens        | ⚠️ Too vague |
| 800 chars    | ~200   | 1800+ tokens        | 3000+ tokens        | ✅ **OPTIMAL** |
| 1200 chars   | ~300   | 1700+ tokens        | 3000+ tokens        | ✅ Good |
| 2000 chars   | ~500   | 1500+ tokens        | 3000+ tokens        | ⚠️ Might limit KB |
| 4000 chars   | ~1000  | 1000+ tokens        | 3000+ tokens        | ❌ Too long |

---

## Token Budget Breakdown (Recommended)

```
Total System Prompt Budget: 4000 tokens
├── Persona:                  300 tokens (800 chars)  [7.5%]
├── KB Context:              1500 tokens (5 chunks)   [37.5%]
├── Conversation Awareness:   100 tokens              [2.5%]
├── Language Instruction:      50 tokens              [1.25%]
├── Response Style:           100 tokens              [2.5%]
├── Follow-up Instructions:   150 tokens              [3.75%]
└── Reserved/Buffer:         1800 tokens              [45%]

Total: 4000 tokens system prompt + 3000 tokens history = 7000 tokens input
Leaves: 121,000 tokens available (more than enough!)
```

---

## Real-World Examples

### Example 1: E-commerce Chatbot

**Persona Length**: 950 characters (~240 tokens)

```
You are ShopMate, a friendly shopping assistant for XYZ Store.

ROLE: Help customers find products, answer questions, and complete purchases.

EXPERTISE:
- Product catalog: Electronics, fashion, home goods
- Pricing, offers, and discounts
- Order tracking and returns
- Size guides and recommendations

PERSONALITY:
- Enthusiastic but not pushy
- Patient with questions
- Detail-oriented with product specs
- Celebrates customer finds!

APPROACH:
1. Understand what they're looking for
2. Ask clarifying questions (budget, preferences)
3. Recommend 2-3 relevant products
4. Share key specs and pricing
5. Guide to checkout or cart

RULES:
- Always check current stock before recommending
- Mention ongoing sales/offers naturally
- If out of stock, suggest similar alternatives
- Collect email for order confirmation

[950 characters, ~240 tokens]
```

---

### Example 2: Educational Institute Chatbot

**Persona Length**: 1100 characters (~275 tokens)

```
You are EduAssist, an admissions counselor for ABC Institute.

ROLE: Guide prospective students through programs, admissions, and enrollment.

EXPERTISE:
- Course catalog: Engineering, Management, Design
- Admission criteria: 10+2, entrance exams, eligibility
- Fees, scholarships, financial aid
- Campus facilities, placements, rankings

PERSONALITY:
- Professional yet approachable
- Inspiring and motivational
- Patient with parent/student concerns
- Data-driven (mention stats naturally)

APPROACH:
1. Understand student's background (stream, marks, interests)
2. Explain relevant programs (duration, curriculum, outcomes)
3. Share admission process (deadlines, exams, documents)
4. Discuss fees and scholarship options
5. Collect contact info for counselor callback

KEY STATS TO MENTION:
- 95% placement rate
- Average package: ₹8.5 LPA
- Industry partnerships: 200+ companies
- NAAC A+ accreditation

OBJECTIONS:
- "Too expensive" → Scholarships available (merit: 30%, need: 50%)
- "Tough to get in" → Multiple admission routes (JEE, state, management)
- "Far from home" → Hostel facilities, transport, safety measures

[1100 characters, ~275 tokens]
```

---

## Character Count Estimation Guide

### Quick Estimation

**50 words** ≈ 250-300 characters
**100 words** ≈ 500-600 characters
**200 words** ≈ 1000-1200 characters
**300 words** ≈ 1500-1800 characters
**500 words** ≈ 2500-3000 characters

### What Fits Where

#### 200 Characters (~50 words)
```
You are ABC Assistant. Help users with [task]. Be [personality traits].
Guide them through [process]. Collect [info] and handoff to team.

[Too brief - lacks personality and guidance]
```

#### 800 Characters (~200 words) ⭐ **RECOMMENDED**
```
You are ABC Assistant - [role description]

EXPERTISE:
- [3-4 key areas]

PERSONALITY:
- [3-4 traits]

APPROACH:
1. [Step 1]
2. [Step 2]
3. [Step 3]

KEY RULES:
- [2-3 important rules]

[Perfect balance - clear, focused, actionable]
```

#### 1200 Characters (~300 words)
```
[Same as above PLUS]

COMMON OBJECTIONS:
- [Objection 1] → [Response]
- [Objection 2] → [Response]

KEY STATS:
- [Stat 1]
- [Stat 2]

[Good for complex domains - sales, education, healthcare]
```

#### 2000 Characters (~500 words)
```
[Same as 1200 PLUS]

DETAILED PROCESS:
[Longer workflows]

COMPLIANCE NOTES:
[Legal/regulatory details]

CONVERSATION MEMORY:
[Advanced context handling]

[Maximum recommended - use only if absolutely necessary]
```

---

## Recommendations by Use Case

### Use Case 1: Simple FAQ Bot
**Recommended**: 400-600 characters (~100-150 words)
```
You are HelpBot for XYZ Company.
Answer FAQs about [topics].
Be helpful and concise.
If unknown, direct to support@email.com
```

---

### Use Case 2: Sales/Lead Generation (Like Yours!)
**Recommended**: 800-1200 characters (~200-300 words) ⭐

**Why this range?**
- ✅ Covers sales process (understand → present → verify → handoff)
- ✅ Includes objection handling
- ✅ Defines personality clearly
- ✅ Provides package info
- ✅ Leaves room for KB context (pricing details, case studies)

---

### Use Case 3: Complex Domain (Healthcare, Legal)
**Recommended**: 1200-1600 characters (~300-400 words)

**Why longer?**
- Compliance requirements
- Risk mitigation (disclaimers)
- Multi-step processes
- Detailed objection handling

---

### Use Case 4: E-commerce
**Recommended**: 600-1000 characters (~150-250 words)

**Why?**
- Product recommendations need KB context
- Stock/pricing in KB, not persona
- Focus on conversation flow

---

## Final Recommendation for Troika WhatsApp Marketing

### **OPTIMAL: 800-1200 characters (~200-300 words)**

**Template Structure:**
```
[WHO YOU ARE - 1 sentence]

EXPERTISE:
[3-5 bullet points - 100 chars]

PERSONALITY:
[3-4 traits - 80 chars]

APPROACH:
[5-step process - 150 chars]

KEY PACKAGES: (OPTIONAL - can be in KB instead)
[Brief mention - 100 chars]

OBJECTION HANDLING: (OPTIONAL)
[2-3 common objections - 200 chars]

CONVERSATION RULES:
[2-3 key rules - 100 chars]
```

**Total**: ~800-1000 characters

---

## Token Monitoring

### How to Check Actual Token Count

**Option 1: Use tiktoken library**
```javascript
const tiktoken = require('tiktoken');
const encoding = tiktoken.encoding_for_model('gpt-4o-mini');

const personaText = "Your persona here...";
const tokens = encoding.encode(personaText);
console.log(`Persona tokens: ${tokens.length}`);
```

**Option 2: Use OpenAI Tokenizer**
https://platform.openai.com/tokenizer

**Option 3: Rough Estimation**
```javascript
// Quick estimate
const estimatedTokens = Math.ceil(personaText.length / 4);
console.log(`Estimated tokens: ${estimatedTokens}`);
```

---

## Best Practices

### ✅ DO:
- Keep persona **focused and actionable**
- Use **clear structure** (sections with headers)
- Include **personality traits** (1-2 sentences)
- Define **conversation flow** (numbered steps)
- Mention **key rules** (2-3 critical points)

### ❌ DON'T:
- Include **detailed product info** (put in KB instead)
- Write **long paragraphs** (use bullet points)
- Repeat **information** (be concise)
- Add **generic fluff** (every word should add value)
- Exceed **2000 characters** (diminishing returns)

---

## Summary

| Length          | Characters | Words   | Tokens | Use Case              | Rating |
|-----------------|------------|---------|--------|-----------------------|--------|
| Minimal         | 200-400    | 50-100  | 50-100 | Simple FAQ            | ⚠️ Limited |
| **Optimal**     | **800-1200** | **200-300** | **200-300** | **Sales/Support** | ⭐⭐⭐⭐⭐ |
| Detailed        | 1200-1600  | 300-400 | 300-400 | Complex domains       | ⭐⭐⭐⭐ |
| Maximum         | 1600-2000  | 400-500 | 400-500 | Highly regulated      | ⭐⭐⭐ |
| Too Long        | 2000+      | 500+    | 500+   | NOT RECOMMENDED       | ❌ |

---

## For Your Troika WhatsApp Marketing Bot

**My Recommendation**: **1000 characters (~250 words, ~250 tokens)**

**Why?**
- ✅ Covers all necessary sales guidance
- ✅ Includes personality and approach
- ✅ Room for objection handling
- ✅ Leaves 75% of system prompt budget for KB context
- ✅ Fast to process
- ✅ Easy to update

**This gives you the best balance of:**
- Clear guidance for the LLM
- Room for rich KB context (pricing, case studies, FAQs)
- Fast response times
- High-quality, contextual responses

---

**Questions?**
- Test with your current persona length
- Monitor token usage in logs
- Adjust based on response quality
- Remember: KB context often more valuable than long persona!
