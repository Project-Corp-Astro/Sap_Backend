import winston from 'winston';
const { format, createLogger, transports } = winston;
const { combine, timestamp, printf, colorize, json } = format;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
} as const;

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
} as const;

// Add colors to winston
winston.addColors(colors as winston.config.AbstractConfigSetColors);

// Custom format for console output
const consoleFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  colorize({ all: true }),
  printf((info) => {
    const { timestamp, level, message, service, ...meta } = info;
    return `${timestamp} [${service}] ${level}: ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
    }`;
  })
);

// JSON format for file output and external services
const fileFormat = combine(
  timestamp(),
  json()
);

/**
 * Create a logger instance for a specific service
 * @param serviceName - Name of the service (e.g., 'auth-service', 'user-service')
 * @returns Logger instance
 */
const createServiceLogger = (serviceName: string): winston.Logger => {
  return createLogger({
    levels,
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: serviceName },
    transports: [
      // Console transport for development
      new transports.Console({
        format: consoleFormat,
      }),
      // File transport for production logs
      new transports.File({
        filename: `logs/${serviceName}-error.log`,
        level: 'error',
        format: fileFormat,
      }),
      new transports.File({
        filename: `logs/${serviceName}-combined.log`,
        format: fileFormat,
      }),
    ],
    // Don't exit on uncaught exceptions
    exitOnError: false,
  });
};

// Create default logger for services that don't specify a name
const defaultLogger = createServiceLogger('sap-app');

// Export both the factory function and the default logger
export default defaultLogger;
export { createServiceLogger };
