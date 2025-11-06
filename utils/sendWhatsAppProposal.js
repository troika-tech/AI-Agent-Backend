// utils/sendWhatsAppProposal.js
// Send service proposal via WhatsApp using AiSensy API
// This utility handles sending tailored proposals for Troika Tech services
// Requirements:
// - AISENSY_API_KEY: API key for AiSensy
// - AISENSY_ORG_SLUG: Organization slug (defaults to "troika-tech-services")
// - AISENSY_SENDER_NAME: Sender name for WhatsApp messages
// - AISENSY_COUNTRY_CODE: Country code (defaults to "91" for India)
//
// Usage:
//   const sendProposal = require('./sendWhatsAppProposal');
//   await sendProposal({
//     phone: '9876543210',
//     serviceName: 'AI Supa Agent'
//   });
//
// Returns: { ok: boolean, status?: number, data?: any, error?: string }

const axios = require('axios');
const logger = require('./logger');

/**
 * Normalize phone number to international format
 * @param {string} phoneRaw - Raw phone number from various sources
 * @param {string} countryCode - Country code (default: "91")
 * @returns {object} - { valid: boolean, normalized?: string, error?: string }
 */
function normalizePhoneNumber(phoneRaw, countryCode = '91') {
  if (!phoneRaw) {
    return { valid: false, error: 'Phone number is required' };
  }

  // Extract digits only
  let digits = String(phoneRaw).replace(/\D/g, '');

  // If longer than 12, try to capture last 10
  if (digits.length > 12 && /\d{10}$/.test(digits)) {
    digits = digits.slice(-10);
  }

  // Build destination
  let destination = '';
  if (digits.length === 10) {
    destination = `${countryCode}${digits}`;
  } else if (digits.length === 12 && digits.startsWith(countryCode)) {
    destination = digits;
  } else {
    return { valid: false, error: 'Invalid phone number format. Expected 10 digits or 12 digits with country code.' };
  }

  return { valid: true, normalized: destination };
}

/**
 * Send WhatsApp proposal for a selected service
 * @param {object} params - Parameters for sending proposal
 * @param {string} params.phone - Phone number (10 digits or with country code)
 * @param {string} params.serviceName - Name of the service (e.g., "AI Supa Agent")
 * @returns {Promise<object>} - Result object with ok, status, data, or error
 */
async function sendWhatsAppProposal({ phone, serviceName }) {
  const apiKey = process.env.AISENSY_API_KEY;
  const orgSlug = process.env.AISENSY_ORG_SLUG || 'troika-tech-services';
  const sender = process.env.AISENSY_SENDER_NAME || 'Troika Tech Services';
  const countryCode = (process.env.AISENSY_COUNTRY_CODE || '91').replace('+', '');
  const campaignName = 'proposalsending';

  // Validate API key
  if (!apiKey) {
    logger.error('Missing AISENSY_API_KEY in environment variables');
    return { ok: false, error: 'WhatsApp API configuration missing' };
  }

  // Validate service name
  if (!serviceName) {
    return { ok: false, error: 'Service name is required' };
  }

  // Normalize phone number
  const phoneResult = normalizePhoneNumber(phone, countryCode);
  if (!phoneResult.valid) {
    logger.warn(`Phone normalization failed: ${phoneResult.error}`);
    return { ok: false, error: phoneResult.error };
  }

  const destination = phoneResult.normalized;

  // Build payload matching frontend structure
  const payload = {
    apiKey,
    campaignName,
    destination,
    userName: sender,
    templateParams: ['$FirstName'],
    paramsFallbackValue: { FirstName: serviceName },
    source: 'new-landing-page form',
    media: {},
    buttons: [],
    carouselCards: [],
    location: {},
    attributes: {}
  };

  const url = `https://backend.api-wa.co/campaign/${orgSlug}/api/v2`;

  try {
    logger.info(`📤 Sending proposal for "${serviceName}" to ${destination}`);

    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    logger.info(`✅ Proposal sent successfully to ${destination}`);
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      data: res.data
    };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const message = data?.message || err.message;

    logger.error('❌ WhatsApp proposal send error:', {
      status,
      message,
      data,
      destination,
      serviceName
    });

    return {
      ok: false,
      status,
      error: message,
      data
    };
  }
}

module.exports = sendWhatsAppProposal;
