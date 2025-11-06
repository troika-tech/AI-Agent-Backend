# 📱 WhatsApp Conversation Transcript Feature

## Overview
This feature automatically sends conversation transcripts as PDF documents via WhatsApp when users don't interact for 30 seconds. The system uses Aisensy WhatsApp templates and AWS S3 for PDF storage.

## 🎯 Features

### ✅ Implemented Features
- **30-second inactivity timer** - Automatically triggers when user stops interacting
- **Dynamic PDF generation** - Creates conversation transcripts with proper formatting
- **AWS S3 integration** - Uploads PDFs to S3 bucket for sharing
- **WhatsApp template integration** - Uses Aisensy templates for professional messaging
- **Session management** - Tracks conversations per phone number
- **Admin testing endpoints** - Complete testing and monitoring API

## 📋 Configuration

### Environment Variables
Add these to your `.env` file:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=troika-conversation-pdfs

# Aisensy WhatsApp Configuration
AISENSY_API_KEY=your_aisensy_api_key
AISENSY_ORG_SLUG=troika-tech-services
AISENSY_SENDER_NAME=Supa Agent
AISENSY_COUNTRY_CODE=91
AISENSY_DEFAULT_CAMPAIGN=Document_Template
```

### WhatsApp Template Setup
**Template Name:** `conversation_transcript`  
**Campaign Name:** `Document_Template`

Template should include:
- Company name parameter
- Session ID parameter  
- Timestamp parameter
- Document type parameter
- Media attachment support for PDF

## 🏗️ Architecture

### Components

1. **ConversationInactivityManager** (`utils/conversationInactivityManager.js`)
   - Manages 30-second timers per session
   - Handles PDF generation and WhatsApp sending
   - Singleton pattern for global state

2. **S3Uploader** (`utils/s3Uploader.js`)
   - AWS S3 integration for PDF storage
   - Handles upload, delete, and listing operations
   - Error handling and logging

3. **SendConversationTranscript** (`utils/sendConversationTranscript.js`)
   - Specialized WhatsApp template sender
   - Handles Aisensy API integration
   - Custom message support

4. **WhatsApp Webhook Integration** (`controllers/whatsappWebhookController.js`)
   - Resets timer on user interaction
   - Integrates with existing WhatsApp flow

5. **Admin API Routes** (`routes/conversationTranscriptRoutes.js`)
   - Testing and monitoring endpoints
   - Manual transcript generation
   - Timer management

## 🚀 Usage

### Automatic Flow
1. User sends WhatsApp message
2. Bot responds and starts 30-second timer
3. If no user interaction within 30 seconds:
   - System generates PDF of conversation
   - Uploads PDF to S3
   - Sends WhatsApp template with PDF attachment

### Manual Testing

#### Test S3 Connectivity
```bash
curl -X GET "http://localhost:5000/api/conversation-transcript/s3-status" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Test Conversation Transcript
```bash
curl -X POST "http://localhost:5000/api/conversation-transcript/test" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "phone": "9876543210",
    "testPdfUrl": "https://example.com/test.pdf"
  }'
```

#### Send Manual Transcript
```bash
curl -X POST "http://localhost:5000/api/conversation-transcript/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "sessionId": "whatsapp-9876543210",
    "phone": "9876543210",
    "chatbotId": "YOUR_CHATBOT_ID"
  }'
```

#### Check Active Timers
```bash
curl -X GET "http://localhost:5000/api/conversation-transcript/timers" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

#### Clear All Timers
```bash
curl -X DELETE "http://localhost:5000/api/conversation-transcript/timers" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 📊 Monitoring

### Log Messages
- `⏰ Starting 30s inactivity timer for session: {sessionId}`
- `⏰ Inactivity timer reset for session: {sessionId}`
- `📄 Generating conversation transcript for inactive session: {sessionId}`
- `📤 Uploading PDF to S3: {key} ({size} bytes)`
- `✅ PDF uploaded successfully to S3: {url}`
- `📱 Sending conversation transcript via WhatsApp to {phone}`
- `✅ Conversation transcript sent successfully to {phone}`

### Error Handling
- S3 upload failures
- WhatsApp template sending failures
- PDF generation errors
- Timer management issues

## 🔧 API Endpoints

### GET `/api/conversation-transcript/timers`
Get count of active inactivity timers

### DELETE `/api/conversation-transcript/timers`
Clear all active timers

### GET `/api/conversation-transcript/s3-status`
Check S3 connectivity

### GET `/api/conversation-transcript/pdfs`
List PDFs in S3 bucket

### GET `/api/conversation-transcript/history/:sessionId`
Get conversation history for a session

### POST `/api/conversation-transcript/test`
Test conversation transcript sending

### POST `/api/conversation-transcript/send`
Manually send conversation transcript

## 🛠️ Troubleshooting

### Common Issues

1. **Timer not starting**
   - Check if conversationInactivityManager is imported
   - Verify sessionId format: `whatsapp-{phone}`
   - Check logs for timer reset messages

2. **PDF not generating**
   - Verify puppeteer installation
   - Check PDF template files exist
   - Verify message data format

3. **S3 upload failing**
   - Check AWS credentials
   - Verify bucket permissions
   - Check network connectivity

4. **WhatsApp template not sending**
   - Verify Aisensy API key
   - Check template approval status
   - Verify phone number format

### Debug Commands

```bash
# Check Redis connection
docker exec eveningpdf-redis redis-cli ping

# Check S3 access
curl -X GET "http://localhost:5000/api/conversation-transcript/s3-status"

# List active timers
curl -X GET "http://localhost:5000/api/conversation-transcript/timers"

# Test with sample data
curl -X POST "http://localhost:5000/api/conversation-transcript/test" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"phone": "9876543210"}'
```

## 📈 Performance Considerations

- **Timer Management**: Uses Map for O(1) timer operations
- **PDF Generation**: Asynchronous with proper error handling
- **S3 Upload**: Streaming upload for large PDFs
- **Memory Management**: Timers are cleared after use
- **Concurrent Sessions**: Supports multiple simultaneous timers

## 🔒 Security

- **Admin-only endpoints**: All management APIs require admin authentication
- **S3 Security**: Uses IAM credentials with minimal permissions
- **WhatsApp Security**: Uses Aisensy API with proper authentication
- **Data Privacy**: PDFs are stored with expiration metadata

## 📝 Future Enhancements

- [ ] Customizable inactivity timeout
- [ ] PDF template customization
- [ ] Multiple language support
- [ ] Analytics and reporting
- [ ] Batch transcript generation
- [ ] Email fallback option
