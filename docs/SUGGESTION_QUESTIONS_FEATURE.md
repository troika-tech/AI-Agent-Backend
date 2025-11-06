# Dynamic Suggestion Questions Feature

## Overview
This feature automatically generates 2-3 relevant follow-up questions with each chatbot response, helping users continue their conversation naturally and discover related information.

## How It Works

### 1. LLM Generation
When the chatbot generates a response, it's instructed to also create 2-3 relevant follow-up questions based on:
- The content of the answer
- Available knowledge base context
- User's conversation history
- Product information (if applicable)

### 2. Format
The LLM embeds suggestions in the response using a special tag format:
```
[SUGGESTIONS: question1 | question2 | question3]
```

### 3. Parsing & Delivery
- The suggestion tag is extracted and removed from the visible answer
- Suggestions are parsed into an array
- Both the clean answer and suggestions are returned in the API response
- The original format (with tags) is preserved in chat history

## API Response Format

### Successful Response with Suggestions
```json
{
  "answer": "Our service offers three main features: automated responses, multi-language support, and analytics dashboard.",
  "suggestions": [
    "What languages are supported?",
    "How does the analytics dashboard work?",
    "What are the pricing plans?"
  ],
  "tokens": 150,
  "sessionId": "abc-123-def",
  "link": null,
  "audio": null,
  "requiresAuthNext": false,
  "auth_method": "email"
}
```

### Response without Suggestions
If the LLM doesn't generate suggestions or there's an error, the `suggestions` field will either be:
- Omitted from the response
- An empty array: `"suggestions": []`

## Implementation Details

### Files Modified

1. **services/chatService.js**
   - Added `extractSuggestions()` function to parse suggestion tags
   - Updated `prepareAssistantMessage()` to extract and return suggestions
   - Modified system prompts to instruct LLM to generate suggestions
   - Updated all return statements to include suggestions

2. **services/chatbotService.js**
   - Updated to receive suggestions from `generateAnswer()`
   - Added suggestions to response payload when available

### Key Functions

#### `extractSuggestions(text)`
Extracts suggestions from the special tag format:
- Matches pattern: `[SUGGESTIONS: ... ]`
- Splits by pipe (`|`) or semicolon (`;`)
- Filters out empty or overly long questions
- Returns maximum of 3 suggestions

#### `prepareAssistantMessage(rawText)`
Processes the raw LLM response:
- Extracts KBQ tags (for knowledge base follow-ups)
- Extracts suggestion questions
- Removes tags from the visible answer
- Preserves tags in history for context
- Returns: `{ cleanAnswer, assistantMessageForHistory, kbFollowUpQuery, suggestions }`

## Usage in Frontend

### Display Suggestions
The frontend can display these suggestions as clickable buttons/chips:

```javascript
// Example React component
function SuggestionButtons({ suggestions, onSuggestionClick }) {
  if (!suggestions || suggestions.length === 0) return null;
  
  return (
    <div className="suggestion-container">
      <p className="suggestion-label">You might also ask:</p>
      {suggestions.map((suggestion, index) => (
        <button 
          key={index}
          className="suggestion-button"
          onClick={() => onSuggestionClick(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
```

### Handle Suggestion Click
When a user clicks a suggestion, send it as a new query:

```javascript
const handleSuggestionClick = (question) => {
  // Send the clicked question as a new user query
  sendMessage(question);
};
```

## Customization

### Adjusting Number of Suggestions
To change the number of suggestions (default: 2-3), modify the system prompts in `services/chatService.js`:

```javascript
// Change from "2-3" to desired number
"SUGGESTION QUESTIONS:\n- At the end of your response, add 2-3 relevant follow-up questions..."
```

Also update the slice limit in `extractSuggestions()`:
```javascript
.slice(0, 3); // Change 3 to desired max
```

### Suggestion Quality Guidelines
The LLM is instructed to generate suggestions that are:
- **Specific**: Related directly to the current answer
- **Natural**: Phrased as questions users would actually ask
- **Concise**: Under 100 characters each
- **Relevant**: Help users explore related topics or get more specific information

## Examples

### Example 1: Product Query
**User:** "Tell me about your t-shirts"

**Response:**
```json
{
  "answer": "We have a wide selection of t-shirts available in various colors and sizes. Our most popular styles include crew neck, V-neck, and long sleeve options, with prices ranging from ₹500 to ₹1,500.",
  "suggestions": [
    "What colors are available?",
    "Do you have organic cotton options?",
    "What's the return policy?"
  ]
}
```

### Example 2: Service Information
**User:** "How does your service work?"

**Response:**
```json
{
  "answer": "Our service connects businesses with AI-powered chatbots that can handle customer inquiries 24/7. You simply integrate our widget on your website, train it with your knowledge base, and it starts responding to customers instantly.",
  "suggestions": [
    "How long does setup take?",
    "What integrations do you support?",
    "Can I customize the chatbot appearance?"
  ]
}
```

### Example 3: Follow-up Context
**User:** "Tell me more about pricing" (after asking about features)

**Response:**
```json
{
  "answer": "We offer three pricing tiers: Basic at ₹999/month for small businesses, Professional at ₹2,999/month with advanced features, and Enterprise with custom pricing for large organizations.",
  "suggestions": [
    "What's included in the Basic plan?",
    "Do you offer annual discounts?",
    "Can I upgrade my plan later?"
  ]
}
```

## Benefits

1. **Improved User Engagement**: Users are more likely to continue conversations
2. **Better Discovery**: Helps users find information they didn't know to ask about
3. **Natural Conversation Flow**: Guides users through related topics
4. **Reduced Friction**: Users don't need to think of what to ask next
5. **Contextual Guidance**: Suggestions are based on the current conversation

## Troubleshooting

### Suggestions Not Appearing
1. Check if the LLM is including the `[SUGGESTIONS: ...]` tag in responses
2. Verify the regex pattern matches the format
3. Check console logs for parsing errors
4. Ensure suggestions aren't filtered out due to length constraints

### Poor Quality Suggestions
1. Review and adjust the system prompt instructions
2. Ensure adequate knowledge base context is provided
3. Consider adjusting the temperature parameter in LLM calls
4. Review conversation history being passed to the LLM

### Performance Impact
- Generating suggestions adds minimal latency (same LLM call)
- No additional API calls required
- Suggestions are cached along with responses via existing cache mechanism

## Future Enhancements

Potential improvements to consider:
1. **Personalized Suggestions**: Based on user behavior and preferences
2. **A/B Testing**: Test different suggestion styles and quantities
3. **Analytics**: Track which suggestions users click most
4. **Context-Aware Filtering**: Remove irrelevant suggestions based on conversation state
5. **Multi-language Support**: Translate suggestions for non-English responses
6. **Structured Output**: Use OpenAI function calling for more reliable parsing

