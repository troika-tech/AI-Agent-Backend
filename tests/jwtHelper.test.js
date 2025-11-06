const { generateToken, verifyToken, decodeToken } = require("../utils/jwtHelper");

describe("JWT Helper Tests", () => {
  const mockPayload = {
    userId: "test_user_123",
    phone: "+1234567890",
    chatbotId: "chatbot_abc",
  };

  test("should generate a valid JWT token with 24-hour expiry", () => {
    const result = generateToken(mockPayload);

    expect(result).toHaveProperty("token");
    expect(result).toHaveProperty("expiresIn", 86400); // 24 hours in seconds
    expect(result).toHaveProperty("issuedAt");
    expect(result).toHaveProperty("expiresAt");

    // Verify expiresAt is 24 hours after issuedAt
    const expectedExpiry = result.issuedAt + 86400000; // 24 hours in ms
    expect(result.expiresAt).toBe(expectedExpiry);
  });

  test("should include correct payload in JWT token", () => {
    const result = generateToken(mockPayload);
    const decoded = decodeToken(result.token);

    expect(decoded.userId).toBe(mockPayload.userId);
    expect(decoded.phone).toBe(mockPayload.phone);
    expect(decoded.chatbotId).toBe(mockPayload.chatbotId);
    expect(decoded).toHaveProperty("iat");
    expect(decoded).toHaveProperty("exp");
  });

  test("should verify a valid token", () => {
    const result = generateToken(mockPayload);
    const verified = verifyToken(result.token);

    expect(verified.userId).toBe(mockPayload.userId);
    expect(verified.phone).toBe(mockPayload.phone);
    expect(verified.chatbotId).toBe(mockPayload.chatbotId);
  });

  test("should throw error when phone is missing", () => {
    const invalidPayload = {
      userId: "test_user_123",
      chatbotId: "chatbot_abc",
    };

    expect(() => generateToken(invalidPayload)).toThrow(
      "Phone number is required for token generation"
    );
  });

  test("should throw error for invalid token", () => {
    expect(() => verifyToken("invalid.token.here")).toThrow("Invalid token");
  });

  test("should generate userId from phone if not provided", () => {
    const payloadWithoutUserId = {
      phone: "+1234567890",
      chatbotId: "chatbot_abc",
    };

    const result = generateToken(payloadWithoutUserId);
    const decoded = decodeToken(result.token);

    expect(decoded.userId).toBe("user_+1234567890");
  });

  test("should decode token without verification", () => {
    const result = generateToken(mockPayload);
    const decoded = decodeToken(result.token);

    expect(decoded).toBeTruthy();
    expect(decoded.phone).toBe(mockPayload.phone);
  });
});
