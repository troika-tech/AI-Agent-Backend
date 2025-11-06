#!/bin/bash
# Install Chromium dependencies for Puppeteer on Ubuntu
# This fixes the "Failed to launch the browser process" error

echo "=========================================="
echo "Installing Chromium Dependencies"
echo "=========================================="
echo ""

# Update package lists
echo "📦 Updating package lists..."
sudo apt-get update

echo ""
echo "🔧 Installing Chromium and dependencies..."

# Install Chromium browser and required dependencies
sudo apt-get install -y \
  chromium-browser \
  chromium-chromedriver \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
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
  lsb-release \
  wget \
  xdg-utils

echo ""
echo "✅ Installation complete!"
echo ""

# Verify Chromium installation
echo "🔍 Verifying Chromium installation..."
if command -v chromium-browser &> /dev/null; then
    CHROMIUM_VERSION=$(chromium-browser --version)
    echo "✅ Chromium found: $CHROMIUM_VERSION"
elif command -v chromium &> /dev/null; then
    CHROMIUM_VERSION=$(chromium --version)
    echo "✅ Chromium found: $CHROMIUM_VERSION"
else
    echo "⚠️  Chromium command not found, but libraries installed"
fi

echo ""
echo "=========================================="
echo "Installation Summary"
echo "=========================================="
echo "✅ Chromium dependencies installed"
echo "✅ Required libraries for Puppeteer ready"
echo ""
echo "Next steps:"
echo "1. Restart your Node.js application: pm2 restart chatbot-backend"
echo "2. Test transcript: node scripts/testProductionTranscript.js <phone>"
echo ""
