// lib/normalizeAza.js
const crypto = require('crypto');

function pickImage(images = [], rawGallery = []) {
  if ((!images || images.length === 0) && Array.isArray(rawGallery) && rawGallery.length) {
    images = rawGallery.map(g => (typeof g === 'string' ? g.split('|')[0] : null)).filter(Boolean);
  }
  if (!images || images.length === 0) return null;
  const preferred = images.find(u => u.includes('/tr:w-450/')) || images.find(u => u.includes('/tr:w-100/'));
  return preferred || images[0];
}

function normalizeAzaToMinimal(p = {}) {
  const rawPriceHint = p.rawPriceHint || {};
  const productId = String(p.productId || p.product_id || rawPriceHint?.product_id || rawPriceHint?.id || '').trim();
  const title = (p.title || rawPriceHint?.name || '').trim();
  const productUrl = p.url || (rawPriceHint && rawPriceHint.url ? `https://www.azafashions.com${rawPriceHint.url}` : '');

  const price_from = p.price ? Number(p.price) : 0;
  const image = pickImage(p.image ? [p.image] : (p.images || []), rawPriceHint?.gallery || []);
  const description = (p.description || rawPriceHint?.primary_name || rawPriceHint?.name || '').trim();

  const available_sizes = Array.isArray(p.available_sizes) ? p.available_sizes : [];

  const hashSource = `${title || ''}||${description || ''}`;
  const searchTokensHash = crypto.createHash('md5').update(hashSource).digest('hex');

  const embedding = Array.isArray(p.embedding) ? p.embedding : [];

  return {
    productId,
    title,
    productUrl,
    image,
    price_from: Number(price_from || 0),
    currency: p.currency || 'INR',
    in_stock: !!p.in_stock,
    available_sizes,
    description,
    searchTokensHash,
    embedding,
    scrapedAt: p.scrapedAt ? new Date(p.scrapedAt) : new Date()
  };
}

module.exports = normalizeAzaToMinimal;
