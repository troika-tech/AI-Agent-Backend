# Fix Transcript Issue - Production Server

## Issue Identified ✅

**Error:** `PDF generation failed: Failed to launch the browser process!`

**Root Cause:** Chromium browser dependencies are missing on the Ubuntu production server.

**Status:** Puppeteer is installed (v24.12.0) but cannot launch Chromium due to missing system libraries.

---

## Solution: Install Chromium Dependencies

### Option 1: Automated Installation (Recommended)

Run the installation script on your production server:

```bash
# SSH into production server
ssh ubuntu@your-server-ip

# Navigate to backend directory
cd ~/chatbot-backend

# Make script executable
chmod +x scripts/installChromiumDeps.sh

# Run installation script
./scripts/installChromiumDeps.sh

# Restart the backend
pm2 restart chatbot-backend

# Test transcript
node scripts/testProductionTranscript.js 9834699858
```

---

### Option 2: Manual Installation

If you prefer to install manually:

```bash
# SSH into production server
ssh ubuntu@ip-172-31-11-27

# Update packages
sudo apt-get update

# Install Chromium and all dependencies
sudo apt-get install -y \
  chromium-browser \
  chromium-chromedriver \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  wget \
  xdg-utils

# Verify installation
chromium-browser --version

# Restart backend
pm2 restart chatbot-backend
```

---

### Option 3: Use Puppeteer's Bundled Chromium

If the above doesn't work, reinstall Puppeteer with bundled Chromium:

```bash
# SSH to production server
ssh ubuntu@ip-172-31-11-27
cd ~/chatbot-backend

# Remove current Puppeteer
npm uninstall puppeteer

# Reinstall with Chromium bundled (this downloads ~300MB)
npm install puppeteer

# Restart backend
pm2 restart chatbot-backend
```

---

## Step-by-Step Installation Instructions

### 1. Connect to Production Server

```bash
ssh ubuntu@ip-172-31-11-27
```

### 2. Navigate to Backend Directory

```bash
cd ~/chatbot-backend
```

### 3. Create and Run Installation Script

Copy the installation commands into a script:

```bash
# Create script
cat > install_chromium.sh << 'EOF'
#!/bin/bash
echo "Installing Chromium dependencies..."
sudo apt-get update
sudo apt-get install -y chromium-browser chromium-chromedriver \
  ca-certificates fonts-liberation libappindicator3-1 libasound2 \
  libatk-bridge2.0-0 libatk1.0-0 libcairo2 libcups2 libdbus-1-3 \
  libexpat1 libfontconfig1 libgbm1 libglib2.0-0 libgtk-3-0 \
  libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libx11-6 \
  libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
  libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 \
  libxtst6 wget xdg-utils

echo "✅ Installation complete!"
chromium-browser --version
EOF

# Make executable
chmod +x install_chromium.sh

# Run it
./install_chromium.sh
```

### 4. Restart Backend Service

```bash
pm2 restart chatbot-backend

# Check logs to ensure it started properly
pm2 logs chatbot-backend --lines 20
```

### 5. Test Transcript Feature

```bash
# Test with your phone number
node scripts/testProductionTranscript.js 9834699858

# You should see:
# ✅ SUCCESS!
# 📱 Check WhatsApp for the PDF transcript!
```

---

## Verification Steps

### 1. Check Chromium Installation

```bash
# Try these commands (one should work)
chromium-browser --version
chromium --version
google-chrome --version

# Expected output: "Chromium 120.x.xxxx.xx"
```

### 2. Test Puppeteer Directly

Create a test file:

```bash
cat > test_puppeteer.js << 'EOF'
const puppeteer = require('puppeteer');

(async () => {
  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ Browser launched successfully!');
    await browser.close();
    console.log('✅ Browser closed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();
EOF

node test_puppeteer.js
```

### 3. Check Backend Logs

```bash
# Monitor logs in real-time
pm2 logs chatbot-backend

# Search for transcript-related logs
pm2 logs chatbot-backend --lines 500 | grep -i transcript

# Search for errors
pm2 logs chatbot-backend --err --lines 100
```

### 4. Test S3 Access

```bash
# Test S3 connectivity
curl https://api.0804.in/api/conversation-transcript/s3-status

# Expected response:
# {"success":true,"s3Accessible":true,"message":"S3 is accessible"}
```

---

## Testing the Fix

After installation, run these tests:

### Test 1: Quick Production Test

