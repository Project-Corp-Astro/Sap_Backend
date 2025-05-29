/**
 * @sap/logger - Shared logging utility for SAP microservices
 *
 * This package provides a standardized logging solution for all SAP microservices.
 * It includes:
 * - Configurable Winston logger
 * - File rotation and log management
 * - HTTP request logging middleware
 * - Error logging middleware
 * - Structured logging format
 */
export * from './interfaces.js';
export * from './logger.js';
export * from './middleware.js';
import { createLogger } from './logger.js';
import { requestLogger, errorLogger } from './middleware.js';
/**
 * Initialize a logger for a service
 * @param config - Logger configuration
 * @returns Logger instance and middleware functions
 */
export function initializeLogger(config) {
    const logger = createLogger(config);
    return {
        logger,
        requestLogger: (options = {}) => requestLogger(logger, options),
        errorLogger: () => errorLogger(logger)
    };
}
// Default export for convenience
export default {
    createLogger,
    requestLogger,
    errorLogger,
    initializeLogger
};
