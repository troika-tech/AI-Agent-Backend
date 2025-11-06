// Centralized default mocks for chat-related tests
// Load this file at the top of chat tests BEFORE requiring app/routes.

jest.mock('../../services/configService', () => ({
  getClientConfig: jest.fn(async () => ({
    auth_method: 'email',
    free_messages: 2,
    require_auth_text: 'Sign in to continue.',
    link_intents: [],
    product_enabled: false,
  })),
}));

jest.mock('axios', () => ({
  post: jest.fn(async () => ({ data: Buffer.from(JSON.stringify({ audio: 'data:audio/wav;base64,' })) })),
}));
