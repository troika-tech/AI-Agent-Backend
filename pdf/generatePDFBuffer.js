const path = require("path");
const ejs = require("ejs");
const puppeteer = require("puppeteer");

const generatePDFBuffer = async (data, template = "template.ejs") => {
  let browser;
  try {
    console.log('[PDF] Generating PDF with template:', template);
    console.log('[PDF] Data keys:', Object.keys(data || {}));

    const templatePath = path.join(__dirname, template);
    console.log('[PDF] Template path:', templatePath);

    const html = await ejs.renderFile(templatePath, data);
    console.log('[PDF] HTML rendered successfully, length:', html.length);

    // Puppeteer launch options for server environments
    const launchOptions = {
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ],
    };

    // Try to find Chrome/Chromium executable on Linux servers
    const fs = require('fs');
    const possiblePaths = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      '/snap/bin/chromium',
      process.env.PUPPETEER_EXECUTABLE_PATH,
      process.env.CHROME_BIN
    ].filter(Boolean);

    for (const execPath of possiblePaths) {
      if (fs.existsSync(execPath)) {
        console.log('[PDF] Found Chrome/Chromium at:', execPath);
        launchOptions.executablePath = execPath;
        break;
      }
    }

    console.log('[PDF] Launching browser with options:', launchOptions);
    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    console.log('[PDF] PDF generated successfully, size:', pdfBuffer.length);
    await browser.close();
    return pdfBuffer;
  } catch (error) {
    console.error('[PDF] Error generating PDF:', error.message);
    console.error('[PDF] Error stack:', error.stack);

    // Provide helpful error messages
    if (error.message.includes('Failed to launch') || error.message.includes('browser process')) {
      console.error('[PDF] Browser launch failed. Install Chrome/Chromium:');
      console.error('[PDF]   Ubuntu/Debian: sudo apt-get install chromium-browser');
      console.error('[PDF]   Or set PUPPETEER_EXECUTABLE_PATH environment variable');
    }

    if (browser) {
      await browser.close().catch(err => console.error('[PDF] Error closing browser:', err));
    }
    throw error;
  }
};

module.exports = generatePDFBuffer;
