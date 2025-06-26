"use strict";
/**
 * Centralized configuration for SAP backend services
 * This module provides a unified way to access configuration across all microservices
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from .env file
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
// Default configuration values
const defaults = {
    // Server settings
    port: 3000,
    host: 'localhost',
    nodeEnv: 'development',
    // MongoDB settings
    mongoUri: 'mongodb://localhost:27017/sap',
    mongoOptions: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    },
    // JWT settings
    jwtSecret: 'your-secret-key-should-be-in-env-file',
    jwtExpiresIn: '1d',
    jwtRefreshExpiresIn: '7d',
    // Service URLs
    services: {
        auth: 'http://localhost:3001',
        user: 'http://localhost:3002', // User service is running on port 3002
        content: 'http://localhost:3005', // Content service is running on port 3005
        gateway: 'http://localhost:5001', // API Gateway is running on port 5001
    },
    // Logging settings
    logging: {
        level: 'info',
        format: 'json',
    },
    // CORS settings
    cors: {
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        preflightContinue: false,
        optionsSuccessStatus: 204,
    },
    // Rate limiting
    rateLimit: {
        windowMs: 24 * 60 * 60 * 1000, // 24 hours
        max: 999999, // effectively unlimited
    },
};
// Configuration object
const config = {
    // Server settings
    port: parseInt(process.env.PORT || defaults.port.toString(), 10),
    host: process.env.HOST || defaults.host,
    nodeEnv: process.env.NODE_ENV || defaults.nodeEnv,
    isDevelopment: (process.env.NODE_ENV || defaults.nodeEnv) === 'development',
    isProduction: (process.env.NODE_ENV || defaults.nodeEnv) === 'production',
    isTest: (process.env.NODE_ENV || defaults.nodeEnv) === 'test',
    // MongoDB settings
    mongo: {
        uri: process.env.MONGO_URI || defaults.mongoUri,
        options: defaults.mongoOptions,
    },
    // JWT settings
    jwt: {
        secret: process.env.JWT_SECRET || defaults.jwtSecret,
        expiresIn: process.env.JWT_EXPIRES_IN || defaults.jwtExpiresIn,
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || defaults.jwtRefreshExpiresIn,
    },
    // Service URLs
    services: {
        auth: process.env.AUTH_SERVICE_URL || defaults.services.auth,
        user: process.env.USER_SERVICE_URL || defaults.services.user,
        content: process.env.CONTENT_SERVICE_URL || defaults.services.content,
        gateway: process.env.API_GATEWAY_URL || defaults.services.gateway,
        astroEngine: process.env.ASTRO_ENGINE_URL,
        astroRatan: process.env.ASTRO_RATAN_URL,
    },
    // Logging settings
    logging: {
        level: process.env.LOG_LEVEL || defaults.logging.level,
        format: process.env.LOG_FORMAT || defaults.logging.format,
    },
    // CORS settings
    cors: {
        origin: process.env.CORS_ORIGIN || defaults.cors.origin,
        methods: process.env.CORS_METHODS || defaults.cors.methods,
        preflightContinue: defaults.cors.preflightContinue,
        optionsSuccessStatus: defaults.cors.optionsSuccessStatus,
    },
    // Rate limiting
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || defaults.rateLimit.windowMs.toString(), 10),
        max: parseInt(process.env.RATE_LIMIT_MAX || defaults.rateLimit.max.toString(), 10),
    },
};
/**
 * Get configuration value
 * @param key - Configuration key (dot notation supported)
 * @param defaultValue - Default value if key not found
 * @returns Configuration value
 */
const get = (key, defaultValue) => {
    const keys = key.split('.');
    let value = config;
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        }
        else {
            return defaultValue;
        }
    }
    return value !== undefined ? value : defaultValue;
};
/**
 * Set configuration value (only in memory, not in .env)
 * @param key - Configuration key (dot notation supported)
 * @param value - Configuration value
 */
const set = (key, value) => {
    const keys = key.split('.');
    const lastKey = keys.pop();
    if (!lastKey) {
        return;
    }
    let obj = config;
    for (const k of keys) {
        if (!(k in obj)) {
            obj[k] = {};
        }
        obj = obj[k];
    }
    obj[lastKey] = value;
};
/**
 * Get all configuration
 * @returns Complete configuration object
 */
const getAll = () => {
    return Object.assign({}, config);
};
exports.default = {
    get,
    set,
    getAll,
};
