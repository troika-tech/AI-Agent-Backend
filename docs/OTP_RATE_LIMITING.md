# OTP Rate Limiting Documentation

## Overview
This system implements rate limiting for OTP (One-Time Password) requests to prevent abuse and spam. Users are limited to **3 OTP requests per phone number/email within a 24-hour window**.

---

## Features

### 1. Rate Limiting Rules
- **Maximum Attempts**: 3 requests per 24 hours
- **Window**: Rolling 24-hour window from first request
- **Tracking**: Independent tracking for email and phone numbers
- **Auto-Reset**: Automatically resets after 24 hours

### 2. Affected Endpoints
- `POST /api/otp/request-otp` (Email/Phone OTP)
- `POST /api/whatsapp-otp/send` (WhatsApp OTP)

### 3. Response Format

#### Success Response (200)
```json
{
  "message": "OTP sent successfully to +1234567890",
  "attemptsRemaining": 2,
  "maxAttempts": 3
}
```

#### Rate Limit Exceeded (429)
```json
{
  "message": "Rate limit exceeded. You have requested OTP 3 times in the last 24 hours. Please try again in 5 hour(s).",
  "attemptsRemaining": 0,
  "resetTime": "2025-10-29T12:00:00.000Z"
}
```

---

## Database Model

### OtpRateLimit Schema
```javascript
{
  email: String,           // Email address (optional)
  phone: String,           // Phone number (optional)
  attempts: Number,        // Current attempt count
  windowStart: Date,       // Start of 24-hour window
  lastAttempt: Date       // Last request timestamp
}
```

**Indexes**:
- `email` (sparse)
- `phone` (sparse)
- `windowStart` (TTL index - auto-deletes after 24 hours)

---

## Exempt Phone Numbers

### Special Case Handling
Certain phone numbers can be exempted from rate limiting for testing, admin purposes, or special use cases.

### Current Exempt Numbers
- **9834699858** - Fully exempt from all rate limiting

### Implementation Details

**Location**:
- [newOtpController.js](../controllers/newOtpController.js)
- [whatsAppOtp.js](../routes/whatsAppOtp.js)

**Code**:
```javascript
// Special case: Phone numbers exempt from rate limiting
const RATE_LIMIT_EXEMPT_PHONES = ["9834699858"];

// Check if phone number is exempt from rate limiting
const isRateLimitExempt = (phone) => {
    if (!phone) return false;
    const normalizedPhone = phone.replace(/\D/g, "");
    return RATE_LIMIT_EXEMPT_PHONES.some(exemptPhone =>
        normalizedPhone.endsWith(exemptPhone) || normalizedPhone === exemptPhone
    );
};
```

### Behavior for Exempt Numbers
1. **No Rate Limiting**: Unlimited OTP requests allowed
2. **No Database Tracking**: No records created in `OtpRateLimit` collection
3. **Simplified Response**: No `attemptsRemaining` or `maxAttempts` fields
4. **Logging**: Console logs when exempt number bypasses rate limit

### Response Format for Exempt Numbers
```json
{
  "message": "OTP sent successfully to 9834699858"
}
```
Note: Missing `attemptsRemaining` and `maxAttempts` fields indicate exemption.

---

## Adding New Exempt Numbers

### Option 1: Code Update (Current Implementation)
1. Edit the constant in both files:
   - `chatbot-backend/controllers/newOtpController.js`
   - `chatbot-backend/routes/whatsAppOtp.js`

2. Add the number to the array:
```javascript
const RATE_LIMIT_EXEMPT_PHONES = ["9834699858", "NEW_NUMBER_HERE"];
```

3. Deploy the updated code

### Option 2: Environment Variable (Recommended for Production)

**Step 1**: Update the code to read from environment:
```javascript
const RATE_LIMIT_EXEMPT_PHONES = (process.env.RATE_LIMIT_EXEMPT_PHONES || "9834699858")
  .split(",")
  .map(phone => phone.trim())
  .filter(Boolean);
```

**Step 2**: Set environment variable:
```bash
# In .env file
RATE_LIMIT_EXEMPT_PHONES=9834699858,1234567890,9876543210
```

**Step 3**: Restart the application

### Advantages of Environment Variable Approach
- ✅ No code changes required to add/remove numbers
- ✅ Different configurations for dev/staging/production
- ✅ Easier to manage via deployment tools
- ✅ Better security (numbers not in version control)

---

## Security Considerations

### 1. Exempt Number Security
- **Treat as Sensitive**: Exempt numbers should be treated as privileged
- **Audit Logging**: All exempt number usage is logged to console
- **Limited Disclosure**: Don't expose exempt list via API
- **Environment Variables**: Use env vars for production deployments

### 2. Bypass Prevention
- **Server-Side Only**: All rate limit checks happen server-side
- **No Client Trust**: Frontend cannot bypass rate limits
- **Database Validation**: Each request validated against database
- **Rollback on Failure**: Failed sends don't count against limit

### 3. Monitoring
Monitor for:
- High usage of exempt numbers
- Suspicious patterns in exempt number requests
- Unauthorized addition of exempt numbers

---

## Testing

### Test Scenarios

#### 1. Normal User Flow
```bash
# Request 1
curl -X POST http://localhost:3000/api/otp/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'
# Response: attemptsRemaining: 2

# Request 2
curl -X POST http://localhost:3000/api/otp/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'
# Response: attemptsRemaining: 1

# Request 3
curl -X POST http://localhost:3000/api/otp/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'
# Response: attemptsRemaining: 0

# Request 4 (Should fail with 429)
curl -X POST http://localhost:3000/api/otp/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'
# Response: 429 Rate limit exceeded
```

