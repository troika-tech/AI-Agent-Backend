const express = require("express");
const router = express.Router();
const otpController = require("../controllers/otpController");
const { validate } = require("../middleware/validation");
const otpSchemas = require("../schemas/otp");

router.post("/request-otp", validate(otpSchemas.requestOtp), otpController.requestOtp);
router.post("/verify-otp", validate(otpSchemas.verifyOtp), otpController.verifyOtp);
router.get("/check-session", validate(otpSchemas.checkSession), otpController.checkSession);

module.exports = router;
    
