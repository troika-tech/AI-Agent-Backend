#!/bin/bash

# Script to install Chromium for PDF generation with Puppeteer
# Run this on your Ubuntu server

echo "📦 Installing Chromium for PDF generation..."

# Update package list
sudo apt-get update

# Install Chromium browser and dependencies
sudo apt-get install -y \
  chromium-browser \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libwayland-client0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils

# Check if Chromium was installed successfully
if command -v chromium-browser &> /dev/null; then
    echo "✅ Chromium installed successfully at: $(which chromium-browser)"
    chromium-browser --version
else
    echo "❌ Chromium installation failed"
    exit 1
fi

# Set environment variable (optional - code will auto-detect)
echo ""
echo "You can optionally set the PUPPETEER_EXECUTABLE_PATH:"
echo "export PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser)"
echo ""
echo "Add this to your ~/.bashrc or PM2 ecosystem file if needed"

echo ""
echo "✅ Installation complete! Restart your Node.js application."
