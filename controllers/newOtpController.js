const crypto = require("node:crypto"); // for simple 6-digit OTP generation (no hashing)
const NewUserOtpVerification = require("../models/NewUserOtpVerification");
const NewUserSession = require("../models/newUserSession");
const OtpRateLimit = require("../models/OtpRateLimit");
const { sendOtpEmail } = require("../services/emailService");
const { sendWhatsAppOtp } = require("../utils/sendWhatsAppOtp");
const { isOtpFresh } = require("../utils/otpHelpers");
const { normEmail, normPhone } = require("../utils/objectHelpers");
const { validateBody } = require("../utils/validationHelpers");

// --- Config (lightweight) ---
const OTP_TTL_MINUTES = 10; // must match the TTL in the model (created_at expires: "10m")
const SESSION_VALIDITY_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_OTP_ATTEMPTS = 3; // Maximum OTP requests per 24-hour window
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Special case: Phone numbers exempt from rate limiting
const RATE_LIMIT_EXEMPT_PHONES = ["9834699858"];

// --- Helpers ---
const now = () => new Date();

// Check if phone number is exempt from rate limiting
const isRateLimitExempt = (phone) => {
    if (!phone) return false;
    // Normalize phone number by removing all non-digit characters
    const normalizedPhone = phone.replace(/\D/g, "");
    return RATE_LIMIT_EXEMPT_PHONES.some(exemptPhone =>
        normalizedPhone.endsWith(exemptPhone) || normalizedPhone === exemptPhone
    );
};

// isOtpFresh moved to utils/otpHelpers.js

