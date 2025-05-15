import winston from 'winston';
import winstonDailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import config from '../config/index.js';
// Add logging config to the config object if not present
if (!('logging' in config)) {
    config.logging = {
        level: 'info',
        maxSize: '20m',
        maxFiles: '14d'
    };
}
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize, json } = format;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Create logs directory if it doesn't exist
const ensureLogsDir = async () => {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!existsSync(logsDir)) {
        await mkdir(logsDir, { recursive: true });
    }
};
// Initialize logs directory
(async () => {
    try {
        await ensureLogsDir();
    }
    catch (error) {
        console.error('Failed to create logs directory:', error);
    }
})();
// Custom format for console output
const consoleFormat = printf((info) => {
    const { level, message, timestamp, ...meta } = info;
    let logMessage = `${timestamp} [${level}]: ${message}`;
    // Add metadata if it exists
    if (Object.keys(meta).length > 0) {
        logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    return logMessage;
});
// Create logger instance
const logger = createLogger({
    level: config.logging.level || 'info',
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json()),
    defaultMeta: { service: 'content-service' },
    transports: [
        // Write all logs with level 'error' and below to 'error.log'
        new transports.File({
            filename: path.join('logs', 'error.log'),
            level: 'error',
            maxsize: config.logging.maxSize || '20m',
            maxFiles: config.logging.maxFiles || '14d',
        }),
        // Write all logs with level 'info' and below to 'combined.log'
        new transports.File({
            filename: path.join('logs', 'combined.log'),
            maxsize: config.logging.maxSize || '20m',
            maxFiles: config.logging.maxFiles || '14d',
        }),
        // Rotate logs daily
        new winstonDailyRotateFile({
            filename: path.join('logs', 'application-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: config.logging.maxSize || '20m',
            maxFiles: config.logging.maxFiles || '14d',
        }),
    ],
    exceptionHandlers: [
        new transports.File({
            filename: path.join('logs', 'exceptions.log'),
            maxsize: config.logging.maxSize || '20m',
            maxFiles: config.logging.maxFiles || '14d',
        }),
    ],
    exitOnError: false,
});
// If we're not in production, also log to the console with colors
if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), consoleFormat),
    }));
}
logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    },
};
export default logger;
