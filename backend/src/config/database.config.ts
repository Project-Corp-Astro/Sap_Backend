/**
 * Database Configuration
 * Centralized configuration for all database connections in the hybrid architecture
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
// dotenv.config({ path: path.join(__dirname, '../../.env') });

// Environment
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
// Load environment variables
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });
console.log(`Loading environment from ${envPath}`);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
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

// Supabase Configuration
export const supabaseConfig = {
  url: process.env.SUPABASE_URL || 'https://your-supabase-url.supabase.co',
  key: process.env.SUPABASE_ANON_KEY || 'your-anon-key',
  options: {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: { 'x-application-name': 'sap-backend' },
    },
  }
};

// Initialize Supabase client
export const supabaseClient = createClient(
  supabaseConfig.url,
  supabaseConfig.key,
  supabaseConfig.options
);

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

// TypeORM Configuration (updated to use Supabase PostgreSQL connection)
export const typeormConfig = {
  type: 'postgres' as const,
  host: process.env.SUPABASE_DB_HOST || 'db.your-supabase-url.supabase.co',
  port: parseInt(process.env.SUPABASE_DB_PORT || '5432'),
  username: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || 'your-db-password',
  database: process.env.SUPABASE_DB_NAME || 'postgres',
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
  ssl: { rejectUnauthorized: false },
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
  supabase: supabaseConfig,
  redis: redisConfig,
  elasticsearch: elasticsearchConfig,
  typeorm: typeormConfig,
  isProduction
};
