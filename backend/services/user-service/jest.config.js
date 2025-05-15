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
    '^bcrypt$': '<rootDir>/src/mocks/bcrypt.ts'
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/src/__tests__/controllers/user.controller.test.ts',
    '/src/__tests__/services/user.service.test.ts',
    '/src/__tests__/routes/user.routes.test.ts',
    '/src/__tests__/setup.ts'
  ]
};
