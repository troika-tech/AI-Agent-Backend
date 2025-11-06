// utils/textCleaner.js

function stripHtml(text) {
  if (!text || typeof text !== "string") return text || "";
  // Replaces HTML tags with a space
  return text.replace(/<\/?[^>]+(>|$)/g, " ");
}

function stripMarkdown(text) {
  if (!text || typeof text !== "string") return text || "";
  // Replaces markdown like **, *, __, etc., with a space
  return text.replace(/([_*~`]){1,3}/g, ' ');
}

function removeListMarkers(text) {
  if (!text || typeof text !== "string") return text || "";
  // Matches "1.", "2.", etc., even if there's no space after the dot.
  // Also matches bullet points like * or - at the start of a line.
  // The 'm' flag is for multiline matching.
  const pattern = /\b\d+\.\s*|^[-*•‣⁃·•]\s*/gm; 
  return text.replace(pattern, "");
}

function removeHashSymbols(text) {
  if (!text || typeof text !== "string") return text || "";
  // Remove hash symbols and currency symbols that might be read as "hash" by TTS
  return text.replace(/[#₹]/g, ' ');
}

function normalizeSpaces(text) {
    if (!text || typeof text !== "string") return text || "";
    // Collapse multiple spaces/newlines into a single space and trim
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * The main function that combines all cleaning steps for TTS.
 * The order of operations is important.
 * @param {string} text - The raw text from the AI.
 * @returns {string} - The cleaned text ready for TTS.
 */
function cleanInputText(text) {
  if (!text) return "";

  let cleaned = text;

  cleaned = stripHtml(cleaned);
  cleaned = stripMarkdown(cleaned);
  cleaned = removeListMarkers(cleaned);
  cleaned = removeHashSymbols(cleaned); // Remove hash and currency symbols
  cleaned = normalizeSpaces(cleaned); // This runs last to clean up any leftover extra spaces.

  return cleaned;
}

module.exports = { cleanInputText };
