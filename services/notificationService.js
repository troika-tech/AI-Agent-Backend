// services/notificationService.js
const { sendEmail } = require("./emailClient");

function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (data[k] ?? ""));
}

function humanizeProvider(p) {
  if (!p) return "";
  const map = {
    "email-otp": "Email OTP",
    "whatsapp-otp": "WhatsApp OTP",
    google: "Google Sign-In",
    facebook: "Facebook Login",
    instagram: "Instagram Login",
  };
  return map[p.toLowerCase()] || p.charAt(0).toUpperCase() + p.slice(1);
}

async function notifyNewUser({ settings, user, context }) {
  if (!settings?.email?.enabled) return;

  // normalize recipients
  const to = (settings.email.recipients || [])
    .map(e => (e || "").trim())
    .filter(Boolean);

  if (to.length === 0) return; // nothing to send to

  const subject =
    settings.email.subjectTemplate?.trim() || "New user authenticated";

  const defaultBody =
`A new user has signed in.

User: {{user}}
Provider: {{provider}}
IP: {{ip}}
When: {{time}}`;

  const bodyTemplate = (settings.email.bodyTemplate || "").trim() || defaultBody;

  // ensure we have an ISO string time
  const when = (() => {
    const t = context?.time instanceof Date ? context.time : new Date(context?.time || Date.now());
    try { return t.toISOString(); } catch { return new Date().toISOString(); }
  })();

  const body = render(bodyTemplate, {
    user: user?.email || user?.phone || "Unknown",
    provider: humanizeProvider(user?.provider),
    ip: (context?.ip || "").toString(),
    time: when,
  });

  await sendEmail({ to, subject, text: body });
}

module.exports = { notifyNewUser };
