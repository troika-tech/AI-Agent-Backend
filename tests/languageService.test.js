jest.mock('franc-min', () => ({
  franc: jest.fn(() => 'ara'),
}));

const languageService = require('../services/languageService');

describe('languageService', () => {
  it('detects Arabic and sets needsTranslation', async () => {
    const result = await languageService.processQuery('\u0643\u0645 \u0627\u0644\u0633\u0639\u0631\u061f');
    expect(result.language).toBe('ar');
    expect(result.needsTranslation).toBe(true);
    expect(result.translatedQuery).toBe('what is the price');
  });

  it('processResponse translates to Arabic when original language is ar', async () => {
    const response = await languageService.processResponse('Here are the products found', 'ar');
    expect(response.translatedResponse).toMatch(/[\u0600-\u06FF]/);
  });
});