#### 2. Exempt Number Flow
```bash
# Multiple requests (should all succeed)
curl -X POST http://localhost:3000/api/otp/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9834699858"}'
# Response: Success (no attemptsRemaining field)

# Can repeat unlimited times
curl -X POST http://localhost:3000/api/otp/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "9834699858"}'
# Response: Success (no rate limiting)
```

#### 3. Window Reset Test
```bash
# Wait 24+ hours or manually update database
# After 24 hours, attempts should reset for normal numbers
```

### Automated Tests
Run the test suite:
```bash
npm test tests/otpRateLimit.test.js
```

---

## Troubleshooting

### Issue: User stuck with 0 attempts
**Solution**: Check the `OtpRateLimit` collection:
```javascript
// MongoDB query
db.otpratelimits.find({ phone: "+1234567890" })

// Manually reset (use with caution)
db.otpratelimits.deleteOne({ phone: "+1234567890" })
```

### Issue: Exempt number not working
**Checklist**:
1. ✅ Number added to `RATE_LIMIT_EXEMPT_PHONES` array
2. ✅ Server restarted after code change
3. ✅ Phone number format matches (digits only)
4. ✅ Check console logs for "Rate limit bypassed" message

### Issue: Timer not resetting after 24 hours
**Cause**: TTL index may not be active

**Solution**:
```javascript
// Check TTL index exists
db.otpratelimits.getIndexes()

// Recreate if missing
db.otpratelimits.createIndex(
  { "windowStart": 1 },
  { expireAfterSeconds: 86400 }
)
```

---

## API Reference

### Request OTP (Email/Phone)
**Endpoint**: `POST /api/otp/request-otp`

**Request Body**:
```json
{
  "email": "user@example.com"  // OR
  "phone": "+1234567890"
}
```

**Success Response** (200):
```json
{
  "message": "OTP sent successfully to +1234567890",
  "attemptsRemaining": 2,
  "maxAttempts": 3
}
```

**Rate Limited** (429):
```json
{
  "message": "Rate limit exceeded. You have requested OTP 3 times in the last 24 hours. Please try again in 5 hour(s).",
  "attemptsRemaining": 0,
  "resetTime": "2025-10-29T12:00:00.000Z"
}
```

### WhatsApp OTP
**Endpoint**: `POST /api/whatsapp-otp/send`

**Request Body**:
```json
{
  "phone": "+1234567890",
  "chatbotId": "507f1f77bcf86cd799439011"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "OTP sent via WhatsApp",
  "attemptsRemaining": 2,
  "maxAttempts": 3
}
```

**Rate Limited** (429):
```json
{
  "success": false,
  "error": "Rate limit exceeded. You have requested OTP 3 times in the last 24 hours. Please try again in 5 hour(s).",
  "attemptsRemaining": 0,
  "resetTime": "2025-10-29T12:00:00.000Z"
}
```

---

## Configuration

### Environment Variables (Recommended)
```bash
# .env file

# Comma-separated list of exempt phone numbers
RATE_LIMIT_EXEMPT_PHONES=9834699858,1234567890

# Maximum OTP attempts (default: 3)
MAX_OTP_ATTEMPTS=3

# Rate limit window in milliseconds (default: 24 hours)
RATE_LIMIT_WINDOW_MS=86400000
```

### Code Constants (Current)
```javascript
// controllers/newOtpController.js
const MAX_OTP_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const RATE_LIMIT_EXEMPT_PHONES = ["9834699858"];
```

---

## Monitoring & Analytics

### Metrics to Track
1. **Rate Limit Hit Rate**: % of users hitting the limit
2. **Exempt Number Usage**: Frequency of exempt number OTP requests
3. **Average Attempts**: Mean attempts per user
4. **Failed Attempts**: Count of 429 responses

### Log Messages
```javascript
// Normal rate limit check
"Rate limit check passed. Attempts: 1/3"

// Exempt number used
"Rate limit bypassed for exempt phone: 9834699858"

// Rate limit exceeded
"Rate limit exceeded for phone: +1234567890"
```

### Database Queries
```javascript
// Count active rate limits
db.otpratelimits.countDocuments({})

// Find users at limit
db.otpratelimits.find({ attempts: { $gte: 3 } })

// Find recent attempts
db.otpratelimits.find({
  lastAttempt: { $gte: new Date(Date.now() - 60*60*1000) }
})
```

---

## Changelog

### v1.0.0 (2025-10-28)
- ✅ Initial implementation of 3 attempts per 24-hour window
- ✅ Added exempt phone number support
- ✅ Exempt number: 9834699858
- ✅ Database model with TTL indexes
- ✅ Comprehensive test coverage
- ✅ Documentation and PRD created

---

## Future Enhancements

### Potential Improvements
1. **Dynamic Limits**: Different limits for verified vs unverified users
2. **IP-Based Limiting**: Additional layer of protection
3. **Admin Dashboard**: UI to manage exempt numbers
4. **Email Notifications**: Alert users when limit resets
5. **Grace Period**: Warning before hitting hard limit
6. **Analytics Dashboard**: Real-time monitoring of rate limit events

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review test cases in `tests/otpRateLimit.test.js`
3. Check application logs for detailed error messages
4. Contact development team

---

## Related Documentation
- [Frontend PRD](../../docs/OTP-Rate-Limiting-Frontend-PRD.md)
- [OTP Model](../models/OtpRateLimit.js)
- [OTP Controller](../controllers/newOtpController.js)
- [WhatsApp OTP Routes](../routes/whatsAppOtp.js)
