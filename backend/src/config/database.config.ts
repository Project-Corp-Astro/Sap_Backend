/**
 * Database Configuration
 * Centralized configuration for all database connections in the hybrid architecture
 */

import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// MongoDB Configuration
export const mongoConfig = {
  uri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sap-db', // Using IPv4 instead of localhost to avoid IPv6 issues
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    connectTimeoutMS: 5000, // Reduced timeout for faster failure
    socketTimeoutMS: 10000, // Reduced timeout
    serverSelectionTimeoutMS: 5000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    w: 'majority',
    maxPoolSize: 10, // Reduced pool size
    minPoolSize: 2, // Reduced min pool size
    autoIndex: !isProduction,
    family: 4, // Force IPv4
    serverApi: { version: '1', strict: false, deprecationErrors: true }
  }
};

// PostgreSQL Configuration
export const postgresConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'sap_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '12345',  // Using the password from .env
  max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '10'), // Reduced connections
  idleTimeoutMillis: 10000, // Reduced idle timeout
  connectionTimeoutMillis: 3000, // Reduced connection timeout
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Redis Configuration
export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.REDIS_DB || '0'),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'sap:',
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
};

// Elasticsearch Configuration
export const elasticsearchConfig = {
  node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || '',
    password: process.env.ELASTICSEARCH_PASSWORD || ''
  },
  ssl: {
    rejectUnauthorized: false
  },
  maxRetries: 3,
  requestTimeout: 60000,
  sniffOnStart: true,
  sniffInterval: 60000
};

// TypeORM Configuration
export const typeormConfig = {
  type: 'postgres' as const,
  host: postgresConfig.host,
  port: postgresConfig.port,
  username: postgresConfig.user,
  password: postgresConfig.password,
  database: postgresConfig.database,
  entities: [
    isProduction
      ? 'dist/entities/**/*.entity.js'
      : 'src/entities/**/*.entity.ts'
  ],
  migrations: [
    isProduction
      ? 'dist/migrations/**/*.js'
      : 'src/migrations/**/*.ts'
  ],
  subscribers: [
    isProduction
      ? 'dist/subscribers/**/*.js'
      : 'src/subscribers/**/*.ts'
  ],
  synchronize: !isProduction,
  logging: isProduction ? ['error'] : ['error', 'warn', 'schema', 'migration'],
  maxQueryExecutionTime: 1000,
  ssl: postgresConfig.ssl,
  cache: {
    type: 'redis',
    options: {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password || undefined,
      db: redisConfig.db
    },
    duration: 60000 // 1 minute
  }
};

// Export all configurations
export default {
  mongo: mongoConfig,
  postgres: postgresConfig,
  redis: redisConfig,
  elasticsearch: elasticsearchConfig,
  typeorm: typeormConfig,
  isProduction
};
