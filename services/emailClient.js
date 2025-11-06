// services/emailClient.js
const FROM_EMAIL = process.env.RESEND_FROM;

async function sendEmail({ to, subject, text }) {
  if (!to?.length) {
    console.warn("sendEmail skipped: no recipients");
    return;
  }
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing");
    return;
  }
  if (!FROM_EMAIL) {
    console.error("NOTIFY_FROM missing");
    return;
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, text }),
  });

  let body;
  try { body = await resp.json(); } catch { body = await resp.text(); }

  if (!resp.ok) {
    console.error("❌ Resend failed:", resp.status, body);
  } else {
    console.log("✅ Resend ok:", body);
  }
}

module.exports = { sendEmail };
