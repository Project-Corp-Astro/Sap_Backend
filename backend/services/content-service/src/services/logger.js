// Mock logger for tests
/**
 * Mock logger for tests
 * This file is used as a replacement for the shared logger in tests
 */

// Import Jest for testing
import { jest } from '@jest/globals';

// Create a mock logger that doesn't output to console during tests
const createNoOpLogger = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
});

// Create a service logger that outputs to console (useful for debugging)
export const createServiceLogger = (serviceName) => {
  // When running in test mode, use a no-op logger
  if (process.env.NODE_ENV === 'test') {
    return createNoOpLogger();
  }
  
  // Otherwise, use a console logger
  return {
    info: (message, meta) => console.log(`[${serviceName}] INFO:`, message, meta || ''),
    error: (message, meta) => console.error(`[${serviceName}] ERROR:`, message, meta || ''),
    warn: (message, meta) => console.warn(`[${serviceName}] WARN:`, message, meta || ''),
    debug: (message, meta) => console.debug(`[${serviceName}] DEBUG:`, message, meta || '')
  };
};

// Export the logger directly for use in imports
export default {
  createServiceLogger
};
