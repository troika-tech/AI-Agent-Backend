const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key";
const TOKEN_EXPIRY = "24h"; // 24 hours

/**
 * Generates a JWT token with 24-hour expiry
 * @param {Object} payload - The payload to encode in the token
 * @param {string} payload.userId - The user ID
 * @param {string} payload.phone - The user's phone number
 * @param {string} payload.chatbotId - The chatbot ID
 * @returns {Object} Token information including token, timestamps, and expiry
 */
function generateToken(payload) {
  const { userId, phone, chatbotId } = payload;

  if (!phone) {
    throw new Error("Phone number is required for token generation");
  }

  const issuedAt = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const expiresIn = 24 * 60 * 60; // 24 hours in seconds
  const expiresAt = issuedAt + expiresIn;

  // Create JWT payload
  const jwtPayload = {
    userId: userId || `user_${phone}`,
    phone,
    chatbotId,
    iat: issuedAt,
    exp: expiresAt,
  };

  // Sign the token
  const token = jwt.sign(jwtPayload, JWT_SECRET);

  return {
    token,
    expiresIn, // in seconds (86400)
    issuedAt: issuedAt * 1000, // Convert to milliseconds for frontend
    expiresAt: expiresAt * 1000, // Convert to milliseconds for frontend
  };
}

/**
 * Verifies and decodes a JWT token
 * @param {string} token - The JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Token has expired");
    } else if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token");
    } else {
      throw new Error("Token verification failed");
    }
  }
}

/**
 * Decodes a JWT token without verification (useful for inspecting expired tokens)
 * @param {string} token - The JWT token to decode
 * @returns {Object} Decoded token payload
 */
function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
};
