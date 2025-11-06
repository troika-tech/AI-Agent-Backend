// utils/chunkText.js

function chunkText(text, chunkSize = 300, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(" ");
    if (chunk.length > 0) chunks.push(chunk);
  }

  return chunks;
}

module.exports = chunkText;
