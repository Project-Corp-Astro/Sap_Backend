import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import config from '../config';

// Define error object type
type ErrorWithStack = Error & {
  stack?: string;
  code?: string | number;
  statusCode?: number;
  message: string;
};

// Extend NodeJS.Console to include our overridden methods
declare global {
  interface Console {
    debug(message?: any, ...optionalParams: any[]): void;
    log(message?: any, ...optionalParams: any[]): void;
    info(message?: any, ...optionalParams: any[]): void;
    warn(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
  }
}

// Define log directory
const LOG_DIR = path.join(process.cwd(), 'logs');

// Define log formats
const formats = [
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
];

// Create console format with colors for better readability in development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, service, stack, ...meta }) => {
    const serviceName = service || config.serviceName;
    let logMessage = `${timestamp} [${serviceName}] ${level}: ${message}`;
    
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Create file transport for daily rotate
const fileTransport = new winston.transports.DailyRotateFile({
  dirname: LOG_DIR,
  filename: `${config.serviceName}-%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d', // Keep logs for 14 days
  format: winston.format.combine(...formats),
});

// Create transports array based on environment
const transports: winston.transport[] = [
  // Always log to console
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Only add file transport in production/staging to save disk space during development
if (['production', 'staging'].includes(config.env)) {
  transports.push(fileTransport);
}

// Create a simple console transport that will show all logs
const consoleTransport = new winston.transports.Console({
  level: 'debug', // Show all logs
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
      let log = `${timestamp} [${config.serviceName}] ${level}: ${message}`;
      
      // Include metadata if available
      if (Object.keys(meta).length > 0) {
        log += `\n${JSON.stringify(meta, null, 2)}`;
      }
      
      // Include stack trace if available
      if (stack) {
        log += `\n${stack}`;
      }
      
      return log;
    })
  )
});

// Create logger instance with debug level
const logger = winston.createLogger({
  level: 'debug', // Set the minimum log level
  defaultMeta: { service: config.serviceName },
  transports: [consoleTransport],
  // Handle uncaught exceptions and rejections
  handleExceptions: true,
  handleRejections: true,
  exitOnError: false
});

// Log the current log level
logger.info(`Logger initialized in ${config.env} mode with level: debug`);

// Override console methods to use our logger
const originalConsole = { ...console };

console.log = (message?: any, ...optionalParams: any[]) => {
  logger.debug(message, ...optionalParams);
  if (config.env === 'development') {
    originalConsole.log(message, ...optionalParams);
  }
};

console.info = (message?: any, ...optionalParams: any[]) => {
  logger.info(message, ...optionalParams);
  if (config.env === 'development') {
    originalConsole.info(message, ...optionalParams);
  }
};

console.warn = (message?: any, ...optionalParams: any[]) => {
  logger.warn(message, ...optionalParams);
  if (config.env === 'development') {
    originalConsole.warn(message, ...optionalParams);
  }
};

console.error = (message?: any, ...optionalParams: any[]) => {
  logger.error(message, ...optionalParams);
  if (config.env === 'development') {
    originalConsole.error(message, ...optionalParams);
  }
};

console.debug = (message?: any, ...optionalParams: any[]) => {
  logger.debug(message, ...optionalParams);
  if (config.env === 'development') {
    originalConsole.debug(message, ...optionalParams);
  }
};

import { Request, Response, NextFunction } from 'express';

interface RequestLoggerOptions {
  skip?: (req: Request) => boolean;
  format?: string;
}

// Define type for Express middleware function
export type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void;

// Middleware for request logging
export const requestLogger = (options: RequestLoggerOptions = {}): ExpressMiddleware => {
  const skip = options.skip || (() => false);
  const format = options.format || ':method :url :status :response-time ms';

  return (req: Request, res: Response, next: NextFunction): void => {
    if (skip(req)) return next();

    const startTime = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      const message = format
        .replace(':method', req.method)
        .replace(':url', req.originalUrl)
        .replace(':status', res.statusCode.toString())
        .replace(':response-time', responseTime.toString());
      
      if (res.statusCode >= 500) {
        logger.error(message, { path: req.path, body: req.body, query: req.query });
      } else if (res.statusCode >= 400) {
        logger.warn(message, { path: req.path });
      } else {
        logger.info(message);
      }
    });

    next();
  };
};

// Middleware for error logging
export const errorLogger = (options: Record<string, any> = {}) => {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error(err.message, {
      error: {
        message: err.message,
        name: err.name,
        stack: err.stack,
      },
      request: {
        path: req.path,
        headers: req.headers,
        method: req.method,
        ip: req.ip,
      },
    });
    next(err);
  };
};

// Create middleware instances
export const requestLoggerMiddleware = requestLogger();
export const errorLoggerMiddleware = errorLogger();

export default logger;
