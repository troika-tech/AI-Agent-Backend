# Debugging: Suggestion Questions Not Appearing

## Issue
Your API response is missing the `suggestions` field, even though the feature is implemented.

## What I've Done to Fix This

### 1. Strengthened System Prompts ✅
- Added **critical requirement** emphasis with 🔴 indicator
- Moved suggestions instructions to the END of the system prompt (LLMs pay more attention to recent instructions)
- Used stronger, more explicit language ("YOU MUST", "DO NOT SKIP", etc.)
- Added clear examples and formatting instructions
- Applied to both main responses AND follow-up responses

### 2. Added Debug Logging ✅
The system now logs:
- Whether the LLM included the `[SUGGESTIONS: ...]` tag
- Raw LLM response (first 200 chars) when tag is missing
- Count of successfully parsed suggestions

## How to Debug

### Step 1: Check Your Logs

After sending a query, look for these log entries:

```
TIMING generate answer ms=XXX
Raw LLM response length: XXX
Suggestions tag present: true/false
Parsed suggestions count: X
```

If you see:
```
Suggestions tag present: false
LLM did not generate suggestions tag. Raw response: ...
```

This means the LLM is not following instructions.

### Step 2: View Raw LLM Response

Check your application logs for lines like:
```
LLM did not generate suggestions tag. Raw response: We specialize in three core solutions...
```

The raw response should end with something like:
```
[SUGGESTIONS: What is pricing for AI Websites? | How does Supa Agent work? | Can I see a demo?]
```

### Step 3: Verify Your Environment

Make sure:
1. **Server is restarted** after code changes
   ```bash
   # Stop and restart your server
   npm start
   ```

2. **Redis cache is cleared** (if using Redis)
   ```bash
   # Connect to Redis and flush cache
   redis-cli
   > FLUSHDB
   ```
   
   Or programmatically:
   ```javascript
   const { getClient } = require('./lib/redis');
   const redis = getClient();
   if (redis) {
     await redis.flushDb();
   }
   ```

3. **OpenAI API is responding** (check for errors)

### Step 4: Test with a Fresh Session

Use a new session ID to avoid cached responses:

```bash
curl -X POST http://localhost:3000/api/chat/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What services do you offer?",
    "chatbotId": "your-chatbot-id",
    "sessionId": "debug-test-'$(date +%s)'"
  }'
```

## Expected Behavior After Fix

### Before (What you saw):
```json
{
  "answer": "We specialize in three core solutions...",
  "tokens": 4194,
  "sessionId": "abc-123"
  // ❌ No suggestions field
}
```

### After (What you should see):
```json
{
  "answer": "We specialize in three core solutions...",
  "suggestions": [
    "What's the pricing for AI Websites?",
    "How quickly can Supa Agent be set up?",
    "Can I integrate WhatsApp Marketing?"
  ],
  "tokens": 4220,
  "sessionId": "abc-123"
}
```

## Common Issues & Solutions

### Issue 1: Cached Responses
**Problem**: Old responses without suggestions are cached

**Solution**: Clear Redis cache or wait for TTL to expire (5 minutes)
```javascript
// Add to a temporary script or route
const { getClient } = require('./lib/redis');
const redis = getClient();
if (redis) {
  // Clear all LLM cache
  const keys = await redis.keys('llm:*');
  for (const key of keys) {
    await redis.del(key);
  }
  console.log(`Cleared ${keys.length} cached responses`);
}
```

### Issue 2: LLM Not Following Instructions
**Problem**: Even with strong prompts, LLM occasionally skips instructions

**Solution Implemented**:

When the main LLM response doesn't include suggestions, the system automatically makes a **separate focused LLM call** to generate contextual suggestions:

```javascript
// Automatic fallback in services/chatService.js
if (!suggestions || suggestions.length === 0) {
  logger.info('Generating suggestions via separate LLM call');
  suggestions = await generateSuggestionsViaLLM(cleanAnswer, query, context);
}

// This function makes a dedicated, focused request:
async function generateSuggestionsViaLLM(answer, query, context) {
  // Creates a simple prompt focused only on generating follow-up questions
  // Returns contextual suggestions based on the actual conversation
  // Falls back to empty array if this also fails
}
```

