/**
 * Custom logger implementation to avoid ES Module compatibility issues
 */
import winston from 'winston';
import express from 'express';

// Configuration for the auth service logger
const loggerConfig = {
  serviceName: 'auth-service',
  level: process.env.LOG_LEVEL || 'info',
  maxSize: '10m',
  maxFiles: '5',
  logsDir: process.env.LOG_FILE_PATH || 'logs',
  consoleLog: true,
  httpLogging: true,
  timestamps: true,
  includeMetadata: process.env.NODE_ENV === 'production'
};

// Create a simple Winston logger
const logger = winston.createLogger({
  level: loggerConfig.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: loggerConfig.serviceName },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: `${loggerConfig.logsDir}/${loggerConfig.serviceName}.log`,
      maxsize: parseInt(loggerConfig.maxSize) * 1024 * 1024, // Convert to bytes
      maxFiles: parseInt(loggerConfig.maxFiles)
    })
  ]
});

// Simple request logger middleware
const requestLogger = (options: any = {}) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Skip logging if the skip function returns true
    if (options.skip && options.skip(req, res)) {
      return next();
    }
    
    // Log the request
    const startTime = Date.now();
    
    // Log when the response is finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
    });
    
    next();
  };
};

// Simple error logger middleware
const errorLogger = () => {
  return (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Error processing request', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
    next(err);
  };
};

// Export middleware for request and error logging
export { requestLogger, errorLogger };

// Export the logger as default
export default logger;
