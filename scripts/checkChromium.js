#!/usr/bin/env node
/**
 * Check if Chromium is available for Puppeteer
 * Run this on the server to diagnose Chromium issues
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('\n' + '='.repeat(60));
console.log('🔍 CHROMIUM INSTALLATION CHECK');
console.log('='.repeat(60) + '\n');

// Check possible Chromium locations
const chromiumPaths = [
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
  '/opt/google/chrome/chrome',
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH
].filter(Boolean);

console.log('1️⃣ Checking Chromium Executable Paths...\n');

let foundPath = null;
chromiumPaths.forEach(path => {
  const exists = fs.existsSync(path);
  const status = exists ? '✅ FOUND' : '❌ Not found';
  console.log(`   ${status}: ${path}`);
  if (exists && !foundPath) {
    foundPath = path;
  }
});

if (foundPath) {
  console.log(`\n✅ Chromium found at: ${foundPath}`);

  // Try to get version
  console.log('\n2️⃣ Checking Chromium Version...\n');
  try {
    const version = execSync(`${foundPath} --version`, { encoding: 'utf8' }).trim();
    console.log(`   ✅ ${version}`);
  } catch (error) {
    console.log(`   ⚠️  Could not get version: ${error.message}`);
  }
} else {
  console.log('\n❌ No Chromium executable found!\n');
  console.log('📋 Installation Instructions:\n');
  console.log('   sudo apt-get update');
  console.log('   sudo apt-get install -y chromium-browser');
  console.log('\n   Or:');
  console.log('   sudo apt-get install -y chromium\n');
}

// Check Puppeteer installation
console.log('\n3️⃣ Checking Puppeteer Installation...\n');

try {
  const puppeteer = require('puppeteer');
  console.log('   ✅ Puppeteer is installed');

  // Check if Puppeteer has bundled Chromium
  try {
    const executablePath = puppeteer.executablePath();
    console.log(`   ✅ Puppeteer bundled Chromium at: ${executablePath}`);
    if (fs.existsSync(executablePath)) {
      console.log('   ✅ Bundled Chromium exists and is accessible');
    } else {
      console.log('   ❌ Bundled Chromium path exists but file not found');
    }
  } catch (error) {
    console.log('   ⚠️  No bundled Chromium found');
    console.log('   💡 Install with: npm install puppeteer');
  }
} catch (error) {
  console.log('   ❌ Puppeteer not installed');
}

// Try to launch browser
console.log('\n4️⃣ Testing Browser Launch...\n');

(async () => {
  try {
    const puppeteer = require('puppeteer');

    console.log('   Attempting to launch browser...');

    const browser = await puppeteer.launch({
      headless: 'new',
      executablePath: foundPath, // Use system Chromium if found
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });

    console.log('   ✅ Browser launched successfully!');

    const version = await browser.version();
    console.log(`   ✅ Browser version: ${version}`);

    await browser.close();
    console.log('   ✅ Browser closed successfully');

    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS! Chromium is working properly!');
    console.log('='.repeat(60));
    console.log('\n🎉 Transcript feature should work now!\n');

  } catch (error) {
    console.log('   ❌ Failed to launch browser');
    console.log(`   Error: ${error.message}\n`);

    console.log('='.repeat(60));
    console.log('❌ CHROMIUM NOT WORKING');
    console.log('='.repeat(60));
    console.log('\n📋 Fix Instructions:\n');

    if (error.message.includes('Could not find Chrome')) {
      console.log('   1. Install Chromium:');
      console.log('      sudo apt-get update');
      console.log('      sudo apt-get install -y chromium-browser\n');
    } else if (error.message.includes('Failed to launch')) {
      console.log('   1. Install dependencies:');
      console.log('      sudo apt-get install -y chromium-browser \\');
      console.log('        libgbm1 libnss3 libatk-bridge2.0-0 libgtk-3-0 \\');
      console.log('        libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2\n');
    }

    console.log('   2. Or install Puppeteer with bundled Chromium:');
    console.log('      npm install puppeteer\n');

    console.log('   3. Restart your application:');
    console.log('      pm2 restart chatbot-backend\n');
  }
})();
