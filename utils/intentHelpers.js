// utils/intentHelpers.js
function getMatchingIntentLink(query, linkIntents = []) {
  const lowerQuery = (query || "").toLowerCase();
  for (const intent of linkIntents) {
    for (const keyword of intent.keywords || []) {
      if (lowerQuery.includes(String(keyword).toLowerCase())) {
        return intent.link;
      }
    }
  }
  return null;
}

module.exports = { getMatchingIntentLink };
