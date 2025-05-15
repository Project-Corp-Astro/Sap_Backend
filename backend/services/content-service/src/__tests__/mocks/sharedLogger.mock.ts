// Mock for the shared logger utility
import { jest } from '@jest/globals';

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

export const createServiceLogger = jest.fn().mockReturnValue(mockLogger);

export default mockLogger;
