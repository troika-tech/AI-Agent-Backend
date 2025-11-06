const axios = require('axios');

jest.mock('axios');

// Mock Chatbot model
jest.mock('../models/Chatbot', () => ({
  findById: jest.fn(),
}));

// Mock queryService retrieveRelevantChunks
jest.mock('../services/queryService', () => ({
  retrieveRelevantChunks: jest.fn(),
}));

// Mock languageService
jest.mock('../services/languageService', () => ({
  processQuery: jest.fn(),
  processResponse: jest.fn(),
}));

const Chatbot = require('../models/Chatbot');
const { retrieveRelevantChunks } = require('../services/queryService');
const languageService = require('../services/languageService');

// Import after mocks so it picks them up
const { generateAnswer } = require('../services/chatService');

describe('chatService.generateAnswer unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: Chatbot persona exists
    Chatbot.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ persona_text: 'You are a helpful assistant persona.' }),
    });

    // Default: language service indicates no translation needed
    languageService.processQuery.mockResolvedValue({ needsTranslation: false, language: 'en' });
    languageService.processResponse.mockResolvedValue({ translatedResponse: 'ترجمة' });

    // Default: axios returns a normal response
    axios.post.mockResolvedValue({
      data: {
        choices: [{ message: { content: 'Here is the answer.' } }],
        usage: { total_tokens: 42 },
      },
    });
  });

  it('handles affirmative flow with KB retrieval and no translation', async () => {
    retrieveRelevantChunks.mockResolvedValue([
      { content: 'KB info 1' },
      { content: 'KB info 2' },
    ]);

    const history = [
      { role: 'bot', content: 'Would you like more details about our pricing plans? [KBQ: pricing plan tiers]' },
      { role: 'user', content: 'tell me more' },
    ];

    const result = await generateAnswer(
      'Yes',
      ['Some relevant context chunk with sufficient length to pass filter ................'],
      {},
      history,
      'bot-1',
      undefined,
      false
    );

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(retrieveRelevantChunks).toHaveBeenCalledWith('pricing plan tiers', 'bot-1', 3, 0.7);
    expect(result).toMatchObject({ answer: 'Here is the answer.', tokens: 42, assistantMessageForHistory: 'Here is the answer.', kbFollowUpQuery: null });
  });

  it('continues on KB retrieval error (affirmative path)', async () => {
    retrieveRelevantChunks.mockRejectedValue(new Error('KB down'));

    const res = await generateAnswer(
      'yeah',
      ['Context chunk that is long enough to be included ..............................'],
      {},
      [{ role: 'bot', content: 'Do you want details about returns?' }],
      'bot-2'
    );

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(res.answer).toBe('Here is the answer.');
    expect(res.assistantMessageForHistory).toBe('Here is the answer.');
  });

  it('returns move-on message on negative input and does not call OpenAI', async () => {
    const res = await generateAnswer(
      'nope',
      ['context chunk ..............................'],
      {},
      [{ role: 'bot', content: 'Would you like to proceed?' }],
      'bot-3'
    );
    expect(axios.post).not.toHaveBeenCalled();
    expect(res.tokens).toBe(0);
    expect(res.answer).toMatch(/What would you like to talk about next\?/);
    expect(res.assistantMessageForHistory).toMatch(/What would you like to talk about next\?/);
  });

  it('main path: translates response when original query is Arabic', async () => {
    languageService.processQuery.mockResolvedValue({ needsTranslation: true, language: 'ar' });
    languageService.processResponse.mockResolvedValue({ translatedResponse: 'هذا هو الجواب.' });

    const res = await generateAnswer(
      'مرحبا كيف اشتري؟',
      ['طول كافٍ من النص ليتم اعتباره سياقاً مفيداً .................................'],
      {},
      [],
      'bot-4'
    );

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(languageService.processResponse).toHaveBeenCalledWith('Here is the answer.', 'ar');
    expect(res).toEqual({ answer: 'هذا هو الجواب.', tokens: 42, originalLanguage: 'ar', assistantMessageForHistory: 'Here is the answer.', kbFollowUpQuery: null });
  });

  it('uses fallback persona when Chatbot.findById throws', async () => {
    Chatbot.findById.mockImplementation(() => ({
      lean: jest.fn().mockRejectedValue(new Error('DB fail')),
    }));

    const res = await generateAnswer(
      'Tell me about the service',
      ['context chunk that is sufficiently long to include in prompt ..................'],
      {},
      [],
      'bot-5'
    );
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(res.answer).toBe('Here is the answer.');
    expect(res.assistantMessageForHistory).toBe('Here is the answer.');
  });

  it('handles axios error in follow-up (affirmative) with friendly message', async () => {
    axios.post.mockRejectedValueOnce(new Error('OpenAI down'));

    const res = await generateAnswer(
      'ok',
      ['A long enough context chunk to pass the filter ...............................'],
      {},
      [{ role: 'bot', content: 'Would you like the steps to integrate?' }],
      'bot-6'
    );

    expect(res.tokens).toBe(0);
    expect(res.answer).toMatch(/couldn't retrieve the details/i);
    expect(res.assistantMessageForHistory).toMatch(/couldn't retrieve the details/i);
  });

  it('handles axios error in main path with friendly message', async () => {
    // First call is for this test; ensure rejection
    axios.post.mockRejectedValueOnce(new Error('OpenAI down'));

    const res = await generateAnswer(
      'What plans do you have?',
      ['This is a sufficiently long context chunk to include in prompt ..............'],
      {},
      [],
      'bot-7'
    );

    expect(res.tokens).toBe(0);
    expect(res.answer).toMatch(/having trouble right now/i);
    expect(res.assistantMessageForHistory).toMatch(/having trouble right now/i);
  });

  it('builds prompt with product feature enabled and long history (dedupe + trim)', async () => {
    const longHistory = [];
    for (let i = 0; i < 12; i++) {
      // include some duplicates to exercise dedupe
      longHistory.push({ role: i % 2 === 0 ? 'user' : 'bot', content: 'repeat-me' });
      longHistory.push({ role: i % 2 === 0 ? 'bot' : 'user', content: `unique-${i}` });
    }

    const res = await generateAnswer(
      'Show me options',
      [
        'First long context chunk with enough characters to be considered relevant......',
        'Second long context chunk with enough characters to be considered relevant.....',
      ],
      {},
      longHistory,
      'bot-8',
      'Product A, Product B',
      true
    );

    expect(axios.post).toHaveBeenCalledTimes(1);
    // We can at least ensure the normal success shape
    expect(res.answer).toBe('Here is the answer.');
    expect(res.assistantMessageForHistory).toBe('Here is the answer.');
    expect(res.tokens).toBe(42);
  });

  it('falls back to default context when cleanedChunks is empty', async () => {
    const res = await generateAnswer(
      'Explain returns',
      // Provide short/noisy chunks that will be filtered out by length check
      ['short', 'tiny', 'small', '...'],
      {},
      [],
      'bot-9'
    );

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(res.answer).toBe('Here is the answer.');
    expect(res.assistantMessageForHistory).toBe('Here is the answer.');
  });
});
