# Conversation Transcript Feature - Issue Analysis

## Overview
This document analyzes the conversation transcript feature to identify why transcripts are not being sent in production.

## Current Implementation Flow

### 1. Frontend Flow
1. **Inactivity Timer** - [frontendInactivityManager.js](../Troika-AI-Website/src/services/frontendInactivityManager.js)
   - Timer starts when user is verified and has chat history
   - Default timeout: 30 seconds (30000ms)
   - Timer resets on every chat message

2. **Trigger Conditions** - [SupaChatbot.jsx:498-519](../Troika-AI-Website/src/components/SupaChatbot.jsx#L498-L519)
   ```javascript
   if (isUserVerified && effectivePhone && sessionId && chatbotId && chatHistory.length > 0)
   ```

3. **API Call** - [conversationTranscriptService.js:14-108](../Troika-AI-Website/src/services/conversationTranscriptService.js#L14-L108)
   - Sends POST to `/api/conversation-transcript/send`
   - Includes: sessionId, phone, chatbotId, chatHistory

### 2. Backend Flow
1. **Route Handler** - [conversationTranscriptRoutes.js:54-145](../routes/conversationTranscriptRoutes.js#L54-L145)
   - Receives request data
   - Queries database for messages
   - Falls back to frontend chatHistory if DB empty

2. **PDF Generation** - [historyPDFBuffer.js](../pdf/historyPDFBuffer.js)
   - Uses Puppeteer to generate PDF
   - Requires history.ejs template

3. **S3 Upload** - [s3Uploader.js](../utils/s3Uploader.js)
   - Uploads PDF to AWS S3
   - Returns public URL

4. **WhatsApp Send** - [sendConversationTranscript.js](../utils/sendConversationTranscript.js)
   - Campaign: "chatsummarytempsumm"
   - Template: "chatsummarytemp"
   - Sends PDF via AiSensy API

---

## Potential Issues Identified

### Issue 1: Database Query Might Be Failing ⚠️

**Location:** [conversationTranscriptRoutes.js:71-82](../routes/conversationTranscriptRoutes.js#L71-L82)

**Problem:**
```javascript
messages = await Message.find({
  chatbot_id: chatbotId,
  session_id: sessionId,
  phone: phone
})
```

**Potential Causes:**
1. **Phone field mismatch** - Messages saved without phone number
2. **Session ID format** - Session ID might not match between save and retrieve
3. **Chatbot ID type** - Expecting ObjectId but might receive string

**Evidence:**
- Message model has phone as optional: `phone: { type: String, default: null }`
- Frontend sends chatHistory as fallback, suggesting DB queries often return empty

**Solution:**
- Make phone query optional OR
- Ensure messages are always saved with phone number

---

### Issue 2: Messages Not Saving with Phone Number ⚠️

**Location:** Message saving logic in chat controller

**Problem:**
Messages might be saved without the `phone` field, causing the DB query to return 0 results.

**Check Required:**
- Verify if messages are being saved with phone number in production
- Check chat message save logic

**Impact:**
- If messages don't have phone, DB query returns empty
- Falls back to frontend chatHistory (which works)
- But indicates deeper issue with message storage

---

### Issue 3: AiSensy Template Might Not Exist 🔴

**Location:** [sendConversationTranscript.js:18-19](../utils/sendConversationTranscript.js#L18-L19)

**Problem:**
```javascript
templateName = 'chatsummarytemp',
campaignName = 'chatsummarytempsumm',
```

**Verification Needed:**
- Does the template "chatsummarytemp" exist in AiSensy dashboard?
- Is the campaign "chatsummarytempsumm" configured?
- Does the template support PDF media attachments?

**How to Check:**
1. Login to AiSensy dashboard
2. Navigate to Templates section
3. Search for "chatsummarytemp"
4. Verify it has media/document support

**If Template Doesn't Exist:**
This is the MOST LIKELY cause of failure in production!

---

### Issue 4: S3 Upload Permissions ⚠️

**Location:** [s3Uploader.js:22-57](../utils/s3Uploader.js#L22-L57)

**Problem:**
AWS credentials might not have proper permissions in production.

**Current Configuration:**
- Bucket: `troika-conversation-pdfs`
- Region: `us-east-1`
- Access Key: Configured in `.env` file

**Required S3 Permissions:**
- `s3:PutObject`
- `s3:PutObjectAcl`
- `s3:GetObject`

**How to Verify:**
```bash
# Test S3 access
curl https://api.0804.in/api/conversation-transcript/s3-status
```

**Expected Response:**
```json
{
  "success": true,
  "s3Accessible": true,
  "message": "S3 is accessible"
}
```

---

### Issue 5: Puppeteer Not Available in Production 🔴

**Location:** [historyPDFBuffer.js:36-46](../pdf/historyPDFBuffer.js#L36-L46)

**Problem:**
Puppeteer requires Chrome/Chromium to be installed on the server.

**Common Production Issues:**
1. Chromium not installed
2. Missing system dependencies (fonts, shared libraries)
3. Insufficient memory
4. Sandbox issues

**Check Server:**
```bash
# SSH into production server and run:
which chromium
which chromium-browser
google-chrome --version
```

**If Missing:**
Install Puppeteer dependencies:
```bash
# Ubuntu/Debian
apt-get install -y chromium-browser chromium-chromedriver

# Or use puppeteer with bundled Chromium
npm install puppeteer  # Instead of puppeteer-core
```

**Alternative Solution:**
Use a PDF generation library that doesn't require Puppeteer:
- `pdfkit` - Pure JavaScript PDF generation
- `pdf-lib` - Lightweight PDF creation
- Cloud service like DocRaptor or PDFShift

---

### Issue 6: EJS Template Path Issues ⚠️

**Location:** [historyPDFBuffer.js:15-19](../pdf/historyPDFBuffer.js#L15-L19)

**Problem:**
```javascript
const templatePath = path.resolve(__dirname, "history.ejs");
if (!fs.existsSync(templatePath)) {
  throw new Error(`Template file not found at: ${templatePath}`);
}
```

**Verification:**
Template exists at: `chatbot-backend/pdf/history.ejs` ✅

**Potential Issue:**
- File permissions on production server
- Case-sensitive file system (Linux vs Windows)

---

### Issue 7: Inactivity Timer Too Short ⚠️

**Location:** [frontendInactivityManager.js:6](../Troika-AI-Website/src/services/frontendInactivityManager.js#L6)

**Problem:**
```javascript
this.INACTIVITY_TIMEOUT = 30000; // 30 seconds
```

**Issue:**
30 seconds is VERY short for user inactivity. Users might:
- Be reading previous messages
- Thinking about their response
- Switching tabs briefly

**Recommendation:**
Increase to 5-10 minutes:
```javascript
this.INACTIVITY_TIMEOUT = 300000; // 5 minutes
// or
this.INACTIVITY_TIMEOUT = 600000; // 10 minutes
```

---

### Issue 8: No Error Logging in Production 🔴

**Current Logging:**
- Frontend has extensive console.log debugging
- Backend logs to Winston logger

**Problem:**
Cannot diagnose production issues without logs!

**Solutions:**

1. **Add Frontend Error Tracking:**
   ```javascript
   // In conversationTranscriptService.js
   } catch (error) {
     // Send to error tracking service (Sentry, LogRocket, etc.)
     if (window.errorTracker) {
       window.errorTracker.captureException(error);
     }
   }
   ```

2. **Check Backend Logs:**
   ```bash
   # View production logs
   pm2 logs chatbot-backend --lines 100

   # Search for transcript errors
   pm2 logs chatbot-backend --lines 500 | grep -i transcript
   pm2 logs chatbot-backend --lines 500 | grep -i "conversation transcript"
   ```

---

## Testing Checklist

### Backend Tests

1. **Test S3 Connectivity:**
   ```bash
   curl https://api.0804.in/api/conversation-transcript/s3-status
   ```

2. **Test Transcript Send (with test data):**
   ```bash
   curl -X POST https://api.0804.in/api/conversation-transcript/send \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "test-123",
       "phone": "9876543210",
       "chatbotId": "YOUR_CHATBOT_ID",
       "chatHistory": [
         {"sender": "user", "content": "Hello", "timestamp": "2025-01-20T10:00:00Z"},
         {"sender": "bot", "content": "Hi! How can I help?", "timestamp": "2025-01-20T10:00:01Z"}
       ]
     }'
   ```

3. **Check Database for Messages:**
   ```javascript
   // In MongoDB shell or Compass
   db.messages.find({
     session_id: "your-session-id",
     chatbot_id: ObjectId("your-chatbot-id")
   }).sort({ timestamp: 1 })

   // Check if messages have phone field
   db.messages.find({ phone: { $exists: true } }).count()
   db.messages.find({ phone: null }).count()
   ```

### Frontend Tests

1. **Enable Console Logging:**
   - Already has extensive `[TRANSCRIPT DEBUG]` logs
   - Open browser console and trigger transcript

2. **Check Timer Status:**
   ```javascript
   // In browser console
   console.log('Active timers:', frontendInactivityManager.getActiveTimerCount());
   ```

3. **Manual Trigger:**
   Add a button to manually trigger transcript send (for testing)

---

## Recommended Fixes (Priority Order)

### 🔴 HIGH PRIORITY

1. **Verify AiSensy Template Exists**
   - Login to AiSensy dashboard
   - Check if "chatsummarytemp" template exists
   - If not, create it or use existing template name

2. **Check Puppeteer Installation**
   - Verify Chromium is available on production server
   - Install dependencies if missing

3. **Add Error Alerting**
   - Set up Sentry or similar error tracking
   - Alert on transcript send failures

### ⚠️ MEDIUM PRIORITY

4. **Fix Database Query**
   - Make phone optional in query OR
   - Ensure messages always save with phone

5. **Increase Inactivity Timeout**
   - Change from 30 seconds to 5-10 minutes

6. **Add Health Check Endpoint**
   - Test all components (S3, Puppeteer, AiSensy)

### ✅ LOW PRIORITY

7. **Add Retry Logic**
   - Retry failed transcript sends
   - Queue for later processing

8. **Add User Feedback**
   - Show toast notification when transcript sent
   - Show error message if failed

---

## Debugging Steps for Production

### Step 1: Check Backend Logs
```bash
# SSH to production server
ssh user@production-server

# Check PM2 logs
pm2 logs chatbot-backend --lines 200 | grep -i transcript

# Check for errors
pm2 logs chatbot-backend --err --lines 100
```

### Step 2: Test Endpoint Directly
```bash
# From production server or local machine
curl -X POST https://api.0804.in/api/conversation-transcript/send \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

### Step 3: Check AiSensy Dashboard
1. Login to https://backend.api-wa.co/
2. Check recent API calls
3. Check template configuration
4. Review error logs

### Step 4: Test S3 Upload
```bash
# Test S3 access
curl https://api.0804.in/api/conversation-transcript/s3-status

# List recent PDFs
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://api.0804.in/api/conversation-transcript/pdfs
```

### Step 5: Monitor Frontend Console
1. Open production site
2. Open browser DevTools console
3. Trigger transcript (wait 30 seconds after last message)
4. Look for `[TRANSCRIPT DEBUG]` logs
5. Check for errors

---

## Quick Fix Code

### Option 1: Make Database Query More Flexible

**File:** `chatbot-backend/routes/conversationTranscriptRoutes.js`

```javascript
// Change line 71-75 to make phone optional
const query = {
  chatbot_id: chatbotId,
  session_id: sessionId
};

// Only add phone to query if provided and not null
if (phone && phone !== 'null') {
  query.phone = phone;
}

messages = await Message.find(query)
  .sort({ timestamp: 1 })
  .lean();
```

### Option 2: Add Comprehensive Error Logging

**File:** `chatbot-backend/routes/conversationTranscriptRoutes.js`

```javascript
} catch (error) {
  // Detailed error logging
  logger.error('❌ TRANSCRIPT ERROR:', {
    error: error.message,
    stack: error.stack,
    sessionId,
    phone,
    chatbotId,
    messageCount: messages?.length,
    hasS3Url: !!s3Url,
    pdfSize: pdfBuffer?.length
  });

  res.status(500).json({
    success: false,
    error: error.message,
    details: {
      step: 'Identify which step failed',
      sessionId
    }
  });
}
```

---

## Success Indicators

When working correctly, you should see:

1. **Frontend Console:**
   ```
   🚀 [TIMER DEBUG] Starting inactivity timer
   ⏰ [TIMER DEBUG] Timer expired! Calling handleInactivity...
   📤 [INACTIVITY DEBUG] Calling conversationTranscriptService...
   ✅ [TRANSCRIPT DEBUG] Success! Transcript sent successfully
   📄 [TRANSCRIPT DEBUG] S3 URL: https://...
   ```

2. **Backend Logs:**
   ```
   📄 Generating conversation transcript for session: abc123
   📊 Found 15 messages in database
   📤 Uploading PDF to S3: conversation-transcripts/abc123-1234567890.pdf
   ✅ PDF uploaded successfully to S3
   📱 Sending conversation transcript via WhatsApp to 919876543210
   ✅ Conversation transcript sent successfully
   ```

3. **User Receives:**
   - WhatsApp message with PDF attachment
   - PDF contains full conversation history

---

## Next Steps

1. Run the testing checklist above
2. Check production logs for errors
3. Verify AiSensy template configuration
4. Test S3 connectivity
5. Apply recommended fixes based on findings
