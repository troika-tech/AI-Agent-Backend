// Standalone JWT tests without database dependencies
const { generateToken, verifyToken, decodeToken } = require("../utils/jwtHelper");

console.log("🧪 Running JWT Helper Tests...\n");

function test(description, fn) {
  try {
    fn();
    console.log(`✅ PASS: ${description}`);
  } catch (error) {
    console.log(`❌ FAIL: ${description}`);
    console.log(`   Error: ${error.message}\n`);
  }
}

function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected}, but got ${actual}`);
      }
    },
    toHaveProperty: (prop, value) => {
      if (!(prop in actual)) {
        throw new Error(`Expected to have property ${prop}`);
      }
      if (value !== undefined && actual[prop] !== value) {
        throw new Error(`Expected ${prop} to be ${value}, but got ${actual[prop]}`);
      }
    },
    toThrow: (expectedMessage) => {
      try {
        actual();
        throw new Error("Expected function to throw an error");
      } catch (error) {
        if (expectedMessage && !error.message.includes(expectedMessage)) {
          throw new Error(
            `Expected error message to include "${expectedMessage}", but got "${error.message}"`
          );
        }
      }
    },
  };
}

const mockPayload = {
  userId: "test_user_123",
  phone: "+1234567890",
  chatbotId: "chatbot_abc",
};

// Test 1: Generate token with 24-hour expiry
test("should generate a valid JWT token with 24-hour expiry", () => {
  const result = generateToken(mockPayload);

  expect(result).toHaveProperty("token");
  expect(result).toHaveProperty("expiresIn", 86400);
  expect(result).toHaveProperty("issuedAt");
  expect(result).toHaveProperty("expiresAt");

  const expectedExpiry = result.issuedAt + 86400000;
  expect(result.expiresAt).toBe(expectedExpiry);
});

// Test 2: Correct payload in JWT
test("should include correct payload in JWT token", () => {
  const result = generateToken(mockPayload);
  const decoded = decodeToken(result.token);

  expect(decoded.userId).toBe(mockPayload.userId);
  expect(decoded.phone).toBe(mockPayload.phone);
  expect(decoded.chatbotId).toBe(mockPayload.chatbotId);
  expect(decoded).toHaveProperty("iat");
  expect(decoded).toHaveProperty("exp");
});

// Test 3: Verify valid token
test("should verify a valid token", () => {
  const result = generateToken(mockPayload);
  const verified = verifyToken(result.token);

  expect(verified.userId).toBe(mockPayload.userId);
  expect(verified.phone).toBe(mockPayload.phone);
  expect(verified.chatbotId).toBe(mockPayload.chatbotId);
});

// Test 4: Throw error when phone is missing
test("should throw error when phone is missing", () => {
  const invalidPayload = {
    userId: "test_user_123",
    chatbotId: "chatbot_abc",
  };

  expect(() => generateToken(invalidPayload)).toThrow(
    "Phone number is required for token generation"
  );
});

// Test 5: Throw error for invalid token
test("should throw error for invalid token", () => {
  expect(() => verifyToken("invalid.token.here")).toThrow("Invalid token");
});

// Test 6: Generate userId from phone if not provided
test("should generate userId from phone if not provided", () => {
  const payloadWithoutUserId = {
    phone: "+1234567890",
    chatbotId: "chatbot_abc",
  };

  const result = generateToken(payloadWithoutUserId);
  const decoded = decodeToken(result.token);

  expect(decoded.userId).toBe("user_+1234567890");
});

// Test 7: Decode token without verification
test("should decode token without verification", () => {
  const result = generateToken(mockPayload);
  const decoded = decodeToken(result.token);

  if (!decoded || decoded.phone !== mockPayload.phone) {
    throw new Error("Token decoding failed");
  }
});

// Test 8: Verify token response structure matches requirements
test("should match the required response structure", () => {
  const result = generateToken(mockPayload);

  // Verify we have all required fields
  expect(result).toHaveProperty("token");
  expect(result).toHaveProperty("expiresIn");
  expect(result).toHaveProperty("issuedAt");
  expect(result).toHaveProperty("expiresAt");

  // Verify expiresIn is 24 hours (86400 seconds)
  expect(result.expiresIn).toBe(86400);

  // Verify timestamps are in correct format (milliseconds)
  if (result.issuedAt < 1000000000000 || result.expiresAt < 1000000000000) {
    throw new Error("Timestamps should be in milliseconds");
  }
});

console.log("\n🎉 All JWT tests completed!");
