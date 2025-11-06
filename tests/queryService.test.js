jest.mock('../services/vectorSearch', () => ({
  vectorSearchByText: jest.fn(async ({ text, chatbotId, k }) => ({
    results: [
      { content: 'low', score: 0.5, chatbot_id: chatbotId, language: 'en' },
      { content: 'high', score: 0.9, chatbot_id: chatbotId, language: 'en' },
    ],
    meta: { path: 'fusion-primary', counts: { vector: 2, text: 0 } },
  })),
}));

const { retrieveRelevantChunks } = require('../services/queryService');
const { vectorSearchByText } = require('../services/vectorSearch');

describe('queryService.retrieveRelevantChunks', () => {
  it('filters by minScore and returns high-scoring chunks only', async () => {
    const chatbotId = '0123456789abcdef01234567';
    const res = await retrieveRelevantChunks('hi', chatbotId, 6, 0.75);
    expect(vectorSearchByText).toHaveBeenCalledWith({ text: 'hi', chatbotId: chatbotId, k: 6, fields: ['content', 'chatbot_id', 'language'] });
    expect(Array.isArray(res)).toBe(true);
    expect(res).toHaveLength(1);
    expect(res[0].content).toBe('high');
  });
});
