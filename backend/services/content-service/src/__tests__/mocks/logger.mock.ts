// Mock logger for tests
export const createServiceLogger = jest.fn().mockReturnValue({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

export default {
  createServiceLogger
};
