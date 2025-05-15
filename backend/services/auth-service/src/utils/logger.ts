import { createLogger, LoggerOptions } from '@sap/logger';

// Configuration for the auth service logger
const loggerOptions: LoggerOptions = {
  service: 'auth-service',
  level: process.env.LOG_LEVEL || 'info',
  transports: {
    console: true,
    file: {
      filename: process.env.LOG_FILE_PATH || 'logs/auth-service.log',
      maxFiles: 5,
      maxSize: '10m'
    }
  },
  format: {
    timestamp: true,
    colorize: process.env.NODE_ENV !== 'production',
    json: process.env.NODE_ENV === 'production'
  }
};

// Create the logger instance
const logger = createLogger(loggerOptions);

// Export middleware for request and error logging
export const { requestLogger, errorLogger } = logger.middleware;

// Export the logger as default
export default logger;