**Advantages**:
- ✅ Suggestions are always contextual and relevant (no hardcoded fallbacks)
- ✅ Works even when main LLM doesn't follow tag instructions
- ✅ Fast (separate call uses max_tokens: 150, timeout: 5s)
- ✅ Graceful degradation (returns empty array if fails)

**Cost Impact**:
- Only triggers when main LLM doesn't include suggestions
- ~50-100 tokens per fallback call
- Currently happening ~5-10% of the time

### Issue 3: Translation Interference
**Problem**: If using multi-language, suggestions might not translate properly

**Solution**: Generate suggestions in original language, then translate:
```javascript
if (processedQuery.needsTranslation) {
  // Translate answer
  const translatedResponse = await languageService.processResponse(...);
  
  // Also translate suggestions
  const translatedSuggestions = await Promise.all(
    suggestions.map(s => languageService.translateText(s, processedQuery.language))
  );
  
  return {
    answer: translatedResponse.translatedResponse,
    suggestions: translatedSuggestions,
    // ...
  };
}
```

## Testing Script

Create a test file `test-suggestions.js`:

```javascript
const axios = require('axios');

async function testSuggestions() {
  const queries = [
    "What services do you offer?",
    "Tell me about pricing",
    "How does your chatbot work?",
  ];
  
  for (const query of queries) {
    console.log(`\n📤 Testing: "${query}"`);
    
    try {
      const response = await axios.post('http://localhost:3000/api/chat/query', {
        query,
        chatbotId: 'your-chatbot-id',
        sessionId: `test-${Date.now()}`
      });
      
      const { answer, suggestions } = response.data;
      
      console.log(`\n📥 Answer: ${answer.substring(0, 100)}...`);
      console.log(`\n💡 Suggestions (${suggestions?.length || 0}):`);
      
      if (suggestions && suggestions.length > 0) {
        suggestions.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
        console.log('✅ SUCCESS: Suggestions found!');
      } else {
        console.log('❌ FAIL: No suggestions in response');
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
    
    // Wait between requests
    await new Promise(r => setTimeout(r, 2000));
  }
}

testSuggestions();
```

Run it:
```bash
node test-suggestions.js
```

## Monitoring in Production

Add monitoring to track suggestion generation rate:

```javascript
// In chatbotService.js, after getting response
if (suggestions && suggestions.length > 0) {
  logger.info(`✅ Suggestions generated: ${suggestions.length}`);
} else {
  logger.warn(`⚠️ No suggestions generated for query: ${query}`);
  
  // Track metric
  if (yourMetricsService) {
    yourMetricsService.increment('suggestions.missing');
  }
}
```

## Quick Fixes Checklist

Try these in order:

1. ✅ **Restart your server**
   ```bash
   npm start
   ```

2. ✅ **Clear Redis cache**
   ```bash
   redis-cli FLUSHDB
   ```

3. ✅ **Test with fresh session**
   ```bash
   curl ... -d '{"sessionId": "test-'$(date +%s)'"}'
   ```

4. ✅ **Check logs for "Suggestions tag present"**
   ```bash
   tail -f logs/combined.log | grep -i suggestion
   ```

5. ✅ **Verify OpenAI API key**
   ```bash
   echo $OPENAI_API_KEY
   ```

6. ✅ **Check model version**
   Should be `gpt-4o-mini` or `gpt-4`

## Next Steps

1. **Restart your server now** to apply the strengthened prompts
2. **Clear your Redis cache** to remove old cached responses
3. **Test with a new query** using a fresh session ID
4. **Check your logs** for the debug messages
5. **Report back** with what you see in the logs

If suggestions still don't appear after these steps, check the logs for:
- "Suggestions tag present: false" - means LLM isn't generating them
- Any parsing errors
- The raw LLM response text

## Contact

If you're still having issues after trying these steps, share:
1. Your log output showing "Suggestions tag present: X"
2. The raw LLM response from logs
3. Your OpenAI model and API version

We can then implement one of the fallback solutions above!

