# WhatsApp Integration Testing Guide

This guide shows how to test the WhatsApp webhook integration using curl commands.

## Prerequisites

1. **Environment Variables** - Add to your `.env` file:
```bash
# WhatsApp Configuration
WHATSAPP_TOKEN=YOUR_META_ACCESS_TOKEN
WHATSAPP_VERIFY_TOKEN=mySecureToken123
WHATSAPP_PHONE_ID=YOUR_PHONE_NUMBER_ID  # Optional, can be per-chatbot

# Optional: Enable mock mode for testing without real WhatsApp API
MOCK_WHATSAPP=true
```

2. **Start the server**:
```bash
npm run dev
```

---

## Test 1: Webhook Verification (GET)

This tests if Meta can verify your webhook endpoint.

```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=mySecureToken123&hub.challenge=test12345"
```

**Expected Response:**
```
test12345
```

**What it tests:**
- Webhook verification logic
- Token validation
- GET endpoint functionality

---

## Test 2: Create Chatbot with WhatsApp

Create a chatbot with WhatsApp configuration:

```bash
curl -X POST http://localhost:3000/api/chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Test Company",
    "company_url": "https://test.com",
    "phoneNumberId": "1234567890",
    "name": "WhatsApp Test Bot",
    "persona_text": "You are a helpful customer service assistant."
  }'
```

**Expected Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "company_name": "Test Company",
  "phoneNumberId": "1234567890",
  "name": "WhatsApp Test Bot",
  ...
}
```

**Save the chatbot `_id` for later tests.**

---

## Test 3: Simulate Incoming WhatsApp Message (POST)

Simulate Meta sending a WhatsApp message to your webhook:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "phone_number_id": "1234567890"
          },
          "messages": [{
            "from": "919876543210",
            "id": "wamid.test123",
            "timestamp": "1699999999",
            "type": "text",
            "text": {
              "body": "Hello, what are your services?"
            }
          }]
        }
      }]
    }]
  }'
```

**Expected Response:**
```
200 OK
```

**What it tests:**
- Message parsing
- Chatbot lookup by `phoneNumberId`
- Chat processing
- Message storage
- WhatsApp response (mocked if `MOCK_WHATSAPP=true`)

**Check server logs for:**
- `📩 WhatsApp message from 919876543210: Hello, what are your services?`
- `🤖 Matched chatbot: WhatsApp Test Bot`
- `💾 Messages saved to database`
- `✅ Response sent to 919876543210` (or `[MOCK WHATSAPP]` if mocked)

---

## Test 4: Verify Messages Were Saved

Check if the conversation was saved to the database:

```bash
# Get chatbot messages (replace CHATBOT_ID with your chatbot's _id)
curl "http://localhost:3000/api/chatbot/507f1f77bcf86cd799439011/messages?phone=919876543210"
```

**Expected Response:**
```json
[
  {
    "chatbot_id": "507f1f77bcf86cd799439011",
    "phone": "919876543210",
    "sender": "user",
    "content": "Hello, what are your services?",
    "timestamp": "2024-..."
  },
  {
    "chatbot_id": "507f1f77bcf86cd799439011",
    "phone": "919876543210",
    "sender": "bot",
    "content": "...[AI response]...",
    "timestamp": "2024-..."
  }
]
```

---

## Test 5: Test with Multiple Messages (Conversation History)

Send multiple messages to test conversation history:

```bash
# Message 1
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "metadata": {"phone_number_id": "1234567890"},
          "messages": [{
            "from": "919876543210",
            "type": "text",
            "text": {"body": "What are your pricing plans?"}
          }]
        }
      }]
    }]
  }'

# Wait 2 seconds
sleep 2

# Message 2 (follow-up)
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "metadata": {"phone_number_id": "1234567890"},
          "messages": [{
            "from": "919876543210",
            "type": "text",
            "text": {"body": "Tell me more about the premium plan"}
          }]
        }
      }]
    }]
  }'
```

**What it tests:**
- Conversation history retrieval
- Context-aware responses
- Session management via phone number

---

## Test 6: Test with Different Phone Numbers

Test multiple users:

```bash
# User 1
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "metadata": {"phone_number_id": "1234567890"},
          "messages": [{
            "from": "919111111111",
            "type": "text",
            "text": {"body": "Hello"}
          }]
        }
      }]
    }]
  }'

# User 2
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "metadata": {"phone_number_id": "1234567890"},
          "messages": [{
            "from": "919222222222",
            "type": "text",
            "text": {"body": "Hi there"}
          }]
        }
      }]
    }]
  }'
```

**What it tests:**
- Separate session management per phone number
- Isolated conversation histories

---

## Test 7: Test Error Handling

### Test with non-existent chatbot:

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "metadata": {"phone_number_id": "INVALID_ID"},
          "messages": [{
            "from": "919876543210",
            "type": "text",
            "text": {"body": "Test"}
          }]
        }
      }]
    }]
  }'
