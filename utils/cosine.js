// utils/cosine.js
// Lightweight cosine similarity utilities for arrays of numbers

function dot(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += (a[i] || 0) * (b[i] || 0);
  return s;
}

function norm(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] || 0) ** 2;
  return Math.sqrt(s) || 0;
}

function cosineSimilarity(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  return dot(a, b) / (na * nb);
}

module.exports = { cosineSimilarity };
