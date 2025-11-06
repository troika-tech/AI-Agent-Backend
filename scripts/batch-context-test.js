#!/usr/bin/env node

/**
 * Batch test script for knowledge base retrieval
 * Tests multiple queries and generates a detailed report
 * 
 * Usage:
 * node scripts/batch-context-test.js
 * 
 * Or with custom queries:
 * node scripts/batch-context-test.js "query1" "query2" "query3"
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { retrieveRelevantChunks } = require('../services/queryService');
const Chatbot = require('../models/Chatbot');
const Message = require('../models/Message');

// Set API key directly for testing (REMOVE AFTER TESTING)
process.env.OPENAI_API_KEY = 'sk-proj-your-api-key-here'; // Replace with your actual API key

// Test queries
const DEFAULT_QUERIES = [
  "What products do you have?",
  "How much does shipping cost?",
  "What is your return policy?",
  "Do you have customer support?",
  "What are your business hours?",
  "How can I track my order?",
  "What payment methods do you accept?",
  "Do you offer international shipping?",
  "What is your warranty policy?",
  "How do I create an account?"
];

const TEST_CHATBOT_ID = process.env.TEST_CHATBOT_ID || '507f1f77bcf86cd799439011';

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function testSingleQuery(query, chatbotId) {
  const startTime = Date.now();
  
  try {
    // Retrieve chunks
    const chunks = await retrieveRelevantChunks(query, chatbotId, 5, 0.7);
    const retrievalTime = Date.now() - startTime;
    
    // Get chatbot info
    const chatbot = await Chatbot.findById(chatbotId).lean();
    
    // Get recent history
    const recentMessages = await Message.find({ chatbot_id: chatbotId })
      .sort({ timestamp: -1 })
      .limit(3)
      .lean();
    
    // Build context
    const contextChunks = chunks.map(chunk => chunk.content).filter(content => content && content.trim().length > 20);
    const context = contextChunks.join("\n---\n");
    
    // Build history context
    const historyContext = recentMessages.reverse().map((msg) => ({
      role: msg.sender === "user" ? "user" : "bot",
      content: msg.content,
    }));
    
    // Build system prompt
    const systemPrompt = `${chatbot?.persona_text || 'Default persona'}

--- CONTEXT FROM KNOWLEDGE BASE ---
${context}
`;
    
    // Build messages array
    const messages = [
      { role: "system", content: systemPrompt },
      ...historyContext,
      { role: "user", content: query },
    ];
    
    return {
      success: true,
      query,
      retrievalTime,
      chunks: chunks.map(chunk => ({
        content: chunk.content,
        score: chunk.score,
        length: chunk.content?.length || 0
      })),
      contextLength: context.length,
      systemPromptLength: systemPrompt.length,
      totalMessagesCount: messages.length,
      hasCustomPersona: !!chatbot?.persona_text,
      historyMessagesCount: historyContext.length,
      averageChunkScore: chunks.length > 0 ? chunks.reduce((sum, chunk) => sum + (chunk.score || 0), 0) / chunks.length : 0,
      totalContextLength: messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0)
    };
    
  } catch (error) {
    return {
      success: false,
      query,
      error: error.message,
      retrievalTime: Date.now() - startTime
    };
  }
}

async function runBatchTest() {
  console.log('🧪 Batch Context Test Suite');
  console.log('============================');
  
  await connectToDatabase();
  
  // Get queries from command line or use defaults
  const queries = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_QUERIES;
  
  console.log(`\n📝 Testing ${queries.length} queries with chatbot ID: ${TEST_CHATBOT_ID}`);
  console.log('Queries:', queries);
  
  const results = [];
  const startTime = Date.now();
  
  // Run tests
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    console.log(`\n[${i + 1}/${queries.length}] Testing: "${query}"`);
    
    const result = await testSingleQuery(query, TEST_CHATBOT_ID);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ Success - ${result.chunks.length} chunks, ${result.retrievalTime}ms`);
    } else {
      console.log(`❌ Failed - ${result.error}`);
    }
    
    // Small delay between tests
    if (i < queries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  const totalTime = Date.now() - startTime;
  
  // Generate report
  console.log('\n📊 Test Report');
  console.log('==============');
  
  const successfulTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);
  
  console.log(`\n📈 Summary:`);
  console.log(`   Total tests: ${results.length}`);
  console.log(`   Successful: ${successfulTests.length}`);
  console.log(`   Failed: ${failedTests.length}`);
  console.log(`   Total time: ${totalTime}ms`);
  console.log(`   Average time per test: ${Math.round(totalTime / results.length)}ms`);
  
  if (successfulTests.length > 0) {
    const avgChunks = successfulTests.reduce((sum, r) => sum + r.chunks.length, 0) / successfulTests.length;
    const avgContextLength = successfulTests.reduce((sum, r) => sum + r.contextLength, 0) / successfulTests.length;
    const avgRetrievalTime = successfulTests.reduce((sum, r) => sum + r.retrievalTime, 0) / successfulTests.length;
    const avgChunkScore = successfulTests.reduce((sum, r) => sum + r.averageChunkScore, 0) / successfulTests.length;
    
    console.log(`\n📊 Successful Tests Statistics:`);
    console.log(`   Average chunks per query: ${avgChunks.toFixed(2)}`);
    console.log(`   Average context length: ${Math.round(avgContextLength)} characters`);
    console.log(`   Average retrieval time: ${Math.round(avgRetrievalTime)}ms`);
    console.log(`   Average chunk relevance score: ${avgChunkScore.toFixed(3)}`);
  }
  
  // Detailed results
  console.log(`\n📋 Detailed Results:`);
  results.forEach((result, index) => {
    console.log(`\n[${index + 1}] Query: "${result.query}"`);
    if (result.success) {
      console.log(`   ✅ Success`);
      console.log(`   📚 Chunks: ${result.chunks.length}`);
      console.log(`   ⏱️  Retrieval time: ${result.retrievalTime}ms`);
      console.log(`   📏 Context length: ${result.contextLength} chars`);
      console.log(`   🎭 System prompt length: ${result.systemPromptLength} chars`);
      console.log(`   💬 Total messages: ${result.totalMessagesCount}`);
      console.log(`   🤖 Custom persona: ${result.hasCustomPersona ? 'Yes' : 'No'}`);
      console.log(`   📜 History messages: ${result.historyMessagesCount}`);
      console.log(`   🎯 Average chunk score: ${result.averageChunkScore.toFixed(3)}`);
      
      if (result.chunks.length > 0) {
        console.log(`   📄 Chunk details:`);
        result.chunks.forEach((chunk, i) => {
          console.log(`      ${i + 1}. Score: ${chunk.score?.toFixed(3) || 'N/A'}, Length: ${chunk.length} chars`);
          console.log(`         Preview: ${chunk.content.substring(0, 100)}${chunk.content.length > 100 ? '...' : ''}`);
        });
      }
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      console.log(`   ⏱️  Time: ${result.retrievalTime}ms`);
    }
  });
  
  // Save detailed report to file
  const reportData = {
    timestamp: new Date().toISOString(),
    chatbotId: TEST_CHATBOT_ID,
    totalTests: results.length,
    successfulTests: successfulTests.length,
    failedTests: failedTests.length,
    totalTime,
    averageTimePerTest: Math.round(totalTime / results.length),
    statistics: successfulTests.length > 0 ? {
      averageChunks: successfulTests.reduce((sum, r) => sum + r.chunks.length, 0) / successfulTests.length,
      averageContextLength: successfulTests.reduce((sum, r) => sum + r.contextLength, 0) / successfulTests.length,
      averageRetrievalTime: successfulTests.reduce((sum, r) => sum + r.retrievalTime, 0) / successfulTests.length,
      averageChunkScore: successfulTests.reduce((sum, r) => sum + r.averageChunkScore, 0) / successfulTests.length
    } : null,
    results
  };
  
  const reportPath = path.join(__dirname, '..', 'test-reports', `context-test-${Date.now()}.json`);
  const reportDir = path.dirname(reportPath);
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
  console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  
  // Recommendations
  console.log(`\n💡 Recommendations:`);
  if (failedTests.length > 0) {
    console.log(`   - Fix ${failedTests.length} failed queries`);
  }
  if (successfulTests.some(r => r.chunks.length === 0)) {
    console.log(`   - Some queries returned no chunks - check knowledge base content`);
  }
  if (successfulTests.some(r => r.averageChunkScore < 0.5)) {
    console.log(`   - Some queries have low relevance scores - improve knowledge base or query processing`);
  }
  if (successfulTests.some(r => r.contextLength < 100)) {
    console.log(`   - Some queries have very short context - check chunk retrieval`);
  }
  
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

// Handle command line usage
if (require.main === module) {
  runBatchTest().catch(error => {
    console.error('💥 Batch test failed:', error);
    process.exit(1);
  });
}

module.exports = { testSingleQuery, runBatchTest };
