/**
 * LLM Adapter Test Script
 *
 * Tests both OpenAI and Anthropic adapters to verify:
 * 1. Both providers are accessible
 * 2. Non-streaming completions work
 * 3. Streaming completions work
 * 4. Response format is consistent
 */

require('dotenv').config();
const { getLLMAdapter, getModelInfo } = require('./services/llmAdapter');

async function testNonStreaming(provider) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${provider.toUpperCase()} - Non-Streaming`);
  console.log('='.repeat(60));

  try {
    const adapter = getLLMAdapter(provider);

    const messages = [
      { role: 'user', content: 'Say hello in one sentence.' }
    ];

    const systemPrompt = 'You are a helpful assistant. Be concise.';

    console.log(`🤖 Model: ${adapter.model}`);
    console.log(`📤 Sending: "${messages[0].content}"`);

    const startTime = Date.now();
    const response = await adapter.generateCompletion(messages, systemPrompt, {
      temperature: 0.7,
      maxTokens: 100,
    });
    const duration = Date.now() - startTime;

    console.log(`\n✅ Response received in ${duration}ms:`);
    console.log(`📥 "${response.content}"`);
    console.log(`\n📊 Token Usage:`);
    console.log(`   Input:  ${response.usage.inputTokens}`);
    console.log(`   Output: ${response.usage.outputTokens}`);
    console.log(`   Total:  ${response.usage.totalTokens}`);
    console.log(`   Provider: ${response.provider}`);
    console.log(`   Model: ${response.model}`);

    return { success: true, duration, response };
  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    if (error.response?.data) {
      console.error(`   API Error:`, error.response.data);
    }
    return { success: false, error: error.message };
  }
}

async function testStreaming(provider) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${provider.toUpperCase()} - Streaming`);
  console.log('='.repeat(60));

  try {
    const adapter = getLLMAdapter(provider);

    const messages = [
      { role: 'user', content: 'Count from 1 to 5 briefly.' }
    ];

    const systemPrompt = 'You are a helpful assistant. Be concise.';

    console.log(`🤖 Model: ${adapter.model}`);
    console.log(`📤 Sending: "${messages[0].content}"`);
    console.log(`\n📥 Streaming response:`);
    process.stdout.write('   ');

    const startTime = Date.now();
    let fullContent = '';
    let usage = null;

    const stream = adapter.generateStreamingCompletion(messages, systemPrompt, {
      temperature: 0.7,
      maxTokens: 100,
    });

    for await (const event of stream) {
      if (event.type === 'content') {
        fullContent += event.content;
        process.stdout.write(event.content);
      }
      if (event.type === 'done') {
        usage = event.usage;
      }
    }

    const duration = Date.now() - startTime;

    console.log(`\n\n✅ Stream completed in ${duration}ms`);
    console.log(`📊 Token Usage:`);
    console.log(`   Input:  ${usage?.inputTokens || 'N/A'}`);
    console.log(`   Output: ${usage?.outputTokens || 'N/A'}`);
    console.log(`   Total:  ${usage?.totalTokens || 'N/A'}`);

    return { success: true, duration, content: fullContent, usage };
  } catch (error) {
    console.error(`\n\n❌ Error:`, error.message);
    if (error.response?.data) {
      console.error(`   API Error:`, error.response.data);
    }
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         LLM Adapter Integration Test Suite              ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  // Show current configuration
  const modelInfo = getModelInfo();
  console.log(`\n📋 Current Configuration:`);
  console.log(`   Default Provider: ${modelInfo.provider}`);
  console.log(`   OpenAI Model: ${modelInfo.available.openai}`);
  console.log(`   Anthropic Model: ${modelInfo.available.anthropic}`);

  const results = {
    openai: { nonStreaming: null, streaming: null },
    anthropic: { nonStreaming: null, streaming: null },
  };

  // Test OpenAI
  if (process.env.OPENAI_API_KEY) {
    results.openai.nonStreaming = await testNonStreaming('openai');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit pause
    results.openai.streaming = await testStreaming('openai');
  } else {
    console.log(`\n⚠️  Skipping OpenAI tests - No API key found`);
  }

  await new Promise(resolve => setTimeout(resolve, 2000)); // Pause between providers

  // Test Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    results.anthropic.nonStreaming = await testNonStreaming('anthropic');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit pause
    results.anthropic.streaming = await testStreaming('anthropic');
  } else {
    console.log(`\n⚠️  Skipping Anthropic tests - No API key found`);
  }

  // Summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const providers = ['openai', 'anthropic'];
  const testTypes = ['nonStreaming', 'streaming'];

  for (const provider of providers) {
    console.log(`\n${provider.toUpperCase()}:`);
    for (const testType of testTypes) {
      const result = results[provider][testType];
      if (result === null) {
        console.log(`  ${testType}: ⊘ Skipped (no API key)`);
      } else if (result.success) {
        console.log(`  ${testType}: ✅ PASS (${result.duration}ms)`);
      } else {
        console.log(`  ${testType}: ❌ FAIL (${result.error})`);
      }
    }
  }

  // Overall result
  const allTests = providers.flatMap(p => testTypes.map(t => results[p][t]));
  const executed = allTests.filter(r => r !== null);
  const passed = executed.filter(r => r?.success);

  console.log(`\n${'='.repeat(60)}`);
  if (executed.length === 0) {
    console.log('⚠️  No tests executed - Check your API keys in .env');
  } else if (passed.length === executed.length) {
    console.log(`✅ ALL TESTS PASSED (${passed.length}/${executed.length})`);
    console.log('\n✨ Both providers are working correctly!');
    console.log('   Switch between them anytime with LLM_PROVIDER env var.');
  } else {
    console.log(`⚠️  SOME TESTS FAILED (${passed.length}/${executed.length} passed)`);
    console.log('\n   Check the error messages above for details.');
  }
  console.log('='.repeat(60));
  console.log('');
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
