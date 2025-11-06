// utils/validationHelpers.js
// Generic normalization and validation helpers

function normStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

// Builds a MongoDB filter to match empty or missing values for a field
const emptyOrMissing = (field) => ({
  $or: [{ [field]: null }, { [field]: { $exists: false } }, { [field]: "" }],
});

// Validates request body and returns 400 if malformed
function validateBody(req, res) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'Request body must be a valid JSON object' });
    return false;
  }
  return true;
}

module.exports = {
  normStr,
  emptyOrMissing,
  validateBody,
};