```

**Expected:**
- Server logs: `❌ Chatbot not found for phoneNumberId: INVALID_ID`
- User receives: `❌ Chatbot configuration not found. Please contact support.`

---

## Test Script (Automated)

Create `test-whatsapp.sh` for automated testing:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
PHONE_ID="1234567890"
USER_PHONE="919876543210"

echo "🧪 Testing WhatsApp Integration..."

# Test 1: Webhook verification
echo -e "\n1️⃣ Testing webhook verification..."
RESPONSE=$(curl -s "$BASE_URL/webhook?hub.mode=subscribe&hub.verify_token=mySecureToken123&hub.challenge=test123")
if [ "$RESPONSE" == "test123" ]; then
  echo "✅ Verification passed"
else
  echo "❌ Verification failed: $RESPONSE"
  exit 1
fi

# Test 2: Send test message
echo -e "\n2️⃣ Sending test WhatsApp message..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/webhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"object\": \"whatsapp_business_account\",
    \"entry\": [{
      \"changes\": [{
        \"value\": {
          \"metadata\": {\"phone_number_id\": \"$PHONE_ID\"},
          \"messages\": [{
            \"from\": \"$USER_PHONE\",
            \"type\": \"text\",
            \"text\": {\"body\": \"What are your services?\"}
          }]
        }
      }]
    }]
  }")

if [ "$HTTP_CODE" == "200" ]; then
  echo "✅ Message received and processed"
else
  echo "❌ Message processing failed (HTTP $HTTP_CODE)"
  exit 1
fi

echo -e "\n✅ All tests passed!"
echo "Check server logs for detailed processing information"
```

Run with:
```bash
chmod +x test-whatsapp.sh
./test-whatsapp.sh
```

---

## PowerShell Test Script (Windows)

Create `test-whatsapp.ps1`:

```powershell
$BASE_URL = "http://localhost:3000"
$PHONE_ID = "1234567890"
$USER_PHONE = "919876543210"

Write-Host "🧪 Testing WhatsApp Integration..." -ForegroundColor Cyan

# Test 1: Webhook verification
Write-Host "`n1️⃣ Testing webhook verification..." -ForegroundColor Yellow
$response = Invoke-RestMethod -Uri "$BASE_URL/webhook?hub.mode=subscribe&hub.verify_token=mySecureToken123&hub.challenge=test123" -Method Get
if ($response -eq "test123") {
    Write-Host "✅ Verification passed" -ForegroundColor Green
} else {
    Write-Host "❌ Verification failed: $response" -ForegroundColor Red
    exit 1
}

# Test 2: Send test message
Write-Host "`n2️⃣ Sending test WhatsApp message..." -ForegroundColor Yellow
$body = @{
    object = "whatsapp_business_account"
    entry = @(
        @{
            changes = @(
                @{
                    value = @{
                        metadata = @{
                            phone_number_id = $PHONE_ID
                        }
                        messages = @(
                            @{
                                from = $USER_PHONE
                                type = "text"
                                text = @{
                                    body = "What are your services?"
                                }
                            }
                        )
                    }
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/webhook" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✅ Message received and processed" -ForegroundColor Green
} catch {
    Write-Host "❌ Message processing failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ All tests passed!" -ForegroundColor Green
Write-Host "Check server logs for detailed processing information"
```

Run with:
```powershell
.\test-whatsapp.ps1
```

---

## Integration with Meta (Production)

After testing locally, integrate with Meta:

1. **Expose your server** (use ngrok for testing):
   ```bash
   ngrok http 3000
   ```

2. **Configure Meta Webhook**:
   - Go to Meta Developer Console → WhatsApp → Configuration
   - Set Callback URL: `https://your-ngrok-url.ngrok.io/webhook`
   - Set Verify Token: `mySecureToken123` (same as in .env)
   - Subscribe to `messages` webhook field

3. **Test with real WhatsApp**:
   - Send message to your WhatsApp Business number
   - Check server logs for incoming webhook
   - Verify response is sent back

---

## Troubleshooting

### Issue: "Webhook verification failed"
**Solution:** Ensure `WHATSAPP_VERIFY_TOKEN` in `.env` matches the token in Meta console

### Issue: "Chatbot not found"
**Solution:** Verify `phoneNumberId` in chatbot matches the one in Meta dashboard

### Issue: "Failed to send response"
**Solution:** 
- Check `WHATSAPP_TOKEN` is valid
- Set `MOCK_WHATSAPP=true` for testing without real API
- Verify token has correct permissions in Meta console

### Issue: Messages not saving
**Solution:** Check MongoDB connection and Message model indexes

---

## Next Steps

1. **Upload Knowledge Base** - Add documents for RAG functionality
2. **Customize Persona** - Update `persona_text` in chatbot
3. **Monitor Logs** - Check for errors and performance
4. **Deploy to Production** - Use Render, Railway, or your preferred host
5. **Update Meta Webhook** - Point to production URL

---

## Support

For issues or questions:
1. Check server logs in `logs/` directory
2. Verify all environment variables are set
3. Test with `MOCK_WHATSAPP=true` first
4. Review chatbot configuration in database
