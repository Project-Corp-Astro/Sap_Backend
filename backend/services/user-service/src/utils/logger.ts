import { createLogger, LoggerOptions } from '@sap/logger';

// Configuration for the user service logger
const loggerOptions: LoggerOptions = {
  service: 'user-service',
  level: process.env.LOG_LEVEL || 'info',
  transports: {
    console: true,
    file: {
      filename: process.env.LOG_FILE_PATH || 'logs/user-service.log',
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

// Create a service-specific logger function for controllers and services
export const createServiceLogger = (serviceName: string) => {
  return {
    info: (message: string, meta?: any) => logger.info(`[${serviceName}] ${message}`, meta),
    error: (message: string, meta?: any) => logger.error(`[${serviceName}] ${message}`, meta),
    warn: (message: string, meta?: any) => logger.warn(`[${serviceName}] ${message}`, meta),
    debug: (message: string, meta?: any) => logger.debug(`[${serviceName}] ${message}`, meta),
    trace: (message: string, meta?: any) => logger.verbose(`[${serviceName}] ${message}`, meta)
  };
};

// Export the logger as default
export default logger;
