const express = require('express');
const router = express.Router();
const otpController = require('../controllers/newOtpController');

// A single route to request an OTP via any method
router.post("/request-otp", otpController.requestOtp);

// A single route to verify an OTP from any method
router.post("/verify-otp", otpController.verifyOtp);

router.get("/check-session", otpController.checkSession);

module.exports = router;
