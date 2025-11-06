// Shared product-related mocks for chat tests

jest.mock('../../services/productIntentService', () => ({
  isProductQuery: jest.fn(async () => false),
  extractProductFilters: jest.fn(async () => ({})),
}));

jest.mock('../../services/productSearchService', () => ({
  searchProducts: jest.fn(async () => ({ results: [] })),
}));
