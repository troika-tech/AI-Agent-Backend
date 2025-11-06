jest.mock('../lib/embed', () => ({
  getEmbedding: jest.fn(async () => Array(1536).fill(0.01)),
}));

jest.mock('../services/languageService', () => ({
  detectLanguage: jest.fn(async () => 'en'),
}));

const mongoose = require('mongoose');
const { vectorSearch, vectorSearchByText } = require('../services/vectorSearch');
const { getEmbedding } = require('../lib/embed');
const languageService = require('../services/languageService');

function mockAggregateSequence(responses = []) {
  const queue = [...responses];
  const aggregate = jest.fn(() => ({
    toArray: jest.fn(async () => (queue.length ? queue.shift() : [])),
  }));
  const collection = jest.fn(() => ({ aggregate }));
  jest.spyOn(mongoose, 'connection', 'get').mockReturnValue({ db: { collection } });
  return { aggregate, collection };
}

describe('vectorSearch helpers', () => {
  beforeEach(() => {
    process.env.RETRIEVAL_DISABLE_FUSION = 'true';
    process.env.RETRIEVAL_DISABLE_KEYWORD = 'true';
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    delete process.env.RETRIEVAL_DISABLE_FUSION;
    delete process.env.RETRIEVAL_DISABLE_KEYWORD;
  });

  test('vectorSearch builds pipeline with chatbot filter and returns results', async () => {
    const docs = [[{ _id: 'x1', content: 'hello', language: 'en', chatbot_id: 'abc123', score: 0.9 }]];
    const { collection, aggregate } = mockAggregateSequence(docs);

    const res = await vectorSearch({ chatbotId: 'abc123', vector: [0.1, 0.2, 0.3], k: 5, fields: ['content'] });

    expect(collection).toHaveBeenCalledWith('embeddingchunks');
    expect(aggregate).toHaveBeenCalled();
    expect(res).toEqual([{ _id: 'x1', content: 'hello', language: 'en', chatbot_id: 'abc123', score: 0.9, vectorScore: 0.9 }]);
  });

  test('vectorSearch returns [] when vector is empty', async () => {
    mockAggregateSequence([]);
    const res = await vectorSearch({ chatbotId: 'abc123', vector: [] });
    expect(res).toEqual([]);
  });

  test('vectorSearchByText embeds query and returns fused results', async () => {
    const vectorDocs = [[{ _id: 'x2', content: 'world', language: 'en', chatbot_id: 'abc123', score: 0.8 }]];
    mockAggregateSequence(vectorDocs);

    const response = await vectorSearchByText({ text: 'hi', chatbotId: 'abc123', k: 4 });

    expect(getEmbedding).toHaveBeenCalledWith('hi');
    expect(languageService.detectLanguage).toHaveBeenCalledWith('hi');
    expect(Array.isArray(response.results)).toBe(true);
    expect(response.results[0]._id).toBe('x2');
    expect(response.meta.path).toBeDefined();
  });
});
