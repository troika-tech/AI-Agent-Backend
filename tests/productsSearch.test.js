const request = require('supertest');
process.env.NODE_ENV = 'test';
process.env.TEST_ROUTES = '/api/products';

// Mock the embedding service to avoid external API
jest.mock('../lib/embed', () => ({
  getEmbedding: jest.fn(async () => Array(1536).fill(0.01)),
  getEmbeddings: jest.fn(async (arr) => arr.map(() => Array(1536).fill(0.01))),
}));

const app = require('../app');
const Product = require('../models/AzaModel');

describe('Products Search', () => {
  beforeEach(async () => {
    const items = [
      {
        productId: 'SKU1',
        title: 'Red Dress',
        description: 'Elegant red evening dress',
        url: 'https://shop.example.com/red',
        image: 'red.jpg',
        price: 'â‚¹ 5,000',
        priceNum: 5000,
        currency: 'INR',
        in_stock: true,
        available_sizes: ['S','M'],
        colors: ['red'],
        searchText: 'red dress elegant evening',
        embedding: Array(1536).fill(0.02),
      },
      {
        productId: 'SKU2',
        title: 'Blue Shirt',
        description: 'Casual blue cotton shirt',
        url: 'https://shop.example.com/blue',
        image: 'blue.jpg',
        price: 'â‚¹ 1,200',
        priceNum: 1200,
        currency: 'INR',
        in_stock: true,
        available_sizes: ['M','L'],
        colors: ['blue'],
        searchText: 'blue shirt casual cotton',
        embedding: Array(1536).fill(0.03),
      }
    ];
    await Product.insertMany(items);
  });

  afterAll(() => {
    delete process.env.TEST_ROUTES;
  });

  it('GET /api/products/search?q=red -> returns product_cards with Red Dress', async () => {
    const res = await request(app).get('/api/products/search').query({ q: 'red dress', semantic: 'false' });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('product_cards');
    expect(Array.isArray(res.body.products)).toBe(true);
    const titles = res.body.products.map(p => p.title);
    expect(titles.join(' ')).toMatch(/red|dress/i);
  });

  it('GET /api/products/search?productId=SKU2 -> returns exact match', async () => {
    const res = await request(app).get('/api/products/search').query({ productId: 'SKU2' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].productId).toBe('SKU2');
  });
});


