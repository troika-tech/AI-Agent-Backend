/**
 * Manual Test Script for Auth Routes
 *
 * This script tests the auth endpoints manually without requiring the full test suite.
 * Run with: node tests/authRoutes.manual.test.js
 */

const { generateToken } = require("../utils/jwtHelper");

console.log("🧪 Testing Auth Routes Manually\n");
console.log("=" .repeat(60));

// ============================================
// Test 1: Generate a test token
// ============================================
console.log("\n📝 Test 1: Generate Test Token");
console.log("-".repeat(60));

const testPayload = {
  userId: "test_user_123",
  phone: "+1234567890",
  chatbotId: "test_chatbot_abc",
};

const tokenData = generateToken(testPayload);
console.log("✅ Token generated successfully");
console.log("Token:", tokenData.token.substring(0, 50) + "...");
console.log("Expires In:", tokenData.expiresIn, "seconds (24 hours)");
console.log("Issued At:", new Date(tokenData.issuedAt).toISOString());
console.log("Expires At:", new Date(tokenData.expiresAt).toISOString());

// ============================================
// Test 2: Show cURL commands for testing
// ============================================
console.log("\n\n🔧 Test 2: cURL Commands for Manual Testing");
console.log("-".repeat(60));

const baseUrl = process.env.BASE_URL || "http://localhost:5000";
const token = tokenData.token;

console.log("\n1️⃣  Validate Token:");
console.log(`
curl -X POST ${baseUrl}/api/auth/validate-token \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json"
`);

console.log("\n2️⃣  Check Status:");
console.log(`
curl -X GET ${baseUrl}/api/auth/status \\
  -H "Authorization: Bearer ${token}"
`);

console.log("\n3️⃣  Logout:");
console.log(`
curl -X POST ${baseUrl}/api/auth/logout \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json"
`);

console.log("\n4️⃣  Test Invalid Token:");
console.log(`
curl -X POST ${baseUrl}/api/auth/validate-token \\
  -H "Authorization: Bearer invalid.token.here" \\
  -H "Content-Type: application/json"
`);

console.log("\n5️⃣  Test Missing Token:");
console.log(`
curl -X POST ${baseUrl}/api/auth/validate-token \\
  -H "Content-Type: application/json"
`);

// ============================================
// Test 3: Test with fetch (if available)
// ============================================
if (typeof fetch !== 'undefined' || require.resolve('node-fetch')) {
  console.log("\n\n🌐 Test 3: Automated HTTP Tests");
  console.log("-".repeat(60));

  (async () => {
    try {
      // Only run if server is running
      const testUrl = `${baseUrl}/api/auth/status`;

      console.log("\n📡 Testing /api/auth/status endpoint...");
      console.log(`URL: ${testUrl}`);

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(() => null);

      if (response) {
        const data = await response.json();
        console.log("✅ Status endpoint response:");
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log("⚠️  Server not running. Start the server to run HTTP tests:");
        console.log("   npm start");
      }
    } catch (error) {
      console.log("⚠️  Could not connect to server. Make sure it's running:");
      console.log("   npm start");
    }
  })();
}

// ============================================
// Test 4: Expected Responses
// ============================================
console.log("\n\n📋 Test 4: Expected Response Examples");
console.log("-".repeat(60));

console.log("\n✅ Valid Token Response:");
console.log(JSON.stringify({
  success: true,
  valid: true,
  userInfo: {
    userId: "test_user_123",
    phone: "+1234567890",
    chatbotId: "test_chatbot_abc"
  },
  issuedAt: tokenData.issuedAt,
  expiresAt: tokenData.expiresAt,
  remainingTime: 86400
}, null, 2));

console.log("\n❌ Invalid Token Response:");
console.log(JSON.stringify({
  success: false,
  error: "Invalid token"
}, null, 2));

console.log("\n🚪 Logout Response:");
console.log(JSON.stringify({
  success: true,
  message: "Logged out successfully"
}, null, 2));

// ============================================
// Summary
// ============================================
console.log("\n\n" + "=".repeat(60));
console.log("✅ Test token generated successfully!");
console.log("\n📌 Next Steps:");
console.log("   1. Start your server: npm start");
console.log("   2. Copy and run the cURL commands above");
console.log("   3. Verify responses match expected outputs");
console.log("   4. Test with your frontend application");
console.log("\n" + "=".repeat(60) + "\n");
