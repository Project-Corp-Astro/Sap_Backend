import { LoggerConfig, Logger } from './interfaces.js';
/**
 * Create a Winston logger instance with the specified configuration
 * @param config - Logger configuration
 * @returns Winston logger instance
 */
export declare function createLogger(config: LoggerConfig): Logger;
