const { generateGuestAnalyticsHTML, generateOverallHTML } = require('../utils/reportHelpers');

describe('reportHelpers HTML generators', () => {
  test('generateGuestAnalyticsHTML includes summary metrics and list items', () => {
    const analytics = {
      period: '2025-01-01 to 2025-01-07',
      summary: {
        total_messages: 100,
        guest_messages: 30,
        authenticated_messages: 70,
        guest_percentage: 30,
        total_guest_sessions: 20,
        conversion_rate: 10,
      },
      daily_breakdown: [
        { _id: '2025-01-01', guest_messages: 5, authenticated_messages: 10 },
        { _id: '2025-01-02', guest_messages: 7, authenticated_messages: 9 },
      ],
      top_guest_queries: [
        { query: 'pricing', count: 5, unique_sessions: 3 },
        { query: 'features', count: 4, unique_sessions: 2 },
      ],
    };
    const html = generateGuestAnalyticsHTML(analytics);
    expect(html).toContain('Guest Message Analytics Report');
    expect(html).toContain(analytics.period);
    expect(html).toMatch(/Total Messages:\<\/div\>\s*<div class="metric-value">100/);
    expect(html).toContain('pricing');
    expect(html).toContain('features');
    expect(html).toContain('2025-01-01');
  });

  test('generateOverallHTML lists chatbot sections and message history', () => {
    const data = [
      {
        companyName: 'Co A',
        domain: 'example.com',
        planName: 'Pro',
        planDuration: 12,
        startDate: '2025-01-01',
        endDate: '2026-01-01',
        daysRemaining: 200,
        totalUsers: 500,
        remainingUsers: 100,
        totalMessages: 2000,
        guestMessages: 300,
        guestPercentage: 15,
        authenticatedMessages: 1700,
        messageHistory: [
          { sender: 'user', content: 'Hi', is_guest: true },
          { sender: 'bot', content: 'Hello!' },
        ],
      },
    ];
    const html = generateOverallHTML(data);
    expect(html).toContain('Overall Chatbot Report');
    expect(html).toContain('Co A');
    expect(html).toContain('example.com');
    expect(html).toMatch(/Message History/);
    expect(html).toContain('[GUEST]');
  });
});
