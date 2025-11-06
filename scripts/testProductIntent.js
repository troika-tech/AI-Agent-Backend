// scripts/testProductIntent.js
const { isProductQuery, extractProductFilters } = require('../services/productIntentService');
const { getClientConfig } = require('../services/configService');
const mongoose = require('mongoose');

async function main() {
  const chatbotId = process.argv[2] || '68bec1b89c8c40d6ab428b5d';
  const query = process.argv[3] || 'Show me a red lehenga under 20000';

  console.log('TEST INPUT:', { chatbotId, query });

  // test intent functions
  const productIntent = isProductQuery(query);
  const filters = extractProductFilters(query);
  console.log('isProductQuery ->', productIntent);
  console.log('extractProductFilters ->', filters);

  // optionally test clientConfig (requires DB connect inside getClientConfig)
  try {
    const cfg = await getClientConfig(chatbotId);
    console.log('clientConfig (fetched) ->', cfg ? { product_enabled: cfg.product_enabled, auth_method: cfg.auth_method } : null);
  } catch (e) {
    console.log('clientConfig fetch error ->', e.message || e);
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
