import winston from 'winston';
import winstonDailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { LoggerConfig, LogFormat, LoggerStream, Logger } from './interfaces.js';

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: Partial<LoggerConfig> = {
  level: 'info',
  maxSize: '20m',
  maxFiles: '14d',
  logsDir: 'logs',
  consoleLog: true,
  httpLogging: true,
  timestamps: true,
  timestampFormat: 'YYYY-MM-DD HH:mm:ss',
  includeMetadata: true
};

/**
 * Create logs directory if it doesn't exist
 * @param logsDir - Directory to store log files
 */
const ensureLogsDir = async (logsDir: string): Promise<void> => {
  const logsDirPath = path.isAbsolute(logsDir) 
    ? logsDir 
    : path.join(process.cwd(), logsDir);
    
  if (!existsSync(logsDirPath)) {
    await mkdir(logsDirPath, { recursive: true });
  }
};

/**
 * Create a Winston logger instance with the specified configuration
 * @param config - Logger configuration
 * @returns Winston logger instance
 */
export function createLogger(config: LoggerConfig): Logger {
  // Merge default config with provided config
  const mergedConfig: LoggerConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };

  const { 
    serviceName, 
    level, 
    maxSize, 
    maxFiles, 
    logsDir = 'logs',
    consoleLog, 
    timestamps, 
    timestampFormat 
  } = mergedConfig;

  const { format, transports, createLogger } = winston;
  const { combine, timestamp, printf, colorize, json, splat, errors } = format;

  // Initialize logs directory
  (async () => {
    try {
      await ensureLogsDir(logsDir);
    } catch (error) {
      console.error(`Failed to create logs directory '${logsDir}':`, error);
    }
  })();

  // Custom format for console output
  const consoleFormat = printf((info: any) => {
    const { level, message, timestamp, service, ...meta } = info;
    let logMessage = `${timestamp} [${service}] [${level}]: ${message}`;

    // Add metadata if it exists and includeMetadata is true
    if (mergedConfig.includeMetadata && Object.keys(meta).length > 0 && meta.stack === undefined) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }

    // Add error stack trace if available
    if (meta.stack) {
      logMessage += `\n${meta.stack}`;
    }

    return logMessage;
  });

  // Base format with timestamps and error handling
  const baseFormat = timestamps 
    ? combine(
        splat(),
        errors({ stack: true }),
        timestamp({ format: timestampFormat }),
        json()
      )
    : combine(
        splat(),
        errors({ stack: true }),
        json()
      );

  // Create the logger transports
  const loggerTransports = [
    // Write all logs with level 'error' and below to 'error.log'
    new transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: parseInt(maxSize || '20m') * 1024 * 1024,
      maxFiles: parseInt(maxFiles || '14') || 14,
    }),
    // Write all logs with level 'info' and below to 'combined.log'
    new transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: parseInt(maxSize || '20m') * 1024 * 1024,
      maxFiles: parseInt(maxFiles || '14') || 14,
    }),
    // Rotate logs daily
    new winstonDailyRotateFile({
      filename: path.join(logsDir, `${serviceName}-%DATE%.log`),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: maxSize,
      maxFiles: maxFiles,
    }),
  ];

  // Add console transport in non-production environments if enabled
  if (consoleLog && process.env.NODE_ENV !== 'production') {
    loggerTransports.push(
      new transports.Console({
        format: combine(
          colorize(),
          timestamps ? timestamp({ format: timestampFormat }) : format.simple(),
          consoleFormat,
        ),
      }) as any
    );
  }

  // Create the logger instance
  const logger = createLogger({
    level: level || 'info',
    format: baseFormat,
    defaultMeta: { service: serviceName },
    transports: loggerTransports,
    exceptionHandlers: [
      new transports.File({ 
        filename: path.join(logsDir, `${serviceName}-exceptions.log`),
        maxsize: parseInt(maxSize || '20m') * 1024 * 1024,
        maxFiles: parseInt(maxFiles || '14') || 14,
      }),
    ],
    exitOnError: false,
  });

  // Add HTTP request logging stream
  (logger as any).stream = {
    write: (message: string): void => {
      logger.http(message.trim());
    },
  } as LoggerStream;

  return logger as unknown as Logger;
}
