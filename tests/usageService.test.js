jest.mock('../models/Chatbot', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const Chatbot = require('../models/Chatbot');
const { checkAndUpdateUsage } = require('../services/usageService');

describe('usageService.checkAndUpdateUsage', () => {
  beforeEach(() => {
    Chatbot.findOne.mockReset();
    Chatbot.findOneAndUpdate.mockReset();
  });

  it('throws when chatbot not found', async () => {
    Chatbot.findOne.mockResolvedValue(null);
    await expect(checkAndUpdateUsage('id1')).rejects.toThrow('Chatbot not found');
  });

  it('throws when disabled', async () => {
    Chatbot.findOne.mockResolvedValue({ status: 'disabled' });
    await expect(checkAndUpdateUsage('id2')).rejects.toThrow('Chatbot is disabled');
  });

  it('throws when monthly limit exceeded', async () => {
    Chatbot.findOne.mockResolvedValue({ status: 'active', monthlyUsed: 10, monthlyLimit: 10 });
    await expect(checkAndUpdateUsage('id3')).rejects.toThrow('Monthly limit exceeded');
  });

  it('updates usage on success', async () => {
    Chatbot.findOne.mockResolvedValue({ status: 'active', monthlyUsed: 1, monthlyLimit: 10 });
    Chatbot.findOneAndUpdate.mockResolvedValue({});
    await expect(checkAndUpdateUsage('id4')).resolves.toBeUndefined();
    expect(Chatbot.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'id4' },
      { $inc: { monthlyUsed: 1 } }
    );
  });
});
