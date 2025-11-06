# Proposal API Endpoint Documentation

## Overview
The Proposal API provides endpoints for sending service proposals to users via WhatsApp. This endpoint has been migrated from the frontend to the backend for better security and maintainability.

## Migration Notes
Previously, the WhatsApp proposal sending logic was implemented entirely in the frontend with a hardcoded API key. This has been refactored to:
- Move all WhatsApp API logic to the backend
- Secure the API key in environment variables
- Provide a clean REST API for the frontend to consume
- Centralize phone number validation and normalization logic

## Base URL
```
Production: https://api.0804.in/api
Development: http://localhost:5000/api
```

## Endpoints

### 1. Send Proposal

Send a service proposal to a user's WhatsApp number.

**Endpoint:** `POST /api/proposal/send`

**Authentication:** None (Public endpoint)

**Request Body:**
```json
{
  "phone": "9876543210",
  "serviceName": "AI Supa Agent"
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phone | string | Yes | User's phone number (10 digits or 12 digits with country code "91") |
| serviceName | string | Yes | Name of the selected service |

**Supported Services:**
- AI Supa Agent
- AI Calling Agent
- RCS Messaging
- WhatsApp Marketing

**Phone Number Format:**
The backend automatically normalizes phone numbers:
- Accepts 10-digit format: `9876543210`
- Accepts 12-digit format with country code: `919876543210`
- Automatically adds country code "91" if only 10 digits provided
- Strips all non-digit characters

**Success Response:**

**Status Code:** `200 OK`

```json
{
  "success": true,
  "message": "Proposal sent on WhatsApp",
  "result": {
    // AiSensy API response data
  }
}
```

**Error Responses:**

**Status Code:** `400 Bad Request`
```json
{
  "success": false,
  "error": "Phone number is required"
}
```

```json
{
  "success": false,
  "error": "Service name is required"
}
```

```json
{
  "success": false,
  "error": "Invalid phone number format. Expected 10 digits or 12 digits with country code."
}
```

**Status Code:** `500 Internal Server Error`
```json
{
  "success": false,
  "error": "WhatsApp API configuration missing"
}
```

```json
{
  "success": false,
  "error": "Failed to send proposal",
  "details": {
    // AiSensy error response
  }
}
```

**Example Request:**

```javascript
// Frontend usage
const response = await fetch('https://api.0804.in/api/proposal/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '9876543210',
    serviceName: 'AI Supa Agent'
  })
});

const data = await response.json();
if (data.success) {
  console.log('Proposal sent successfully!');
} else {
  console.error('Error:', data.error);
}
```

```bash
# cURL example
curl -X POST https://api.0804.in/api/proposal/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "serviceName": "AI Supa Agent"
  }'
```

---

### 2. Health Check

Check the status of the proposal service and its configuration.

**Endpoint:** `GET /api/proposal/health`

**Authentication:** None (Public endpoint)

**Success Response:**

**Status Code:** `200 OK`

```json
{
  "success": true,
  "status": "operational",
  "configured": true,
  "orgSlug": "troika-tech-services",
  "message": "Proposal service is ready"
}
```

**When Not Configured:**

```json
{
  "success": true,
  "status": "operational",
  "configured": false,
  "orgSlug": "not-configured",
  "message": "Proposal service requires AISENSY_API_KEY configuration"
}
```

**Example Request:**

```javascript
const response = await fetch('https://api.0804.in/api/proposal/health');
const data = await response.json();
console.log('Service status:', data.status);
```

```bash
# cURL example
curl https://api.0804.in/api/proposal/health
```

---

## Implementation Details

### Backend Components

**1. Utility Function:** `utils/sendWhatsAppProposal.js`
- Handles phone number normalization
- Validates input parameters
- Sends WhatsApp template message via AiSensy API
- Returns standardized response format

**2. Route Handler:** `routes/proposalRoutes.js`
- Defines API endpoints
- Validates request body
- Calls utility function
- Returns formatted responses

**3. Route Mounting:** `app.js`
- Mounts `/api/proposal` routes
- Applies rate limiting middleware

### Environment Variables Required

```env
# Required
AISENSY_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional (with defaults)
AISENSY_ORG_SLUG=troika-tech-services      # Default: troika-tech-services
AISENSY_SENDER_NAME=Troika Tech Services   # Default: Troika Tech Services
AISENSY_COUNTRY_CODE=91                    # Default: 91
```

### WhatsApp Template Details

**Campaign Name:** `proposalsending`

**Template Parameters:**
- `$FirstName` - Replaced with the service name

**Payload Structure:**
```json
{
  "apiKey": "[API_KEY]",
  "campaignName": "proposalsending",
  "destination": "919876543210",
  "userName": "Troika Tech Services",
  "templateParams": ["$FirstName"],
  "paramsFallbackValue": { "FirstName": "AI Supa Agent" },
  "source": "new-landing-page form",
  "media": {},
  "buttons": [],
  "carouselCards": [],
  "location": {},
  "attributes": {}
}
```

**External API:** `https://backend.api-wa.co/campaign/{orgSlug}/api/v2`