// --- 1) REQUEST OTP (Email or Phone) ---
exports.requestOtp = async (req, res) => {
    try {
        const email = normEmail(req.body.email);
        const phone = normPhone(req.body.phone);

        if (!email && !phone) {
            return res.status(400).json({ message: "Email or phone number is required" });
        }

        const identifier = email ? { email } : { phone };

        console.log("OTP request:", identifier);

        // Skip rate limiting for exempt phone numbers
        const isExempt = phone && isRateLimitExempt(phone);
        if (isExempt) {
            console.log(`Rate limit bypassed for exempt phone: ${phone}`);
        }

        // Check rate limiting (skip for exempt numbers)
        const currentTime = now();
        let rateLimit = !isExempt ? await OtpRateLimit.findOne(identifier) : null;

        if (rateLimit) {
            // Check if the 24-hour window has expired
            const windowExpired = currentTime - rateLimit.windowStart >= RATE_LIMIT_WINDOW_MS;

            if (windowExpired) {
                // Reset the window and attempts
                rateLimit.windowStart = currentTime;
                rateLimit.attempts = 0;
                rateLimit.lastAttempt = currentTime;
            } else if (rateLimit.attempts >= MAX_OTP_ATTEMPTS) {
                // Rate limit exceeded
                const timeRemaining = RATE_LIMIT_WINDOW_MS - (currentTime - rateLimit.windowStart);
                const hoursRemaining = Math.ceil(timeRemaining / (60 * 60 * 1000));

                return res.status(429).json({
                    message: `Rate limit exceeded. You have requested OTP ${MAX_OTP_ATTEMPTS} times in the last 24 hours. Please try again in ${hoursRemaining} hour(s).`,
                    attemptsRemaining: 0,
                    resetTime: new Date(rateLimit.windowStart.getTime() + RATE_LIMIT_WINDOW_MS)
                });
            }

            // Increment attempts
            rateLimit.attempts += 1;
            rateLimit.lastAttempt = currentTime;
            await rateLimit.save();
        } else {
            // Create new rate limit record
            rateLimit = await OtpRateLimit.create({
                ...identifier,
                attempts: 1,
                windowStart: currentTime,
                lastAttempt: currentTime,
            });
        }

        console.log(`Rate limit check passed. Attempts: ${rateLimit.attempts}/${MAX_OTP_ATTEMPTS}`);

        // Mild rate-limit: if an unexpired OTP exists, don't send a new one yet.
        const existing = await NewUserOtpVerification.findOne(identifier);
        if (existing && isOtpFresh(existing)) {
            return res
                .status(429)
                .json({
                    message: "OTP already sent recently. Please wait before retrying.",
                    attemptsRemaining: MAX_OTP_ATTEMPTS - rateLimit.attempts
                });
        }

        // Simple 6-digit OTP (no heavy security)
        const otp = crypto.randomInt(100000, 1000000).toString();

        // Upsert OTP doc (resets created_at so TTL counts from now)
        await NewUserOtpVerification.findOneAndUpdate(
            identifier,
            { ...identifier, otp, created_at: Date.now() },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        // Try sending OTT via email or WhatsApp
        // in requestOtp
        console.log("OTP request:", identifier);
        let sentSuccessfully = false;
        try {
            if (email) {
                sentSuccessfully = await sendOtpEmail(email, otp);
            } else {
                sentSuccessfully = await sendWhatsAppOtp(phone, otp);
            }
            console.log("OTP send result:", sentSuccessfully);
        } catch (e) {
            console.error("OTP send error:", e);
            sentSuccessfully = false;
        }
        if (!sentSuccessfully) {
            await NewUserOtpVerification.deleteOne(identifier);
            // Rollback rate limit attempt on send failure (only if not exempt)
            if (rateLimit) {
                rateLimit.attempts -= 1;
                await rateLimit.save();
            }
            return res.status(500).json({ message: "Failed to send OTP" });
        }

        // For exempt numbers, don't include rate limit info in response
        if (isExempt) {
            return res.json({
                message: `OTP sent successfully to ${email || phone}`
            });
        }

        const attemptsRemaining = MAX_OTP_ATTEMPTS - rateLimit.attempts;
        return res.json({
            message: `OTP sent successfully to ${email || phone}`,
            attemptsRemaining,
            maxAttempts: MAX_OTP_ATTEMPTS
        });
    } catch (error) {
        console.error("Error requesting OTP:", error);
        return res.status(500).json({ message: "Failed to send OTP" });
    }
};

// --- 2) VERIFY OTP (Email or Phone + chatbotId) ---
exports.verifyOtp = async (req, res) => {
    if (!validateBody(req, res)) return;

    try {
        const email = normEmail(req.body.email);
        const phone = normPhone(req.body.phone);
        const { otp, chatbotId } = req.body;

        if ((!email && !phone) || !otp || !chatbotId) {
            return res.status(400).json({ message: "Identifier, OTP, and Chatbot ID are required" });
        }

        const identifier = email ? { email } : { phone };
        const record = await NewUserOtpVerification.findOne(identifier);

        // Check presence, TTL (via created_at), and match
        if (!record || !isOtpFresh(record) || record.otp !== otp) {
            return res.status(400).json({ message: "OTP is incorrect or has expired" });
        }

        // Create/update session for this chatbot
        const sessionIdentifier = email
            ? { email, chatbot_id: chatbotId }
            : { phone, chatbot_id: chatbotId };

        const sessionData = { ...sessionIdentifier };
        const session = await NewUserSession.findOneAndUpdate(
            sessionIdentifier,
            { $set: sessionData },
            {
                upsert: true,
                new: true,
                runValidators: true,
                setDefaultsOnInsert: true,
            }
        );

        // Clean up used OTP
        await NewUserOtpVerification.deleteOne(identifier);

        return res.json({
            success: true,
            sessionId: session._id,
            message: "Verification successful",
        });
    } catch (error) {
        console.error("Error verifying OTP:", error);
        return res.status(500).json({ message: "Server error during verification" });
    }
};

// --- 3) CHECK SESSION (Email or Phone + chatbotId) ---
exports.checkSession = async (req, res) => {
    try {
        const email = normEmail(req.query.email);
        const phone = normPhone(req.query.phone);
        const { chatbotId } = req.query;

        if ((!email && !phone) || !chatbotId) {
            return res
                .status(400)
                .json({ isValid: false, message: "Identifier and chatbotId are required" });
        }

        const query = email
            ? { chatbot_id: chatbotId, email }
            : { chatbot_id: chatbotId, phone };

        const session = await NewUserSession.findOne(query);

        if (!session) {
            return res.status(200).json({ isValid: false, message: "No active session found" });
        }

        // 6-hour validity window from the last write (updatedAt)
        const isExpired = now() - session.updatedAt > SESSION_VALIDITY_MS;
        if (isExpired) {
            return res.status(200).json({ isValid: false, message: "Session expired" });
        }

        return res.status(200).json({
            isValid: true,
            sessionId: session._id,
            message: "Valid session",
        });
    } catch (error) {
        console.error("Error checking session:", error);
        return res.status(500).json({ isValid: false, message: "Server error" });
    }
};
