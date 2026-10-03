module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.locale.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/legacy_flutter/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**'],
};
