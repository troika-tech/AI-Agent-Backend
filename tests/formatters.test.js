const { formatPrice, numberToIndianWords, rupeesToWords, replaceRupeesForTTS } = require('../utils/formatters');

describe('formatters', () => {
  it('formatPrice inserts commas and preserves ₹', () => {
    expect(formatPrice('₹1234567')).toBe('₹ 1,234,567');
    expect(formatPrice('1234567')).toBe('1,234,567');
  });

  it('numberToIndianWords covers lakhs and crores', () => {
    expect(numberToIndianWords(0)).toBe('zero');
    expect(numberToIndianWords(100000)).toMatch(/lakh/);
    expect(numberToIndianWords(10000000)).toMatch(/crore/);
  });

  it('rupeesToWords returns null for invalid and handles paise', () => {
    expect(rupeesToWords('abc')).toBeNull();
    expect(rupeesToWords('1,234', '5')).toBe('one thousand two hundred thirty four rupees and fifty paise');
    expect(rupeesToWords('1,234')).toBe('one thousand two hundred thirty four rupees');
  });

  it('replaceRupeesForTTS expands ₹ amounts into words', () => {
    const t = replaceRupeesForTTS('Price is ₹1,234.50 only');
    expect(t).toMatch(/rupees/);
    expect(t).not.toMatch(/₹/);
  });
});
