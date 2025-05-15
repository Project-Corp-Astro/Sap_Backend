/**
 * Logger utility type definitions
 */

import { Logger } from 'winston';

// Default logger instance
declare const defaultLogger: Logger;

/**
 * Creates a service-specific logger instance
 * @param serviceName - Name of the service
 * @returns Winston logger instance
 */
export function createServiceLogger(serviceName: string): Logger;

// Export as both default and named exports to support CommonJS pattern
export default defaultLogger;
