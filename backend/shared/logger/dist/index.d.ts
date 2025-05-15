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
import { LoggerConfig } from './interfaces.js';
/**
 * Initialize a logger for a service
 * @param config - Logger configuration
 * @returns Logger instance and middleware functions
 */
export declare function initializeLogger(config: LoggerConfig): {
    logger: import("./interfaces.js").Logger;
    requestLogger: (options?: {}) => (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => void;
    errorLogger: () => (err: Error, req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => void;
};
declare const _default: {
    createLogger: typeof createLogger;
    requestLogger: typeof requestLogger;
    errorLogger: typeof errorLogger;
    initializeLogger: typeof initializeLogger;
};
export default _default;