```bash
cd ~/chatbot-backend
node scripts/testProductionTranscript.js 9834699858
```

**Expected Output:**
```
🚀 Production Transcript Test
=============================
📞 Phone: 9834699858
🌐 API: https://api.0804.in/api/conversation-transcript/send
📊 Messages: 4
🆔 Session: prod-test-1234567890

⏳ Sending request to production...

✅ SUCCESS!
============
{
  "success": true,
  "message": "Conversation transcript sent successfully",
  "s3Url": "https://troika-conversation-pdfs.s3.us-east-1.amazonaws.com/...",
  "messageCount": 4
}

📄 PDF URL: https://troika-conversation-pdfs.s3...
📱 Check WhatsApp number 9834699858 for the PDF transcript!
✨ If you received it, the transcript feature is working in production!
```

### Test 2: Frontend Test

1. Open https://your-frontend-url
2. Start a chat conversation
3. Wait 30 seconds (or configured timeout)
4. Check WhatsApp for transcript

---

## Troubleshooting

### Issue: "command not found: chromium-browser"

**Solution:**
```bash
# Try alternative installation
sudo apt-get install -y google-chrome-stable

# Or use snap
sudo snap install chromium
```

### Issue: Still getting "Failed to launch browser"

**Solution 1:** Check permissions
```bash
# Give executable permissions
sudo chmod -R 755 /usr/bin/chromium*
sudo chmod -R 755 /snap/bin/chromium*
```

**Solution 2:** Use no-sandbox mode
Edit `chatbot-backend/pdf/historyPDFBuffer.js` and ensure args include:
```javascript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage'
]
```

**Solution 3:** Reinstall with bundled Chromium
```bash
npm uninstall puppeteer
npm install puppeteer  # Downloads ~300MB Chromium bundle
```

### Issue: Permission Denied

**Solution:**
```bash
# Run backend as user with proper permissions
pm2 restart chatbot-backend --user ubuntu
```

---

## Alternative Solution: Use Different PDF Library

If Chromium installation continues to fail, we can switch to a lightweight PDF library:

**Option A: PDFKit (Pure JavaScript)**
- No browser required
- Smaller footprint
- Slightly different PDF styling

**Option B: PDF-Lib**
- Pure JavaScript
- No dependencies
- Modern API

Let me know if you want me to implement one of these alternatives!

---

## Success Indicators

After fixing, you should see:

1. **Backend Logs:**
   ```
   📄 Generating conversation transcript for session: prod-test-xxx
   📊 Found 4 messages in database
   PDF generated successfully. Size: 45231 bytes
   ✅ PDF uploaded successfully to S3
   📱 Sending conversation transcript via WhatsApp
   ✅ Conversation transcript sent successfully
   ```

2. **WhatsApp Message:**
   - User receives WhatsApp message
   - Contains PDF attachment
   - PDF shows full conversation

3. **Test Script Output:**
   ```
   ✅ SUCCESS!
   📱 Check WhatsApp for the PDF!
   ```

---

## Quick Reference Commands

```bash
# SSH to server
ssh ubuntu@ip-172-31-11-27

# Install dependencies
sudo apt-get update && sudo apt-get install -y chromium-browser

# Restart backend
pm2 restart chatbot-backend

# Test transcript
node scripts/testProductionTranscript.js 9834699858

# View logs
pm2 logs chatbot-backend

# Check S3
curl https://api.0804.in/api/conversation-transcript/s3-status
```

---

## Next Steps

1. ✅ **Install Chromium** - Run installation script
2. ✅ **Restart Backend** - `pm2 restart chatbot-backend`
3. ✅ **Test Feature** - Run test script
4. ✅ **Verify WhatsApp** - Check for PDF message
5. ✅ **Monitor Logs** - Ensure no errors

---

## Need Help?

If you encounter issues:

1. **Check logs:** `pm2 logs chatbot-backend --lines 100`
2. **Run diagnostics:** `node scripts/testTranscriptFeature.js`
3. **Test components:**
   - S3: `curl https://api.0804.in/api/conversation-transcript/s3-status`
   - Puppeteer: `node test_puppeteer.js`
4. **Share error messages** for further debugging

---

## Summary

**Problem:** Missing Chromium dependencies on Ubuntu server
**Solution:** Install chromium-browser and required libraries
**Time:** ~5 minutes to install
**Impact:** Enables PDF generation for transcripts

After this fix, the conversation transcript feature should work perfectly! 🎉
