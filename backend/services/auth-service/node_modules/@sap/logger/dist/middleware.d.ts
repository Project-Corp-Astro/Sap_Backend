import { Request, Response, NextFunction } from 'express';
import { Logger } from './interfaces.js';
/**
 * Options for request logging middleware
 */
export interface RequestLoggerOptions {
    /** Skip logging for certain requests */
    skip?: (req: Request, res: Response) => boolean;
    /** Custom token functions for logging */
    tokens?: Record<string, (req: Request, res: Response) => string>;
    /** Format string for request logs */
    format?: string;
}
/**
 * Create middleware for logging HTTP requests
 * @param logger - Logger instance
 * @param options - Request logger options
 * @returns Express middleware function
 */
export declare function requestLogger(logger: Logger, options?: RequestLoggerOptions): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Create middleware for logging errors
 * @param logger - Logger instance
 * @returns Express middleware function
 */
export declare function errorLogger(logger: Logger): (err: Error, req: Request, res: Response, next: NextFunction) => void;
