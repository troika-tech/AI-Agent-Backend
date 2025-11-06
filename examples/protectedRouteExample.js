/**
 * Example: Protected Route Implementation with JWT Authentication
 *
 * This file demonstrates how to protect routes using the JWT authentication middleware.
 * Copy and adapt these patterns to your actual routes.
 */

const express = require("express");
const router = express.Router();
const { authenticateJWT, optionalAuthenticateJWT } = require("../middleware/jwtAuthMiddleware");

// ============================================
// Example 1: Fully Protected Route
// ============================================
// Requires valid JWT token - returns 401 if missing or invalid
router.get("/user/profile", authenticateJWT, async (req, res) => {
  try {
    // User data is available in req.user after authentication
    const { userId, phone, chatbotId } = req.user;

    // Fetch user-specific data from database
    // const userProfile = await UserModel.findById(userId);

    res.json({
      success: true,
      user: {
        userId,
        phone,
        chatbotId,
      },
      message: "Profile retrieved successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Example 2: Protected POST Route
// ============================================
// Update user settings - requires authentication
router.post("/user/settings", authenticateJWT, async (req, res) => {
  try {
    const { userId, phone } = req.user;
    const { settings } = req.body;

    // Update user settings in database
    // await UserSettings.findOneAndUpdate(
    //   { userId },
    //   { $set: settings }
    // );

    res.json({
      success: true,
      message: "Settings updated successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Example 3: Optional Authentication
// ============================================
// Public route that provides different responses based on auth status
router.get("/content/recommendations", optionalAuthenticateJWT, async (req, res) => {
  try {
    if (req.user) {
      // User is authenticated - provide personalized recommendations
      const { userId, chatbotId } = req.user;

      res.json({
        success: true,
        recommendations: [
          "Personalized recommendation 1",
          "Personalized recommendation 2",
        ],
        personalized: true
      });
    } else {
      // User is not authenticated - provide generic recommendations
      res.json({
        success: true,
        recommendations: [
          "Generic recommendation 1",
          "Generic recommendation 2",
        ],
        personalized: false
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Example 4: Multiple Middleware Chain
// ============================================
// Combine JWT auth with other middleware
const validateRequest = (req, res, next) => {
  if (!req.body.message) {
    return res.status(400).json({
      success: false,
      error: "Message is required"
    });
  }
  next();
};

router.post("/chat/send", authenticateJWT, validateRequest, async (req, res) => {
  try {
    const { userId, phone, chatbotId } = req.user;
    const { message } = req.body;

    // Process chat message
    // const response = await processChatMessage(message, chatbotId);

    res.json({
      success: true,
      message: "Message sent successfully",
      data: {
        sender: phone,
        chatbotId,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Example 5: Token Refresh Check
// ============================================
// Check if user's token is still valid
router.get("/auth/check", authenticateJWT, (req, res) => {
  const { exp, iat } = req.user;
  const now = Math.floor(Date.now() / 1000);
  const timeLeft = exp - now;

  res.json({
    success: true,
    valid: true,
    expiresIn: timeLeft,
    issuedAt: iat * 1000,
    expiresAt: exp * 1000
  });
});

// ============================================
// Example 6: User-Specific Data Access
// ============================================
// Ensure users can only access their own data
router.get("/user/conversations/:conversationId", authenticateJWT, async (req, res) => {
  try {
    const { userId, phone } = req.user;
    const { conversationId } = req.params;

    // Verify the conversation belongs to this user
    // const conversation = await Conversation.findOne({
    //   _id: conversationId,
    //   phone: phone  // Ensure user owns this conversation
    // });

    // if (!conversation) {
    //   return res.status(403).json({
    //     success: false,
    //     error: "Access denied - conversation not found or not owned by user"
    //   });
    // }

    res.json({
      success: true,
      conversation: {
        id: conversationId,
        owner: phone
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
