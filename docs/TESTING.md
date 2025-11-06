# Testing Guide

This document explains how the test suite is structured, how to run it efficiently, and how to write maintainable tests for this repository.

## Overview

- Frameworks: Jest + Supertest + mongodb-memory-server
- Style: Integration-first with focused unit tests where valuable
- Isolation: Each test runs against a fresh in-memory MongoDB, seeded as needed
- Selective routes: In tests, only the routes you need are mounted to avoid ESM/side-effect issues

## Project wiring

- `jest.config.js`
  - `testEnvironment: node`
  - `setupFilesAfterEnv: tests/setup.js` — starts in-memory Mongo and wires global cleanup
  - `testTimeout: 30000` — higher timeout for integration tests
- `tests/setup.js`
  - Boots an in-memory MongoDB server and connects Mongoose
  - Sets `NODE_ENV=test`, `JWT_SECRET`
  - Clears all collections after each test and shuts everything down after all tests
- `app.js`
  - Exposes the Express app without starting a server (so Supertest can import it)
  - Supports selective route mounting via `TEST_ROUTES` when `NODE_ENV=test`
- `index.js`
  - Starts the real server and DB; not used by tests

## Running tests

During development, prefer watch mode so tests re-run automatically on save.

- All tests (CI style):
  ```powershell
  npm test
  ```
- Watch mode (recommended):
  ```powershell
  npm run test:watch
  ```
- Only changed files (git-aware):
  ```powershell
  npx jest --onlyChanged
  ```
- A single test file:
  ```powershell
  npx jest tests\\chatRoute.test.js
  ```
- A single test by name:
  ```powershell
  npx jest -t "intent link insertion"
  ```
- Tests related to a specific source file:
  ```powershell
  npx jest --findRelatedTests controllers\\chatController.js services\\configService.js
  ```

## Selective route mounting (tests)

To limit which routes are loaded in a test process, set `TEST_ROUTES` before importing `app.js`. Example within a test file:

```js
process.env.NODE_ENV = 'test';
process.env.TEST_ROUTES = '/api/chat,/api/context,/api/products';
const app = require('../app');
```

If `TEST_ROUTES` is empty (default), no routes are mounted in test mode; your tests can still hit `/health` and custom handlers. In non-test mode, all routes are mounted.

## Test helpers

Located under `tests/helpers`. These keep tests small and consistent.

- `mongo.js`
  - `clearDatabase()` — deletes all documents from all collections after each test
  - `closeDatabase()` — drops DB and closes the Mongoose connection
- `jwt.js`
  - `signToken(payload, { expiresIn })` — signs a JWT using `JWT_SECRET`
  - `userToken(overrides)` — standard user claims
  - `adminToken(overrides)` — role=admin
  - `superAdminToken(overrides)` — admin + `isSuperAdmin`
- `seed.js`
  - `createPlan(data)`
  - `createChatbot(data)`
  - `createActiveSubscription({ chatbot_id, plan_id, endInMs, status })`
  - `createClientConfig({ chatbot_id, auth_method, free_messages, link_intents, ui_suggestions, require_auth_text, product_enabled })`
  - `createProducts(items)` — bulk insert into `AzaModel`
  - `createActiveBotWithPlan({ company_name, company_url, plan, subscription })` — convenience factory returning `{ plan, bot, subscription, chatbotId }`
- `chatMocks.js`
  - Mocks `services/configService.getClientConfig`
  - Mocks `axios.post` used for TTS calls
  - Import at the very top of chat-related tests before importing `app`
- `productMocks.js`
  - Mocks `services/productIntentService` and `services/productSearchService`
  - Import in chat tests that depend on product intent/search behavior

## Typical test patterns

- Supertest server without listening:
  ```js
  const request = require('supertest');
  const app = require('../app');
  await request(app).get('/health').expect(200);
  ```

- Seeding data for an endpoint:
  ```js
  const { createActiveBotWithPlan, createClientConfig } = require('./helpers/seed');
  const { chatbotId } = await createActiveBotWithPlan();
  await createClientConfig({ chatbot_id: chatbotId, free_messages: 3 });
  ```

- Using JWT helpers:
  ```js
  const { userToken } = require('./helpers/jwt');
  const token = userToken({ id: 'user-123' });
  await request(app).get('/api/user/profile').set('Authorization', `Bearer ${token}`);
  ```

- Overriding a default mock for one test:
  ```js
  jest.mock('../../services/configService', () => ({
    getClientConfig: jest.fn(async () => ({ free_messages: 0, product_enabled: true }))
  }));
  ```

## Rate limiting and whitelisting

- Rate limiters are applied to `/api` and `/api/speech-to-text`
- Whitelisted IPs come from `RATE_LIMIT_IP_WHITELIST` (comma-separated). In tests, Supertest requests originate from `::ffff:127.0.0.1`; `app.js` normalizes this to `127.0.0.1` for whitelist checks.

## Environment variables used in tests

Set in `tests/setup.js` unless you override per test:

- `NODE_ENV=test`
- `MONGODB_URI` — provided by mongodb-memory-server
- `JWT_SECRET` — defaults to `testsecret` if not set
- `TEST_ROUTES` — optional; mount only the routes you need in the current test process

## Troubleshooting

- Tests hang with open handles
  - Ensure you are not importing `index.js` in tests; import `app.js` instead
  - Check for unawaited async operations in tests
  - Verify external network calls are mocked (see `chatMocks.js` and `productMocks.js`)

- Route not found (404) in a test
  - In test mode, routes are only mounted if `TEST_ROUTES` is set. Ensure you set it before requiring `app.js`, or disable selective mounting by not setting `NODE_ENV=test` when debugging.

- ESM or side-effect errors from unrelated routes
  - Use `TEST_ROUTES` to mount only the specific route(s) you need

- Rate limit 429 in tests
  - Add `127.0.0.1` to `RATE_LIMIT_IP_WHITELIST` or set process.env before requiring `app.js`

## Writing new tests

- Keep setup small: use factories from `tests/helpers/seed.js`
- Mock external services at the top of the file, before `require('../app')`
- Prefer realistic request/response flows. Validate status codes, response shape, and side effects in Mongo where needed
- Add edge-case tests next to happy-path tests (validation errors, permission checks, timeouts)

## Coverage (optional)

To get coverage locally:

```powershell
npx jest --coverage
```

You can enforce thresholds by adding to `jest.config.js`:

```js
coverageThreshold = {
  global: { branches: 60, functions: 60, lines: 70, statements: 70 }
};
```

Adjust as the suite grows.

## Shared service validation schemas

Service-layer input validation is centralized in `schemas/serviceSchemas.js` to keep behavior consistent and reduce duplication.

- `processAnswerQuerySchema`: Used by `services/chatbotService.processAnswerQuery` to validate query, chatbotId, sessionId, email/phone.
- `getMessagesSchema`: Used by `services/userService.getMessages` to validate pagination and filters.

Usage in a service:

```js
const { processAnswerQuerySchema } = require('../schemas/serviceSchemas');
const { error, value } = processAnswerQuerySchema.validate(payload, { convert: true, stripUnknown: true });
if (error) throw new Error('Invalid input');
```

Testing validation behavior:

```js
await expect(processAnswerQuery({ query: '', chatbotId })).rejects.toThrow(/Invalid input|Please ask anything/);
```

When adding new service methods requiring validation, prefer adding a schema to `schemas/serviceSchemas.js` and importing it into the service. Reuse helpers from `middleware/validation` (e.g., `objectId()`, `email()`).
