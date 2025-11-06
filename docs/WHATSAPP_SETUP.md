# WhatsApp Integration Setup Guide

## Quick Start

This guide helps you add WhatsApp functionality to your chatbot backend.

---

## 1. Environment Variables

Add these variables to your `.env` file:

```bash
# WhatsApp Business API Configuration
WHATSAPP_TOKEN=YOUR_META_ACCESS_TOKEN_HERE
WHATSAPP_VERIFY_TOKEN=mySecureRandomToken123
WHATSAPP_PHONE_ID=YOUR_PHONE_NUMBER_ID  # Optional, can be set per-chatbot

# Optional: Mock mode for testing without real WhatsApp API
MOCK_WHATSAPP=true
```

### Getting WhatsApp Credentials:

1. **WHATSAPP_TOKEN**:
   - Go to [Meta for Developers](https://developers.facebook.com/apps/)
   - Create/select your app
   - Go to WhatsApp → API Setup
   - Copy the temporary access token OR generate a permanent token

2. **WHATSAPP_VERIFY_TOKEN**:
   - Create your own secure random string
   - Example: `myWebhookSecret2024!`
   - This is used to verify webhook requests from Meta

3. **WHATSAPP_PHONE_ID**:
   - Found in WhatsApp → API Setup → Phone Number ID
   - Example: `1234567890123456`
   - Can also be set per-chatbot in database

---

## 2. Create a WhatsApp-Enabled Chatbot

### Using API:

```bash
curl -X POST http://localhost:3000/api/chatbot \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "My Company",
    "company_url": "https://mycompany.com",
    "phoneNumberId": "1234567890123456",
    "name": "Support Bot",
    "persona_text": "You are a helpful customer support assistant."
  }'
```

### Using MongoDB directly:

```javascript
db.chatbots.updateOne(
  { _id: ObjectId("YOUR_CHATBOT_ID") },
  { $set: { phoneNumberId: "1234567890123456" } }
)
```

**Important**: The `phoneNumberId` must match your WhatsApp Business Phone Number ID from Meta.

---

## 3. Configure Meta Webhook

### For Local Testing (using ngrok):

1. **Start ngrok**:
   ```bash
   ngrok http 3000
   ```

2. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

3. **Configure in Meta**:
   - Go to WhatsApp → Configuration → Webhook
   - Callback URL: `https://abc123.ngrok.io/webhook`
   - Verify Token: `mySecureRandomToken123` (same as in .env)
   - Click "Verify and Save"
   - Subscribe to `messages` field

### For Production:

1. Deploy your app to a server (Render, Railway, AWS, etc.)
2. Use your production URL: `https://yourdomain.com/webhook`
3. Configure same way in Meta console

---

## 4. Test the Integration

### Quick Test with curl:

```bash
# Test webhook verification
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=mySecureRandomToken123&hub.challenge=test123"
# Should return: test123

# Simulate incoming message
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "metadata": {"phone_number_id": "1234567890123456"},
          "messages": [{
            "from": "919876543210",
            "type": "text",
            "text": {"body": "Hello"}
          }]
        }
      }]
    }]
  }'
```

For detailed testing guide, see [WHATSAPP_TESTING.md](./WHATSAPP_TESTING.md)

---

## 5. How It Works

```
User sends WhatsApp message
    ↓
Meta WhatsApp API receives it
    ↓
Meta sends webhook POST to /webhook
    ↓
Your backend:
  1. Verifies the webhook signature
  2. Extracts message and phone number
  3. Looks up chatbot by phoneNumberId
  4. Retrieves conversation history
  5. Processes message with AI/RAG
  6. Saves to database
  7. Sends response via WhatsApp API
    ↓
User receives AI response on WhatsApp
```

---

## 6. Features

✅ **Automatic Session Management** - Based on phone number  
✅ **Conversation History** - Last 10 messages per user  
✅ **RAG Integration** - Uses your existing knowledge base  
✅ **Multi-User Support** - Separate sessions per phone number  
✅ **Message Persistence** - All messages saved to database  
✅ **Mock Mode** - Test without real WhatsApp API  
✅ **Error Handling** - Graceful fallbacks and logging  

---

## 7. Files Added/Modified

### New Files:
- `controllers/whatsappWebhookController.js` - Webhook handler
- `routes/whatsappWebhookRoutes.js` - Route definitions
- `utils/sendWhatsAppMessage.js` - WhatsApp API wrapper
- `docs/WHATSAPP_TESTING.md` - Testing guide
- `docs/WHATSAPP_SETUP.md` - This file

### Modified Files:
- `models/Chatbot.js` - Added `phoneNumberId` field
- `app.js` - Registered `/webhook` route

**No existing functionality was changed.**

---

## 8. Database Considerations

### Chatbot Model Changes:
```javascript
{
  // Existing fields...
  phoneNumberId: "1234567890123456", // NEW: Links to WhatsApp Business Phone
  // Rest of fields...
}
```

### Message Model:
- Already supports `phone` field
- Sessions identified by: `whatsapp-{phoneNumber}`
- Example session_id: `whatsapp-919876543210`

---

## 9. Monitoring

### Check Logs:
```bash
# View real-time logs
tail -f logs/combined.log

# Look for:
📩 WhatsApp message from...
🤖 Matched chatbot...
💾 Messages saved to database
✅ Response sent to...
```

### Database Queries:
```javascript
// Check messages from a phone number
db.messages.find({ 
  phone: "919876543210",
  chatbot_id: ObjectId("YOUR_CHATBOT_ID") 
}).sort({ timestamp: -1 })

// Check chatbot config
db.chatbots.findOne({ phoneNumberId: "1234567890123456" })
```

---

## 10. Troubleshooting

| Issue | Solution |
|-------|----------|
| Webhook verification fails | Check `WHATSAPP_VERIFY_TOKEN` matches in .env and Meta console |
| "Chatbot not found" | Verify `phoneNumberId` in database matches Meta Phone Number ID |
| Messages not sending | Set `MOCK_WHATSAPP=true` for testing, or check `WHATSAPP_TOKEN` |
| No response from AI | Check OpenAI API key and knowledge base embeddings |
| Messages not saving | Verify MongoDB connection and Message model |

---

## 11. Production Checklist

Before going live:

- [ ] Set `MOCK_WHATSAPP=false` in production .env
- [ ] Use permanent WhatsApp access token (not temporary)
- [ ] Configure production webhook URL in Meta
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Test with real WhatsApp messages
- [ ] Monitor logs for errors
- [ ] Set up database backups
- [ ] Configure rate limiting if needed
- [ ] Add webhook signature verification (optional security)

---

## 12. Next Steps

1. **Upload Knowledge Base** - Add documents/FAQs for better responses
2. **Customize Persona** - Edit `persona_text` per chatbot
3. **Add Rich Media** - Extend to support images, buttons, lists
4. **Analytics** - Track message volume, response times
5. **Multi-Language** - Add language detection and translation

---

## Support

For detailed testing commands and examples, see:
- [WHATSAPP_TESTING.md](./WHATSAPP_TESTING.md)

For Meta WhatsApp API documentation:
- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
