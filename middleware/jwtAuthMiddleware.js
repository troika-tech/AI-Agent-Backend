const { verifyToken } = require("../utils/jwtHelper");

/**
 * Middleware to verify JWT tokens from Authorization header
 * Attaches decoded user data to req.user if valid
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: "Authorization header missing",
    });
  }

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      success: false,
      error: "Invalid authorization header format. Expected: Bearer <token>",
    });
  }

  const token = parts[1];

  try {
    const decoded = verifyToken(token);

    // Attach user info to request object
    req.user = {
      userId: decoded.userId,
      phone: decoded.phone,
      chatbotId: decoded.chatbotId,
      iat: decoded.iat,
      exp: decoded.exp,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error.message || "Token verification failed",
    });
  }
}

/**
 * Optional JWT middleware - doesn't fail if token is missing
 * Useful for routes that work with or without authentication
 */
function optionalAuthenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return next();
  }

  const token = parts[1];

  try {
    const decoded = verifyToken(token);
    req.user = {
      userId: decoded.userId,
      phone: decoded.phone,
      chatbotId: decoded.chatbotId,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch (error) {
    // Silently fail for optional auth
  }

  next();
}

module.exports = {
  authenticateJWT,
  optionalAuthenticateJWT,
};
