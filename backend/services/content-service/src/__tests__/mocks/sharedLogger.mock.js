// Mock for the shared logger utility
const { jest } = require('@jest/globals');

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const createServiceLogger = jest.fn().mockReturnValue(mockLogger);

module.exports = {
  createServiceLogger,
  default: mockLogger
};
