/**
 * Logging configuration interface
 */
export interface LoggerConfig {
  /** Service name to identify logs from this service */
  serviceName: string;
  
  /** Log level (debug, info, warn, error) */
  level?: string;
  
  /** Maximum size of log files before rotation */
  maxSize?: string;
  
  /** Maximum number of days to keep log files */
  maxFiles?: string;
  
  /** Directory to store log files */
  logsDir?: string;
  
  /** Whether to log to console in non-production environments */
  consoleLog?: boolean;
  
  /** Whether to log HTTP requests */
  httpLogging?: boolean;
  
  /** Whether to include timestamps in logs */
  timestamps?: boolean;
  
  /** Format for timestamps */
  timestampFormat?: string;
  
  /** Whether to include metadata in logs */
  includeMetadata?: boolean;
}

/**
 * Log format interface
 */
export interface LogFormat {
  level: string;
  message: string;
  timestamp: string;
  service: string;
  [key: string]: any;
}

/**
 * Logger stream interface for HTTP request logging
 */
export interface LoggerStream {
  write(message: string): void;
}

/**
 * Log level type
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

/**
 * Logger interface
 */
export interface Logger {
  error(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  info(message: string, meta?: Record<string, any>): void;
  http(message: string, meta?: Record<string, any>): void;
  verbose(message: string, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
  silly(message: string, meta?: Record<string, any>): void;
  
  /** Stream for HTTP request logging middleware */
  stream: LoggerStream;
  
  /** Child logger with additional metadata */
  child(options: Record<string, any>): Logger;
}
