const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { 
  getOverallReport,
  getGuestMessageAnalytics,
  getGuestMessages,
  exportGuestMessages
} = require("../controllers/reportController");
const { protect, restrictTo } = require("../middleware/authMiddleware");
const generatePDFBuffer = require("../pdf/historyPDFBuffer");
const Resend = require("resend").Resend;
const { validateBody } = require("../utils/validationHelpers");

const resend = new Resend(process.env.RESEND_API_KEY);
const from = process.env.RESEND_FROM;

// Validate Email Format
const validateEmail = (email) => {
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return regex.test(email);
};

// Validate Chat History Structure
const validateChatHistory = (chatHistory) => {
  if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
    return false;
  }
  
  return chatHistory.every(msg => 
    msg && 
    typeof msg === 'object' &&
    typeof msg.sender === 'string' && 
    typeof msg.text === 'string' &&
    msg.sender.trim() !== '' &&
    msg.text.trim() !== ''
  );
};

router.get("/overall", protect, restrictTo("admin"), getOverallReport);

// 🎯 Guest Message Analytics Routes
router.get("/guest-analytics", protect, restrictTo("admin"), getGuestMessageAnalytics);
router.get("/guest-messages", protect, restrictTo("admin"), getGuestMessages);
router.get("/guest-messages/export", protect, restrictTo("admin"), exportGuestMessages);

router.post("/send-chat-pdf", async (req, res) => {
  if (!validateBody(req, res)) return;

  try {
    const { chatHistory, email } = req.body;

    // Enhanced validation
    if (!validateChatHistory(chatHistory)) {
      return res.status(400).json({
        error: "Invalid chat history format. Each message must have 'sender' and 'text' properties."
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        error: "Invalid email format."
      });
    }

    // Sanitize chat history to prevent potential issues
    const sanitizedChatHistory = chatHistory.map(msg => ({
      sender: String(msg.sender).trim(),
      text: String(msg.text).trim()
    }));

    console.log(`Processing ${sanitizedChatHistory.length} messages for PDF generation`);

    // Generate PDF Buffer
    const pdfBuffer = await generatePDFBuffer({ messages: sanitizedChatHistory });

    // Log the PDF buffer to verify its content
    console.log("Generated PDF size:", pdfBuffer.length, "bytes");
    console.log("Is Buffer valid?", Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0);

    // Validate if the PDF buffer is valid before proceeding with email
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      console.error("Invalid PDF buffer generated");
      return res.status(500).json({
        error: "Failed to generate PDF. Please try again."
      });
    }

    // Optional: Save for debugging in development environment
    if (process.env.NODE_ENV === 'development') {
      const debugPath = path.join(process.cwd(), "debug.pdf");
      fs.writeFileSync(debugPath, pdfBuffer);
      console.log(`PDF saved for debugging at: ${debugPath}`);
    }

    // Send the email with the PDF attachment
    const emailResponse = await resend.emails.send({
      from: from,
      to: email,
      subject: "Your Chat Summary",
      text: "Please find your chat summary attached as a PDF.",
      html: `
        <p>Hello,</p>
        <p>Please find your chat summary attached as a PDF.</p>
        <p>Best regards,<br>Supa Agent</p>
      `,
      attachments: [
        {
          filename: "chat-summary.pdf",
          content: pdfBuffer,
          type: 'application/pdf',
        },
      ],
    });

    // Log the email response for debugging
    console.log("Email sent successfully. Response ID:", emailResponse.id);

    // Respond back to the client
    res.status(200).json({
      success: true,
      message: "Email sent successfully!",
      emailId: emailResponse.id
    });

  } catch (err) {
    console.error("Failed to send chat PDF:", err.message);
    console.error("Stack trace:", err.stack);
    
    // Provide more specific error messages
    let errorMessage = "Failed to send email.";
    if (err.message.includes("PDF")) {
      errorMessage = "Failed to generate PDF from chat history.";
    } else if (err.message.includes("email") || err.message.includes("resend")) {
      errorMessage = "Failed to send email. Please check your email address.";
    }
    
    res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;
