/**
 * Content Service Logger
 * 
 * This file initializes the shared logger for the Content Service.
 * It uses Winston for logging and provides middleware for Express.
 */

import winston from 'winston';
import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from './sharedLogger';

// Create the logger instance
const logger = createServiceLogger('content-service');

// Request logging middleware
export const requestLogger = (options: {
  skip?: (req: Request) => boolean;
  format?: string;
} = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip logging if the skip function returns true
    if (options.skip && options.skip(req)) {
      return next();
    }
    
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    
    next();
  };
};

// Error logging middleware
export const errorLogger = () => {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(`Error processing ${req.method} ${req.originalUrl}:`, err);
    next(err);
  };
};

// Export the logger
export default logger;
