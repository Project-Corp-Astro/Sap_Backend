/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(.{1,2}\\/.*)\\.(js|ts)$': '$1',
    '^../../../shared/utils/logger\\.js$': '<rootDir>/src/__tests__/mocks/sharedLogger.mock.js'
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true
    }]
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/setup.ts'
  ],
  verbose: true,
  testTimeout: 30000,
  modulePathIgnorePatterns: [
    '<rootDir>/dist/'
  ]
};
