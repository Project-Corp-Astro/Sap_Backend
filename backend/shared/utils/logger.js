"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const { format, createLogger, transports } = winston_1.default;
const { combine, timestamp, printf, colorize, json } = format;
// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};
// Add colors to winston
winston_1.default.addColors(colors);
// Custom format for console output
const consoleFormat = combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), colorize({ all: true }), printf((info) => {
    const { timestamp, level, message, service } = info, meta = __rest(info, ["timestamp", "level", "message", "service"]);
    return `${timestamp} [${service}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
}));
// JSON format for file output and external services
const fileFormat = combine(timestamp(), json());
/**
 * Create a logger instance for a specific service
 * @param serviceName - Name of the service (e.g., 'auth-service', 'user-service')
 * @returns Logger instance
 */
const createServiceLogger = (serviceName) => {
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
exports.createServiceLogger = createServiceLogger;
// Create default logger for services that don't specify a name
const defaultLogger = createServiceLogger('sap-app');
// Export both the factory function and the default logger
exports.default = defaultLogger;