---

## Frontend Integration

### Before (Hardcoded API Key in Frontend)

```javascript
// ❌ Old implementation - API key exposed in frontend
const payload = {
  apiKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  campaignName: "proposalsending",
  destination: "919876543210",
  // ... more fields
};
const res = await fetch('https://backend.api-wa.co/campaign/troika-tech-services/api/v2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

### After (Secure Backend API)

```javascript
// ✅ New implementation - API key secured in backend
const payload = {
  phone: phoneRaw,
  serviceName: service.name
};
const res = await fetch(`${apiBase}/proposal/send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
```

### Benefits of Migration
1. **Security:** API key is no longer exposed in frontend code
2. **Maintainability:** Phone validation logic centralized in one place
3. **Consistency:** Uses same pattern as other backend utilities
4. **Flexibility:** Easier to modify WhatsApp integration without frontend changes
5. **Monitoring:** Backend logs provide better visibility into API calls

---

## Testing

### Manual Testing

1. **Test with valid phone number:**
```bash
curl -X POST http://localhost:5000/api/proposal/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210",
    "serviceName": "AI Supa Agent"
  }'
```

2. **Test with invalid phone:**
```bash
curl -X POST http://localhost:5000/api/proposal/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "123",
    "serviceName": "AI Supa Agent"
  }'
```

3. **Test missing parameters:**
```bash
curl -X POST http://localhost:5000/api/proposal/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "9876543210"
  }'
```

4. **Test health endpoint:**
```bash
curl http://localhost:5000/api/proposal/health
```

### Expected Logs

**Success Case:**
```
📋 Proposal request received for service: AI Supa Agent, phone: 9876543210
📤 Sending proposal for "AI Supa Agent" to 919876543210
✅ Proposal sent successfully to 919876543210
```

**Error Case:**
```
📋 Proposal request received for service: AI Supa Agent, phone: 123
⚠️ Proposal send failed: Invalid phone number format. Expected 10 digits or 12 digits with country code.
```

---

## Rate Limiting

The endpoint is protected by the global API rate limiter:
- **Window:** 1 minute
- **Max Requests:** 100 per IP (configurable)
- **Whitelisted IPs:** Configurable via `RATE_LIMIT_IP_WHITELIST`

---

## Error Handling

The backend provides comprehensive error handling:

1. **Input Validation:** Checks for required fields
2. **Phone Normalization:** Validates and formats phone numbers
3. **API Configuration:** Verifies environment variables
4. **External API Errors:** Catches and formats AiSensy API errors
5. **Logging:** Records all requests and errors with appropriate log levels

---

## Related Endpoints

- **WhatsApp OTP:** `/api/whatsapp-otp/send` - Send OTP via WhatsApp
- **Conversation Transcript:** `/api/conversation-transcript/send` - Send chat history PDF
- **WhatsApp Appointment:** `/api/whatsapp-appointment/send` - Send appointment confirmation

---

## Support

For issues or questions:
1. Check backend logs for detailed error messages
2. Verify environment variables are configured correctly
3. Test the health endpoint to confirm service status
4. Review the AiSensy dashboard for message delivery status

---

## Changelog

### Version 1.0.0 (Current)
- Initial implementation
- Migrated from frontend hardcoded implementation
- Added phone number normalization
- Added health check endpoint
- Comprehensive error handling and logging
