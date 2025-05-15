/**
 * Mock logger for testing
 */
export const createServiceLogger = jest.fn(() => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn()
}));

export default {
  createServiceLogger
};
