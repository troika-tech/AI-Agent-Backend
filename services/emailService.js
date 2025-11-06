// services/emailService.js
const { Resend } = require("resend");
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendOtpEmail(email, otp) {
  try {
    // Basic sanity logs (remove in prod)
      if (!process.env.RESEND_API_KEY) {
        logger.error("❌ RESEND_API_KEY missing");
        return false;
      }
      if (!process.env.RESEND_FROM) {
        logger.error("❌ RESEND_FROM missing");
        return false;
    }

    const payload = {
      from: process.env.RESEND_FROM, // e.g. "Supa Agent <no-reply@yourdomain.com>"
      to: email,
      subject: "Your OTP to use Supa Agent",
      html: `
        <p>Hey there! 👋</p>
        <p>Your OTP is <strong>${otp}</strong>. It’s valid for 10 minutes.</p>
      `,
    };

    const resp = await resend.emails.send(payload);

    // Newer SDKs: { data, error }
    if (resp?.error) {
    logger.error("❌ Resend error:", resp.error);
    return false;
    }
    if (resp?.data?.id) {
    logger.info("✅ Resend queued id:", resp.data.id);
      return true;
    }

    // Older SDKs might return { id } or throw on error
    if (resp?.id) {
      logger.info("✅ Resend queued id:", resp.id);
      return true;
    }

    logger.error("❌ Unknown Resend response:", resp);
    return false;
  } catch (err) {
    // If SDK throws (network/env), catch here
    logger.error("❌ sendOtpEmail exception:", err?.response?.data || err?.message || err);
    return false;
  }
}

async function sendWhatsAppMarketingProposal(email) {
  try {
    // Check if Resend is configured
    if (!resend) {
      logger.error("❌ RESEND_API_KEY missing");
      return false;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <p>Hi,</p>

        <p>Thanks for the consideration of our WhatsApp Marketing Services.</p>

        <h3 style="color:rgb(0, 0, 0);">Why Troika Tech's WhatsApp Services?</h3>

        <p>Troika has been offering WhatsApp Marketing & Promotional services, Since 2014.</p>

        <p>You will get a <strong>Free Panel</strong>, <strong>Complimentary Premium Database</strong> with <strong>Zero Maintenance and Setup Fees</strong>.</p>

        <p><strong>Retail Rate:</strong> 60 Paisa Per Message</p>

        <h3 style="color:rgb(0, 0, 0);">WhatsApp Marketing Plans:-</h3>

        <ul>
          <li><strong>Buy 2 Lac WhatsApp messages, Get 1 Lac Free</strong>, Package Rate <strong>INR 1,20,000/-</strong> Plus GST (@40 Paisa Per Message)</li>
          <li><strong>Buy 3 Lac WhatsApp messages, Get 2 Lac Free</strong>, Package Rate <strong>INR 1,80,000/-</strong> Plus GST (@36 Paisa Per Message)</li>
          <li><strong>Buy 5 Lac WhatsApp messages, Get 5 Lac Free</strong>, Package Rate <strong>INR 3,00,000/-</strong> Plus GST (@30 Paisa Per Message)</li>
        </ul>

        <p><em>For any Quantity above 10 Lacs Messages we have Special Discounts.</em></p>

        <h3 style="color:rgb(0, 0, 0);">How does Troika Tech's WhatsApp Marketing work?</h3>

        <ol>
          <li>Messages will be sent from Virtual Numbers</li>
          <li>It's a One-Way Messaging Platform</li>
          <li>Super-Powerful Web Based System</li>
          <li>Prepaid Recharge Service with No Restriction</li>
          <li>Perfect for Branding, Promotions and Marketing</li>
        </ol>

        <h3 style="color:rgb(0, 0, 0);">Let's try Free Demo:-</h3>

        <p><strong>Demo Panel Credentials (Try on Desktop or Laptop)</strong></p>

        <p>
          <strong>Login url:</strong> <a href="https://troikaplus.io/premium/">https://troikaplus.io/premium/</a><br>
          <strong>Username:</strong> premiumdemo<br>
          <strong>Password:</strong> TY_L8762025543210
        </p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

        <p>
          <strong>Company Profile & Presentation:</strong> <a href="https://troikatech.in/company-profile/">https://troikatech.in/company-profile/</a><br>
          <strong>Client List:</strong> <a href="https://troikatech.in/brands/">https://troikatech.in/brands/</a><br>
          <strong>Frequently Asked Questions:</strong> <a href="https://troikatech.in/faqs/">https://troikatech.in/faqs/</a>
        </p>

        <h3 style="color:rgb(0, 0, 0);">Experience the Power of Instant Support & Service with Best WhatsApp Marketing Offers!</h3>

        <p style="font-size: 18px; font-weight: bold; color:rgb(0, 0, 0);">Don't Wait, Start Promotion's Now!</p>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

        <p style="margin-top: 20px;">
          <strong>Thanks & Regards,</strong><br>
          <strong>Troika Tech Services</strong><br>
          ☎️: 9821211755 | 9821211741<br>
          📧: <a href="mailto:info@troikatech.net">info@troikatech.net</a><br>
          💻: <a href="https://troikatech.in">https://troikatech.in</a>
        </p>
      </div>
    `;

    const payload = {
      from: process.env.RESEND_FROM,
      to: email,
      subject: "WhatsApp Marketing & Promotional Services, CTA Proposal",
      html: htmlContent,
    };

    const resp = await resend.emails.send(payload);

    // Check response
    if (resp?.error) {
      logger.error("❌ Marketing email Resend error:", resp.error);
      return false;
    }
    if (resp?.data?.id || resp?.id) {
      logger.info("✅ Marketing proposal sent, id:", resp.data?.id || resp.id);
      return true;
    }

    logger.error("❌ Unknown Resend response for marketing email:", resp);
    return false;
  } catch (err) {
    logger.error("❌ sendWhatsAppMarketingProposal exception:", err?.response?.data || err?.message || err);
    return false;
  }
}

const logger = require('../utils/logger');
module.exports = { sendOtpEmail, sendWhatsAppMarketingProposal };
