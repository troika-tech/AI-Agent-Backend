const crypto = require('crypto');

jest.mock('../lib/embed', () => ({
  getEmbeddings: jest.fn(async (chunks) => chunks.map((_, i) => Array(3).fill(i + 0.1))),
  EMBEDDING_MODEL: 'text-embedding-3-small',
}));

const { storeContextChunks } = require('../services/contextService');

jest.mock('../models/Embedding', () => ({
  find: jest.fn(),
  bulkWrite: jest.fn(),
}));

const Embedding = require('../models/Embedding');
const { getEmbeddings, EMBEDDING_MODEL } = require('../lib/embed');

function hashFor(content, chatbotId) {
  return crypto.createHash('sha256').update(`${content}|${chatbotId ?? ''}`).digest('hex');
}

function mockFindOnce(result) {
  Embedding.find.mockImplementationOnce(() => ({
    lean: jest.fn().mockResolvedValue(result),
  }));
}

describe('contextService.storeContextChunks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns [] when no chunks', async () => {
    const res = await storeContextChunks([], null);
    expect(res).toEqual([]);
    expect(Embedding.find).not.toHaveBeenCalled();
  });

  it('upserts new chunks with embeddings, setting model and status', async () => {
    const chatbotId = 'bot-123';
    const hashes = [hashFor('x', chatbotId), hashFor('y', chatbotId)];

    mockFindOnce([]); // existing hashes
    mockFindOnce([
      { _id: '1', content: 'x', hash: hashes[0], chatbot_id: chatbotId, company_id: chatbotId, embedding: Array(3).fill(0.1), model: EMBEDDING_MODEL, status: 'ready' },
      { _id: '2', content: 'y', hash: hashes[1], chatbot_id: chatbotId, company_id: chatbotId, embedding: Array(3).fill(1.1), model: EMBEDDING_MODEL, status: 'ready' },
    ]);

    Embedding.bulkWrite.mockResolvedValueOnce({});

    const res = await storeContextChunks(['x', 'y'], chatbotId);

    expect(getEmbeddings).toHaveBeenCalledWith(['x', 'y']);
    expect(Embedding.bulkWrite).toHaveBeenCalledTimes(1);
    const ops = Embedding.bulkWrite.mock.calls[0][0];
    expect(ops).toHaveLength(2);
    expect(ops[0].updateOne.filter).toEqual({ chatbot_id: chatbotId, hash: hashes[0] });
    expect(ops[0].updateOne.update.$set.model).toBe(EMBEDDING_MODEL);
    expect(ops[0].updateOne.update.$set.status).toBe('ready');
    expect(ops[0].updateOne.update.$set.embedding_length).toBe(3);
    expect(ops[0].updateOne.update.$set.company_id).toBe(chatbotId);

    expect(res).toHaveLength(2);
    expect(res[0].hash).toBe(hashes[0]);
    expect(res[0].model).toBe(EMBEDDING_MODEL);
    expect(res[0].status).toBe('ready');
  });

  it('skips chunks already stored for chatbot', async () => {
    const chatbotId = 'bot-123';
    const existingHash = hashFor('dup', chatbotId);

    mockFindOnce([{ hash: existingHash }]);

    const res = await storeContextChunks(['dup'], chatbotId);

    expect(res).toEqual([]);
    expect(getEmbeddings).not.toHaveBeenCalled();
    expect(Embedding.bulkWrite).not.toHaveBeenCalled();
  });
});
