/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  // Increase default timeout for heavier integration tests
  testTimeout: 30000,
  // Ignore logs from external libs to keep test output clean
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'services/**/*.js',
    'utils/**/*.js',
    'controllers/**/*.js',
    'middleware/**/*.js',
    'routes/**/*.js',
    '!utils/logger.js',
    '!**/node_modules/**',
    '!tests/**',
    '!scripts/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 25,
      branches: 15,
      functions: 20,
      lines: 25,
    },
  },
  // Add coverage directory
  coverageDirectory: 'coverage',
  // Collect coverage from more files
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/scripts/'
  ]
};
