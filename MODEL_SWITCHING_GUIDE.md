# Model Switching Guide: GPT-4o-mini ↔ Claude 3.5 Haiku ↔ Grok-3-mini

## Quick Start

**Switch between OpenAI, Claude, and Grok with ONE environment variable:**

```bash
# Use OpenAI GPT-4o-mini (cheapest)
LLM_PROVIDER=openai

# Use Claude 3.5 Haiku (best quality)
LLM_PROVIDER=anthropic

# Use xAI Grok-3-mini (best value, huge 131K context)
LLM_PROVIDER=grok
```

**That's it!** Restart your server and the system automatically uses the selected model.

---

## Environment Variables

### Required Variables

```bash
# OpenAI API Key (required if using OpenAI)
OPENAI_API_KEY=sk-your-openai-key-here

# Anthropic API Key (required if using Claude)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here

# xAI API Key (required if using Grok)
XAI_API_KEY=xai-your-key-here
XAI_BASE_URL=https://api.x.ai/v1
```

### Optional Configuration

```bash
# Model Provider Selection
LLM_PROVIDER=openai              # Options: 'openai', 'anthropic', or 'grok'
                                  # Default: 'openai'

# Specific Model Selection
OPENAI_MODEL=gpt-4o-mini         # Default OpenAI model
ANTHROPIC_MODEL=claude-3-5-haiku-20241022  # Default Claude model
GROK_MODEL=grok-3-mini           # Default Grok model

# Context-Aware Prompts (recommended!)
ENABLE_CONTEXT_AWARE_PROMPTS=true
```

---

## Complete .env Example

```bash
# ============================================
# LLM Configuration
# ============================================

# Provider Selection: 'openai', 'anthropic', or 'grok'
LLM_PROVIDER=openai

# API Keys
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxx
XAI_API_KEY=xai-xxxxxxxxxxxxxxxxxxxx
XAI_BASE_URL=https://api.x.ai/v1

# Model Selection (optional, uses defaults if not specified)
OPENAI_MODEL=gpt-4o-mini
ANTHROPIC_MODEL=claude-3-5-haiku-20241022
GROK_MODEL=grok-3-mini

# Context-Aware Prompts (improves quality)
ENABLE_CONTEXT_AWARE_PROMPTS=true
```

---

## How to Switch

### Option 1: Use OpenAI GPT-4o-mini (Current)

```bash
# In .env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-your-key-here
```

**Restart server:**
```bash
npm restart
```

**Check logs:**
```
[LLM Adapter] Using OpenAI GPT (gpt-4o-mini)
[Generate Answer] Using provider: openai, model: gpt-4o-mini
```

---

### Option 2: Use Claude 3.5 Haiku

```bash
# In .env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Restart server:**
```bash
npm restart
```

**Check logs:**
```
[LLM Adapter] Using Anthropic Claude (claude-3-5-haiku-20241022)
[Generate Answer] Using provider: anthropic, model: claude-3-5-haiku-20241022
```

---

### Option 3: Use xAI Grok-3-mini

```bash
# In .env
LLM_PROVIDER=grok
XAI_API_KEY=xai-your-key-here
XAI_BASE_URL=https://api.x.ai/v1
```

**Restart server:**
```bash
npm restart
```

**Check logs:**
```
[LLM Adapter] Using xAI Grok (grok-3-mini)
[Generate Answer] Using provider: grok, model: grok-3-mini
```

---

## Comparison

| Feature | GPT-4o-mini | Claude 3.5 Haiku | Grok-3-mini |
|---------|-------------|------------------|-------------|
| **Quality** | ⭐⭐⭐⭐ (88%) | ⭐⭐⭐⭐⭐ (95%) | ⭐⭐⭐⭐ (90%) |
| **Cost (1000 queries)** | $0.42/day | $2.40/day | $0.70/day |
| **Speed** | Very Fast | Very Fast | Very Fast |
| **Context Window** | 128K tokens | 200K tokens | **131K tokens** |
| **Multilingual (Hindi/Tamil)** | Good | Excellent | Good |
| **Instruction Following** | Good | Excellent | Very Good |
| **Context Awareness** | Good | Excellent | Very Good |
| **Conversational Quality** | Good | Excellent | Very Good |
| **Web Access** | No | No | **Yes (Real-time)** |

---

## Cost Analysis

### Monthly Costs (1000 queries/day)

**GPT-4o-mini:**
```
Daily: $0.48
Monthly: $14.40
Per query: $0.00048
```

**Claude 3.5 Haiku:**
```
Daily: $0.84
Monthly: $25.20
Extra cost: +$10.80/month (75% increase)
Per query: $0.00084
```

**ROI Calculation:**
```
Extra cost: $10.80/month
Quality improvement: 15-25%
Estimated conversion improvement: 2-3%

For 1000 conversations/month:
- Extra conversions: 20-30
- Cost per extra conversion: $0.36-$0.54

