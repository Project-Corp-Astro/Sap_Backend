/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '^../../../shared/utils/logger$': '<rootDir>/src/mocks/logger.ts',
    '^../../../../shared/utils/logger$': '<rootDir>/src/mocks/logger.ts',
    '^bcrypt$': '<rootDir>/src/mocks/bcrypt.ts',
    '^../../../../shared/utils/redis$': '<rootDir>/src/mocks/redis-client.ts',
    '^../services/auth.service$': '<rootDir>/src/mocks/auth.service.ts'
  }
};
