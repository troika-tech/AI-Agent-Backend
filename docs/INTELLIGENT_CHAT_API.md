# Intelligent Chat API Documentation

The Intelligent Chat API provides AI-powered sales agent capabilities with market intelligence, supporting both text and voice interactions.

## Table of Contents
- [Endpoints](#endpoints)
  - [Text Chat](#1-text-chat)
  - [Voice Chat](#2-voice-chat)
  - [Intelligence Search](#3-intelligence-search)
  - [Statistics](#4-statistics)
- [Features](#features)
- [Response Format](#response-format)
- [Examples](#examples)

---

## Endpoints

### 1. Text Chat

**Endpoint:** `POST /api/troika/intelligent-chat`

Intelligent sales agent with text input, optional TTS output.

#### Request Body (JSON)
```json
{
  "query": "How is Troika Tech better than Yellow.ai?",
  "chatbotId": "60d5f484f8d2c45a7c8e1234",
  "sessionId": "sess_1234567890_abc",
  "email": "user@example.com",
  "phone": "+919876543210",
  "language": "en",
  "context": {
    "industry": "Real Estate",
    "services": ["Supa Agent", "WhatsApp Marketing"]
  },
  "enableTTS": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | ✅ Yes | User's question (1-1000 characters) |
| `chatbotId` | string | ❌ No | Chatbot ID for KB retrieval (uses chatbot's knowledge base) |
| `sessionId` | string | ❌ No | Session ID for conversation continuity |
| `email` | string | ❌ No | User's email (for tracking/personalization) |
| `phone` | string | ❌ No | User's phone number (for tracking/personalization) |
| `language` | string | ❌ No | Language hint (e.g., 'en', 'hi') |
| `context.industry` | string | ❌ No | User's industry context |
| `context.services` | string[] | ❌ No | Services user is interested in |
| `enableTTS` | boolean | ❌ No | Return audio response (default: false) |

#### Response (JSON)
```json
{
  "success": true,
  "data": {
    "answer": "Troika Tech offers several advantages...",
    "sessionId": "sess_1234567890_abc",
    "intelligenceLevel": "EXPLICIT",
    "intent": {
      "category": "competitive",
      "intelligenceLevel": "EXPLICIT",
      "keyword": "better than",
      "confidence": 0.85
    },
    "intelligenceUsed": 3,
    "citations": [
      {
        "source": "Yellow.ai",
        "title": "Yellow.ai Pricing Plans",
        "url": "https://yellow.ai/pricing",
        "type": "competitor"
      }
    ],
    "metadata": {
      "isFollowUp": false,
      "hasContext": true,
      "intentKeywords": ["better than", "yellow.ai"]
    },
    "audio": "data:audio/mpeg;base64,...",
    "processedText": "Troika Tech offers several advantages..."
  }
}
```

---

### 2. Voice Chat

**Endpoint:** `POST /api/troika/intelligent-chat/voice`

Intelligent sales agent with voice input (STT), voice output (TTS).

#### Request (Multipart Form Data)
```
POST /api/troika/intelligent-chat/voice
Content-Type: multipart/form-data

audio: [audio file - mp3, wav, webm, mp4, ogg]
chatbotId: 60d5f484f8d2c45a7c8e1234 (optional)
sessionId: sess_1234567890_abc (optional)
email: user@example.com (optional)
phone: +919876543210 (optional)
context: {"industry":"Real Estate","services":["Supa Agent"]} (optional JSON string)
enableTTS: true (optional, default: true)
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | file | ✅ Yes | Audio file (mp3, wav, webm, mp4, ogg) |
| `chatbotId` | string | ❌ No | Chatbot ID for KB retrieval |
| `sessionId` | string | ❌ No | Session ID for conversation continuity |
| `email` | string | ❌ No | User's email |
| `phone` | string | ❌ No | User's phone number |
| `context` | string (JSON) | ❌ No | Context as JSON string |
| `enableTTS` | string | ❌ No | "true" or "false" (default: true) |

#### Response (JSON)
```json
{
  "success": true,
  "data": {
    "answer": "Troika Tech offers several advantages...",
    "sessionId": "sess_1234567890_abc",
    "intelligenceLevel": "EXPLICIT",
    "intent": {
      "category": "competitive",
      "intelligenceLevel": "EXPLICIT",
      "keyword": "better than",
      "confidence": 0.85
    },
    "transcription": {
      "text": "How is Troika Tech better than Yellow.ai?",
      "language": "en",
      "confidence": "high"
    },
    "intelligenceUsed": 3,
    "citations": [...],
    "audio": "data:audio/mpeg;base64,...",
    "processedText": "Troika Tech offers several advantages..."
  }
}
```

---

### 3. Intelligence Search

**Endpoint:** `POST /api/troika/intelligence/search`

Direct semantic search on market intelligence database.

#### Request Body (JSON)
```json
{
  "query": "AI chatbot trends",
  "filters": {
    "types": ["industry_news", "tech_update"],
    "services": ["Supa Agent"],
    "industries": ["Real Estate", "Retail"],
    "minRelevanceScore": 0.7,
    "maxAgeDays": 30
  },
  "limit": 10
}
```

#### Response (JSON)
```json
{
  "success": true,
  "data": {
    "total": 5,
    "vectorCount": 3,
    "keywordCount": 2,
    "results": [
      {
        "_id": "68e796127eb5981fa7a431a8",
        "type": "industry_news",
        "source": "TechCrunch",
        "sourceUrl": "https://...",
        "title": "AI Chatbots Transform Customer Service",
        "summary": "...",
        "keyTakeaways": ["...", "..."],
        "relevantServices": ["Supa Agent"],
        "relevantIndustries": ["Retail"],
        "relevanceScore": 0.85,
        "scrapedAt": "2025-10-09T10:30:00Z",
        "searchScore": 0.92
      }
    ]
  }
}
```

---

### 4. Statistics

**Endpoint:** `GET /api/troika/intelligence/stats`

Get statistics about market intelligence database.

#### Response (JSON)
```json
{
  "success": true,
  "data": {
    "overview": {
      "total": 150,
      "scraped": 10,
      "summarized": 20,
      "embedded": 120
    },
    "byType": {
      "competitor": 45,
      "news": 60,
      "tech": 30,
      "trend": 15
    },
    "embedding": {
      "total": 150,
      "embedded": 120,
      "summarized": 20,
      "scraped": 10,
      "pendingEmbedding": 20
    },
    "vectorSearch": {
      "exists": true,
      "ready": true,
      "status": "READY",
      "name": "market_intelligence_vector_index",
      "type": "vectorSearch"
    },
    "latest": [...]
  }
}
```

---

## Features

### Intelligence Levels

The system automatically detects query intent and applies appropriate intelligence levels:

| Level | Category | Description | Example Query |
|-------|----------|-------------|---------------|
| **NONE** | FAQ | Direct answers from KB, no market intelligence | "What is your phone number?" |
| **SUBTLE** | Service Inquiry | Light market context | "How can you help my business?" |
| **DATA_POINTS** | Industry-Specific | Industry trends and data | "AI solutions for real estate?" |
| **EXPLICIT** | Competitive | Detailed competitive comparisons | "Compare with Yellow.ai" |
| **RECENT_UPDATES** | Technology | Latest tech trends and updates | "Latest AI chatbot trends?" |

### Session Management

- Sessions stored in Redis with 24-hour TTL
- Maintains last 10 conversation turns
- Enables follow-up questions: "yes", "tell me more", "why?", etc.
- Session ID format: `sess_{timestamp}_{random}`

### Voice Support

**Speech-to-Text (STT):**
- Powered by OpenAI Whisper
- Supports 50+ languages
- Automatic language detection
- Confidence scoring

**Text-to-Speech (TTS):**
- Powered by Google Cloud TTS
- Natural HD voices (Chirp3-HD)
- Multi-language support (English, Hindi, etc.)
- Automatic text cleaning (markdown, HTML, emojis)

---

## Examples

### Example 1: Simple Text Query

```bash
curl -X POST http://localhost:5000/api/troika/intelligent-chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What services does Troika Tech offer?"
  }'
```

### Example 2: Text Query with TTS

```bash
curl -X POST http://localhost:5000/api/troika/intelligent-chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How can Troika Tech help my real estate business?",
    "context": {
      "industry": "Real Estate"
    },
    "enableTTS": true
  }'
```

### Example 3: Voice Query

```bash
curl -X POST http://localhost:5000/api/troika/intelligent-chat/voice \
  -F "audio=@question.mp3" \
  -F "sessionId=sess_123456" \
  -F "enableTTS=true"
```

### Example 4: Follow-up Conversation

```bash
# First query
curl -X POST http://localhost:5000/api/troika/intelligent-chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is Supa Agent?"
  }'

# Response includes sessionId: "sess_1234567890_abc"

# Follow-up query (using the sessionId)
curl -X POST http://localhost:5000/api/troika/intelligent-chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Tell me more about its features",
    "sessionId": "sess_1234567890_abc"
  }'
```

### Example 5: Competitive Query

```bash
curl -X POST http://localhost:5000/api/troika/intelligent-chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How does Troika Tech compare with Wix for AI websites?",
    "context": {
      "services": ["AI Websites"]
    }
  }'
```

### Example 6: Search Intelligence Database

```bash
curl -X POST http://localhost:5000/api/troika/intelligent-chat/intelligence/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "WhatsApp marketing automation",
    "filters": {
      "types": ["competitor", "industry_news"],
      "minRelevanceScore": 0.6
    },
    "limit": 5
  }'
```

---

## Error Responses

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error (development only)"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (missing/invalid parameters)
- `500` - Internal Server Error

---

## Rate Limiting

- General API: 100 requests/minute
- Voice endpoints: 30 requests/minute

---

## Notes

1. **OpenAI API Key Required** for Whisper STT and GPT-4 responses
2. **Google Cloud Credentials Required** for TTS
3. **MongoDB Atlas M10+** required for vector search
4. **Redis** required for session management
5. Audio responses are returned as base64-encoded data URLs

---

## Quick Start Testing

```bash
# 1. Seed intents
npm run intelligence:seed

# 2. Run scraping
npm run intelligence:scrape:all

# 3. Create vector index
npm run db:intelligence:vector

# 4. Start server
npm run dev

# 5. Test API (in another terminal)
npm run intelligence:test:api
```
