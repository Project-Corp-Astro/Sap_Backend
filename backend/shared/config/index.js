/**
 * Centralized configuration for SAP backend services
 * This module provides a unified way to access configuration across all microservices
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

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
    user: 'http://localhost:3002',
    content: 'http://localhost:3003',
    gateway: 'http://localhost:5001',
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
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
};

// Configuration object
const config = {
  // Server settings
  port: parseInt(process.env.PORT || defaults.port, 10),
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
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || defaults.rateLimit.windowMs, 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || defaults.rateLimit.max, 10),
  },
};

/**
 * Get configuration value
 * @param {string} key - Configuration key (dot notation supported)
 * @param {*} defaultValue - Default value if key not found
 * @returns {*} Configuration value
 */
const get = (key, defaultValue) => {
  const keys = key.split('.');
  let value = config;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return defaultValue;
    }
  }
  
  return value !== undefined ? value : defaultValue;
};

/**
 * Set configuration value (only in memory, not in .env)
 * @param {string} key - Configuration key (dot notation supported)
 * @param {*} value - Configuration value
 */
const set = (key, value) => {
  const keys = key.split('.');
  const lastKey = keys.pop();
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
 * @returns {Object} Complete configuration object
 */
const getAll = () => {
  return { ...config };
};

module.exports = {
  get,
  set,
  getAll,
};
