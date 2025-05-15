/**
 * Centralized configuration for SAP backend services
 * This module provides a unified way to access configuration across all microservices
 */

interface MongoConfig {
  uri: string;
  options: {
    useNewUrlParser: boolean;
    useUnifiedTopology: boolean;
    [key: string]: any;
  };
}

interface JwtConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

interface ServicesConfig {
  auth: string;
  user: string;
  content: string;
  gateway: string;
  [key: string]: string;
}

interface LoggingConfig {
  level: string;
  format: string;
}

interface CorsConfig {
  origin: string;
  methods: string;
  preflightContinue: boolean;
  optionsSuccessStatus: number;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

interface ConfigObject {
  port: number;
  host: string;
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  mongo: MongoConfig;
  jwt: JwtConfig;
  services: ServicesConfig;
  logging: LoggingConfig;
  cors: CorsConfig;
  rateLimit: RateLimitConfig;
  [key: string]: any;
}

/**
 * Get configuration value
 * @param key - Configuration key (dot notation supported)
 * @param defaultValue - Default value if key not found
 * @returns Configuration value
 */
export function get<T>(key: string, defaultValue?: T): T;

/**
 * Set configuration value (only in memory, not in .env)
 * @param key - Configuration key (dot notation supported)
 * @param value - Configuration value
 */
export function set<T>(key: string, value: T): void;

/**
 * Get all configuration
 * @returns Complete configuration object
 */
export function getAll(): ConfigObject;

export default {
  get,
  set,
  getAll
};
