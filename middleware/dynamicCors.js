// middleware/dynamicCors.js
const Company = require("../models/Company");

// Required CORS origins for Capacitor Android APK
const CAPACITOR_ORIGINS = [
  'capacitor://localhost',        // Main Capacitor scheme
  'https://localhost',            // HTTPS fallback
  'http://localhost',             // HTTP fallback
  'capacitor://android',          // Alternative Android scheme
  'https://android',              // Alternative HTTPS
  'http://android',               // Alternative HTTP
  'file://',                      // File protocol (if used)
  'https://api.0804.in',          // Production API domain
  'http://localhost:5173',        // Development server
  'https://localhost:5173'        // Development HTTPS
];

let cachedOrigins = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function dynamicCorsOptions(req, callback) {
  try {
    // Allow all origins
    callback(null, { origin: true, credentials: true });
  } catch (error) {
    console.error("Dynamic CORS Error:", error.message);
    callback(error);
  }
}

module.exports = dynamicCorsOptions;
