// utils/objectHelpers.js
// Small object helpers used in controllers/services

function pick(obj = {}, allowed = []) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => allowed.includes(k)));
}

function normEmail(v) {
  return v ? String(v).trim().toLowerCase() : undefined;
}

function normPhone(v) {
  return v ? String(v).replace(/\s+/g, '') : undefined;
}

module.exports = { pick, normEmail, normPhone };
