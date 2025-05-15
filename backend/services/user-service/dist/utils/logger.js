"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceLogger = exports.errorLogger = exports.requestLogger = void 0;
const logger_1 = require("@sap/logger");
// Configuration for the user service logger
const loggerOptions = {
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
const logger = (0, logger_1.createLogger)(loggerOptions);
// Export middleware for request and error logging
_a = logger.middleware, exports.requestLogger = _a.requestLogger, exports.errorLogger = _a.errorLogger;
// Create a service-specific logger function for controllers and services
const createServiceLogger = (serviceName) => {
    return {
        info: (message, meta) => logger.info(`[${serviceName}] ${message}`, meta),
        error: (message, meta) => logger.error(`[${serviceName}] ${message}`, meta),
        warn: (message, meta) => logger.warn(`[${serviceName}] ${message}`, meta),
        debug: (message, meta) => logger.debug(`[${serviceName}] ${message}`, meta),
        trace: (message, meta) => logger.verbose(`[${serviceName}] ${message}`, meta)
    };
};
exports.createServiceLogger = createServiceLogger;
// Export the logger as default
exports.default = logger;
