#!/usr/bin/env node

/**
 * Script to check what's in the knowledge base for a specific chatbot
 * 
 * Usage:
 * node scripts/check-knowledge-base.js
 */

const mongoose = require('mongoose');
const Embedding = require('../models/Embedding');

// Set API key directly for testing (REMOVE AFTER TESTING)
process.env.OPENAI_API_KEY = 'sk-proj-your-api-key-here'; // Replace with your actual API key

const TEST_CHATBOT_ID = '688068d45ba526540d784b24';

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://troika_pratik_2001:uAo1a8UND6sO2J3u@chatbot.tgmlyji.mongodb.net/?retryWrites=true&w=majority&appName=chatbot');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

async function checkKnowledgeBase(chatbotId) {
  console.log(`\n🔍 Checking knowledge base for chatbot: ${chatbotId}`);
  console.log('=' .repeat(60));
  
  try {
    // Get all embeddings for this chatbot
    const embeddings = await Embedding.find({ chatbot_id: chatbotId })
      .sort({ createdAt: -1 })
      .lean();
    
    console.log(`\n📊 Knowledge Base Statistics:`);
    console.log(`   Total chunks: ${embeddings.length}`);
    
    if (embeddings.length === 0) {
      console.log('\n❌ No knowledge base chunks found for this chatbot!');
      console.log('   This explains why no chunks are being retrieved.');
      console.log('   You need to add content to the knowledge base first.');
      return;
    }
    
    // Show recent chunks
    console.log(`\n📄 Recent chunks (last 10):`);
    embeddings.slice(0, 10).forEach((chunk, index) => {
      console.log(`\n[${index + 1}] Chunk ID: ${chunk._id}`);
      console.log(`    Length: ${chunk.content?.length || 0} characters`);
      console.log(`    Has embedding: ${chunk.embedding ? 'Yes' : 'No'}`);
      console.log(`    Embedding length: ${chunk.embedding?.length || 0} dimensions`);
      console.log(`    Content preview: ${chunk.content?.substring(0, 150)}${chunk.content?.length > 150 ? '...' : ''}`);
      console.log(`    Created: ${chunk.createdAt || 'Unknown'}`);
      console.log('-'.repeat(50));
    });
    
    // Check for chunks with embeddings
    const chunksWithEmbeddings = embeddings.filter(chunk => chunk.embedding && chunk.embedding.length > 0);
    console.log(`\n📈 Embedding Statistics:`);
    console.log(`   Chunks with embeddings: ${chunksWithEmbeddings.length}/${embeddings.length}`);
    console.log(`   Embedding dimension: ${chunksWithEmbeddings[0]?.embedding?.length || 'N/A'}`);
    
    // Check content types
    const contentTypes = {};
    embeddings.forEach(chunk => {
      const preview = chunk.content?.substring(0, 50).toLowerCase() || '';
      if (preview.includes('whatsapp')) contentTypes.whatsapp = (contentTypes.whatsapp || 0) + 1;
      if (preview.includes('marketing')) contentTypes.marketing = (contentTypes.marketing || 0) + 1;
      if (preview.includes('price')) contentTypes.price = (contentTypes.price || 0) + 1;
      if (preview.includes('product')) contentTypes.product = (contentTypes.product || 0) + 1;
      if (preview.includes('service')) contentTypes.service = (contentTypes.service || 0) + 1;
    });
    
    console.log(`\n🏷️  Content Categories:`);
    Object.entries(contentTypes).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} chunks`);
    });
    
    // Test a simple search
    console.log(`\n🧪 Testing search for "whatsapp marketing price":`);
    const { retrieveRelevantChunks } = require('../services/queryService');
    
    try {
      const results = await retrieveRelevantChunks('whatsapp marketing price', chatbotId, 5, 0.3); // Lower threshold for testing
      console.log(`   Found ${results.length} relevant chunks`);
      
      if (results.length > 0) {
        results.forEach((chunk, index) => {
          console.log(`   [${index + 1}] Score: ${chunk.score?.toFixed(3) || 'N/A'}`);
          console.log(`       Content: ${chunk.content?.substring(0, 100)}${chunk.content?.length > 100 ? '...' : ''}`);
        });
      } else {
        console.log('   No chunks found - this might be due to:');
        console.log('   - No relevant content in knowledge base');
        console.log('   - Embedding generation issues');
        console.log('   - Vector search configuration problems');
      }
    } catch (error) {
      console.log(`   ❌ Search failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`❌ Error checking knowledge base: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 Knowledge Base Checker');
  console.log('=========================');
  
  await connectToDatabase();
  await checkKnowledgeBase(TEST_CHATBOT_ID);
  
  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

if (require.main === module) {
  main().catch(error => {
    console.error('💥 Check failed:', error);
    process.exit(1);
  });
}

module.exports = { checkKnowledgeBase };
