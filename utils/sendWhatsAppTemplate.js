// utils/sendWhatsAppTemplate.js
// Generic AiSensy template sender for transactional messages (stateless)
// Requirements:
// - AISENSY_API_KEY: API key string
// - AISENSY_ORG_SLUG: e.g., "troika-tech-services" used in the campaign URL
// - AISENSY_SENDER_NAME: Optional sender label for analytics (defaults to "Supa Agent")
// - AISENSY_COUNTRY_CODE: E.g., "91" for India (defaults to 91). Do not include +.
// - AISENSY_DEFAULT_CAMPAIGN: Optional default campaign/template name
//
// Usage:
//   const sendTemplate = require('./sendWhatsAppTemplate');
//   await sendTemplate({
//     phone: '9876543210',
//     campaignName: 'Appointment Confirmation',
//     templateParams: ['John', '25 Sep 2025, 3:00 PM', 'Dr. Smith'],
//   });
//
// Returns: { ok: boolean, status?: number, data?: any, error?: string }

const axios = require('axios');

async function sendWhatsAppTemplate({ phone, campaignName, templateParams = [], buttons = [], media = {}, attributes = {}, source = undefined, paramsFallbackValue = {} }) {
  const apiKey = process.env.AISENSY_API_KEY;
  const orgSlug = process.env.AISENSY_ORG_SLUG || 'troika-tech-services';
  const sender = process.env.AISENSY_SENDER_NAME || 'Supa Agent';
  const country = (process.env.AISENSY_COUNTRY_CODE || '91').replace('+', '');
  const defaultCampaign = process.env.AISENSY_DEFAULT_CAMPAIGN;

  if (!apiKey) {
    return { ok: false, error: 'Missing AISENSY_API_KEY' };
  }

  const resolvedCampaign = campaignName || defaultCampaign;
  if (!resolvedCampaign) {
    return { ok: false, error: 'Missing campaignName (and AISENSY_DEFAULT_CAMPAIGN not set)' };
  }

  if (!phone) {
    return { ok: false, error: 'Missing phone' };
  }

  // Expect phone as local/national without leading country code.
  // Strip any non-digits and remove leading zeros.
  const normalizedLocal = String(phone).replace(/\D/g, '').replace(/^0+/, '');
  const destination = `${country}${normalizedLocal}`;

  const payload = {
    apiKey,
    campaignName: resolvedCampaign,
    destination,
    userName: sender,
    templateParams,
    source: source || 'Supa Agent',
    media: media || {},
    buttons: buttons || [],
    carouselCards: [],
    location: {},
    attributes: attributes || {},
    paramsFallbackValue: paramsFallbackValue || {}
  };

  const url = `https://backend.api-wa.co/campaign/${orgSlug}/api/v2`;

  try {
    const res = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, data: res.data };
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const message = data?.message || err.message;
    console.error('❌ AiSensy template send error:', status, message, data);
    return { ok: false, status, error: message, data };
  }
}

module.exports = sendWhatsAppTemplate;
