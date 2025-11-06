const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const OtpRateLimit = require("../models/OtpRateLimit");
const NewUserOtpVerification = require("../models/NewUserOtpVerification");

// Mock email service to prevent actual emails from being sent
jest.mock("../services/emailService", () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(true),
}));

// Mock WhatsApp service to prevent actual messages from being sent
jest.mock("../utils/sendWhatsAppOtp", () => ({
  sendWhatsAppOtp: jest.fn().mockResolvedValue(true),
}));

describe("OTP Rate Limiting", () => {
  const testEmail = "test@example.com";
  const testPhone = "+1234567890";

  beforeAll(async () => {
    // Ensure database connection is established
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/test", {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
    }
  });

  afterAll(async () => {
    // Clean up and close database connection
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear rate limit and OTP records before each test
    await OtpRateLimit.deleteMany({});
    await NewUserOtpVerification.deleteMany({});
  });

  describe("Email OTP Rate Limiting", () => {
    it("should allow the first OTP request", async () => {
      const response = await request(app)
        .post("/api/otp/request-otp")
        .send({ email: testEmail });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("OTP sent successfully");
      expect(response.body.attemptsRemaining).toBe(2);
      expect(response.body.maxAttempts).toBe(3);
    });

    it("should track attempts correctly", async () => {
      // First request
      await request(app).post("/api/otp/request-otp").send({ email: testEmail });

      // Wait 1 second to avoid "OTP already sent recently" error
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await NewUserOtpVerification.deleteMany({ email: testEmail });

      // Second request
      const response2 = await request(app)
        .post("/api/otp/request-otp")
        .send({ email: testEmail });

      expect(response2.status).toBe(200);
      expect(response2.body.attemptsRemaining).toBe(1);
    });

    it("should block after 3 attempts within 24 hours", async () => {
      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        await request(app).post("/api/otp/request-otp").send({ email: testEmail });
        await new Promise((resolve) => setTimeout(resolve, 100));
        await NewUserOtpVerification.deleteMany({ email: testEmail });
      }

      // Fourth request should be blocked
      const response = await request(app)
        .post("/api/otp/request-otp")
        .send({ email: testEmail });

      expect(response.status).toBe(429);
      expect(response.body.message).toContain("Rate limit exceeded");
      expect(response.body.attemptsRemaining).toBe(0);
      expect(response.body.resetTime).toBeDefined();
    });

    it("should reset after 24 hours", async () => {
      // Create a rate limit record with expired window
      const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      await OtpRateLimit.create({
        email: testEmail,
        attempts: 3,
        windowStart: yesterday,
        lastAttempt: yesterday,
      });

      // Request should succeed after window reset
      const response = await request(app)
        .post("/api/otp/request-otp")
        .send({ email: testEmail });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("OTP sent successfully");
      expect(response.body.attemptsRemaining).toBe(2);
    });

    it("should rollback attempt count on send failure", async () => {
      const { sendOtpEmail } = require("../services/emailService");
      sendOtpEmail.mockResolvedValueOnce(false);

      const response = await request(app)
        .post("/api/otp/request-otp")
        .send({ email: testEmail });

      expect(response.status).toBe(500);

      // Check that attempt was not counted
      const rateLimit = await OtpRateLimit.findOne({ email: testEmail });
      expect(rateLimit.attempts).toBe(0);
    });
  });

  describe("Phone OTP Rate Limiting", () => {
    it("should allow the first OTP request", async () => {
      const response = await request(app)
        .post("/api/otp/request-otp")
        .send({ phone: testPhone });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain("OTP sent successfully");
      expect(response.body.attemptsRemaining).toBe(2);
    });

    it("should block after 3 attempts within 24 hours", async () => {
      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        await request(app).post("/api/otp/request-otp").send({ phone: testPhone });
        await new Promise((resolve) => setTimeout(resolve, 100));
        await NewUserOtpVerification.deleteMany({ phone: testPhone });
      }

      // Fourth request should be blocked
      const response = await request(app)
        .post("/api/otp/request-otp")
        .send({ phone: testPhone });

      expect(response.status).toBe(429);
      expect(response.body.message).toContain("Rate limit exceeded");
      expect(response.body.attemptsRemaining).toBe(0);
    });
  });

  describe("WhatsApp OTP Rate Limiting", () => {
    it("should allow the first OTP request", async () => {
      const response = await request(app)
        .post("/api/whatsapp-otp/send")
        .send({ phone: testPhone, chatbotId: "507f1f77bcf86cd799439011" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.attemptsRemaining).toBe(2);
    });

    it("should block after 3 attempts within 24 hours", async () => {
      const chatbotId = "507f1f77bcf86cd799439011";

      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post("/api/whatsapp-otp/send")
          .send({ phone: testPhone, chatbotId });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Fourth request should be blocked
      const response = await request(app)
        .post("/api/whatsapp-otp/send")
        .send({ phone: testPhone, chatbotId });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain("Rate limit exceeded");
      expect(response.body.attemptsRemaining).toBe(0);
    });
  });

  describe("Independent Rate Limiting", () => {
    it("should track email and phone separately", async () => {
      // Request OTP for email
      const emailResponse = await request(app)
        .post("/api/otp/request-otp")
        .send({ email: testEmail });
      expect(emailResponse.body.attemptsRemaining).toBe(2);

      // Request OTP for phone (should have separate counter)
      const phoneResponse = await request(app)
        .post("/api/otp/request-otp")
        .send({ phone: testPhone });
      expect(phoneResponse.body.attemptsRemaining).toBe(2);

      // Both should have separate rate limit records
      const emailRateLimit = await OtpRateLimit.findOne({ email: testEmail });
      const phoneRateLimit = await OtpRateLimit.findOne({ phone: testPhone });

      expect(emailRateLimit.attempts).toBe(1);
      expect(phoneRateLimit.attempts).toBe(1);
    });
  });
});
