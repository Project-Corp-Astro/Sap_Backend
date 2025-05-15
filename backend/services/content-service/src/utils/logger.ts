/**
 * Content Service Logger
 * 
 * This file initializes the shared logger for the Content Service.
 * It uses the @sap/logger package to provide consistent logging across all services.
 */

import { initializeLogger } from '@sap/logger';
import config from '../config/index.js';

// Define logging configuration
if (!('logging' in config)) {
  (config as any).logging = {
    level: 'info',
    maxSize: '20m',
    maxFiles: '14d'
  };
}

// Initialize the logger with Content Service configuration
const { logger, requestLogger, errorLogger } = initializeLogger({
  serviceName: 'content-service',
  level: (config as any).logging?.level || 'info',
  maxSize: (config as any).logging?.maxSize || '20m',
  maxFiles: (config as any).logging?.maxFiles || '14d',
  logsDir: 'logs',
  consoleLog: process.env.NODE_ENV !== 'production',
  httpLogging: true,
  timestamps: true,
  timestampFormat: 'YYYY-MM-DD HH:mm:ss',
  includeMetadata: true
});

// Export the logger and middleware functions
export { requestLogger, errorLogger };
export default logger;