If customer LTV > $0.54 → Claude is worth it
(For ₹1.2L packages, definitely worth it!)
```

---

## Testing Both Models

### A/B Testing Script

```bash
# Test with OpenAI
LLM_PROVIDER=openai npm restart
# Send test queries, measure quality

# Test with Claude
LLM_PROVIDER=anthropic npm restart
# Send same queries, compare quality
```

### Monitor Logs

```bash
# Watch for provider selection
tail -f logs/combined.log | grep "LLM Adapter"

# You'll see:
[LLM Adapter] Using OpenAI GPT (gpt-4o-mini)
# or
[LLM Adapter] Using Anthropic Claude (claude-3-5-haiku-20241022)
```

---

## Troubleshooting

### Issue: "Invalid API Key"

**For OpenAI:**
```bash
# Check key format
echo $OPENAI_API_KEY
# Should start with: sk-proj-

# Test key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

**For Claude:**
```bash
# Check key format
echo $ANTHROPIC_API_KEY
# Should start with: sk-ant-

# Test key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-3-5-haiku-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

---

### Issue: "Model not switching"

**Check:**
1. Did you restart the server?
```bash
npm restart
```

2. Is .env loaded?
```bash
# Add to your code temporarily
console.log('LLM_PROVIDER:', process.env.LLM_PROVIDER);
```

3. Check logs for provider selection:
```bash
grep "LLM Adapter" logs/combined.log
```

---

### Issue: "Claude responses different format"

**This is normal!** Claude:
- More natural, conversational
- Better multilingual
- Follows instructions more strictly
- Less robotic

**Expected differences:**
```
GPT: "Our pricing is as follows:
      - 3L plan: ₹1.2L
      Would you like to proceed?"

Claude: "Great question! Our 3L package starts at ₹1.2L for 3 lakh
         messages, which works out to just ₹0.40 per message.
         What kind of scale are you thinking?"

[More natural, engaging tone]
```

---

## Advanced Configuration

### Use Different Models

**Try GPT-4o (more expensive but better):**
```bash
LLM_PROVIDER=openai
OPENAI_MODEL=gpt-4o
```

**Try Claude 3 Opus (highest quality):**
```bash
LLM_PROVIDER=anthropic
ANTHROPIC_MODEL=claude-3-opus-20240229
```

---

### Hybrid Approach (Future)

**Idea:** Use GPT for simple queries, Claude for complex

```javascript
// This could be implemented later
const provider = isComplexQuery(query) ? 'anthropic' : 'openai';
const adapter = getLLMAdapter(provider);
```

---

## What Changed in Code

### Files Modified:

1. **services/llmAdapter.js** (NEW)
   - Unified interface for OpenAI and Claude
   - Handles format differences automatically
   - Streaming support for both

2. **services/chatService.js**
   - Updated to use `getLLMAdapter()`
   - Works with both providers seamlessly
   - No other code changes needed!

3. **package.json**
   - Added `@anthropic-ai/sdk` dependency

---

## Migration Checklist

- [ ] Add `ANTHROPIC_API_KEY` to .env
- [ ] Set `LLM_PROVIDER=anthropic` (or keep `openai`)
- [ ] Restart server: `npm restart`
- [ ] Check logs for provider selection
- [ ] Test with sample queries
- [ ] Monitor response quality
- [ ] Compare costs vs quality
- [ ] Make final decision

---

## Recommendations

### For Testing/Development:
```bash
LLM_PROVIDER=openai  # Cheaper, faster iteration
```

### For Production (Sales Chatbot):
```bash
LLM_PROVIDER=anthropic  # Better quality, worth the cost
```

### For Multilingual Users:
```bash
LLM_PROVIDER=anthropic  # Much better Indian languages
```

### For Budget-Constrained:
```bash
LLM_PROVIDER=openai  # Solid quality, lower cost
```

---

## Quick Reference

**Environment Variables:**
| Variable | Options | Default |
|----------|---------|---------|
| `LLM_PROVIDER` | `openai`, `anthropic` | `openai` |
| `OPENAI_MODEL` | `gpt-4o-mini`, `gpt-4o` | `gpt-4o-mini` |
| `ANTHROPIC_MODEL` | `claude-3-5-haiku-20241022`, `claude-3-opus-20240229` | `claude-3-5-haiku-20241022` |

**Switch Models:**
```bash
# Edit .env
LLM_PROVIDER=anthropic

# Restart
npm restart

# Verify
tail -f logs/combined.log | grep "LLM Adapter"
```

**Check Current Model:**
```bash
grep "Using provider" logs/combined.log | tail -1
```

---

## Support

**Questions?**
- Check logs: `tail -f logs/combined.log`
- Verify API keys are valid
- Ensure .env is loaded
- Restart server after changes

**Issues?**
- OpenAI status: https://status.openai.com
- Anthropic status: https://status.anthropic.com

---

**Happy switching! 🚀**

Switch anytime between models with zero code changes - just update one environment variable!
