# Knowledge Base Testing Scripts

This directory contains scripts to test knowledge base retrieval and LLM context building.

## Scripts Overview

### 1. `quick-context-test.js` - Interactive Testing
**Best for**: Quick testing and debugging individual queries

```bash
node scripts/quick-context-test.js
```

**Features:**
- Interactive command-line interface
- Test queries one by one
- Shows complete context and messages array
- Real-time feedback

**Usage:**
1. Run the script
2. Enter queries interactively
3. Type "exit" to quit

### 2. `test-knowledge-base-retrieval.js` - Comprehensive Testing
**Best for**: Detailed analysis of specific queries

```bash
# Test with default queries
node scripts/test-knowledge-base-retrieval.js

# Test with specific query
node scripts/test-knowledge-base-retrieval.js "What products do you have?"
```

**Features:**
- Step-by-step analysis
- Complete context breakdown
- LLM input structure display
- Optional actual LLM call testing

### 3. `batch-context-test.js` - Batch Testing
**Best for**: Testing multiple queries and generating reports

```bash
# Test with default queries
node scripts/batch-context-test.js

# Test with custom queries
node scripts/batch-context-test.js "query1" "query2" "query3"
```

**Features:**
- Tests multiple queries automatically
- Generates detailed reports
- Performance statistics
- Saves results to JSON file

## Configuration

### Environment Variables
Set these before running the scripts:

```bash
export MONGODB_URI="mongodb://localhost:27017/your-database"
export TEST_CHATBOT_ID="your-actual-chatbot-id"
```

### Customizing Test Queries
Edit `test-config.js` to add your own test queries:

```javascript
testQueries: [
  "What products do you have?",
  "How much does shipping cost?",
  // Add your queries here
]
```

## What Each Script Tests

### 1. Knowledge Base Retrieval
- ✅ Chunk retrieval from vector database
- ✅ Relevance scoring
- ✅ Chunk content quality
- ✅ Retrieval performance

### 2. Context Building
- ✅ Context chunk processing
- ✅ History message handling
- ✅ System prompt construction
- ✅ Message array assembly

### 3. LLM Input Structure
- ✅ Complete messages array
- ✅ Role assignments
- ✅ Content formatting
- ✅ Token counting

## Sample Output

### Quick Test Output
```
🔍 Testing: "What products do you have?"
============================================================

📚 Retrieving knowledge base chunks...
✅ Found 3 chunks:

📄 Chunk 1 (Score: 0.856):
Our company offers a wide range of products including electronics, clothing, and home goods...
--------------------------------------------------

📄 Chunk 2 (Score: 0.743):
Product categories include smartphones, laptops, tablets, and accessories...
--------------------------------------------------

🤖 Chatbot: My Company Bot
   Custom persona: Yes

🔧 Context built (1247 chars):
Our company offers a wide range of products including electronics, clothing, and home goods...
---
Product categories include smartphones, laptops, tablets, and accessories...
---
We have over 1000 products in stock with competitive pricing...

🎭 System prompt (2156 chars):
You are a helpful customer service representative for My Company...
--- CONTEXT FROM KNOWLEDGE BASE ---
Our company offers a wide range of products including electronics, clothing, and home goods...
---
Product categories include smartphones, laptops, tablets, and accessories...
---
We have over 1000 products in stock with competitive pricing...

📋 Complete messages array (4 messages):

[1] SYSTEM:
You are a helpful customer service representative for My Company...
--- CONTEXT FROM KNOWLEDGE BASE ---
Our company offers a wide range of products including electronics, clothing, and home goods...
---
Product categories include smartphones, laptops, tablets, and accessories...
---
We have over 1000 products in stock with competitive pricing...
------------------------------

[2] USER:
What products do you have?
------------------------------

✅ Test completed!
```

### Batch Test Report
```
📊 Test Report
==============

📈 Summary:
   Total tests: 10
   Successful: 9
   Failed: 1
   Total time: 3247ms
   Average time per test: 325ms

📊 Successful Tests Statistics:
   Average chunks per query: 3.2
   Average context length: 1247 characters
   Average retrieval time: 245ms
   Average chunk relevance score: 0.756

💾 Detailed report saved to: test-reports/context-test-1703123456789.json
```

## Troubleshooting

### Common Issues

1. **No chunks retrieved**
   - Check if knowledge base has content
   - Verify chatbot ID is correct
   - Check similarity threshold settings

2. **Low relevance scores**
   - Improve knowledge base content
   - Adjust similarity threshold
   - Check query processing

3. **Database connection errors**
   - Verify MongoDB URI
   - Check database accessibility
   - Ensure proper authentication

4. **Empty context**
   - Check chunk content quality
   - Verify filtering logic
   - Review context building process

### Debug Tips

1. **Use quick test first** to debug individual queries
2. **Check the detailed report** for patterns in failures
3. **Verify chatbot configuration** in the database
4. **Test with simple queries** before complex ones
5. **Monitor performance metrics** for optimization

## Integration with Logging

These scripts work with your existing logging system. The context logging we added earlier will show up in your application logs when running the actual chatbot, while these test scripts provide detailed analysis for development and debugging.

## Next Steps

1. **Run quick test** to verify basic functionality
2. **Customize test queries** for your specific use case
3. **Run batch test** to get comprehensive analysis
4. **Review reports** to identify improvement areas
5. **Iterate and improve** based on test results
