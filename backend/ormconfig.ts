/**
 * TypeORM Configuration
 * This file configures TypeORM for PostgreSQL database connections
 */

import { DataSourceOptions } from 'typeorm';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config();

// Determine environment
const env = process.env.NODE_ENV || 'development';
const isProduction = env === 'production';

// Base directory for entities and migrations
const baseDir = isProduction ? 'dist' : 'src';

// Default configuration
const defaultConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'sap_db',
  entities: [
    path.join(__dirname, baseDir, 'entities', '**', '*.entity.{ts,js}')
  ],
  migrations: [
    path.join(__dirname, baseDir, 'migrations', '**', '*.{ts,js}')
  ],
  subscribers: [
    path.join(__dirname, baseDir, 'subscribers', '**', '*.{ts,js}')
  ],
  synchronize: !isProduction, // Auto-synchronize schema in development only
  logging: isProduction ? ['error'] : ['error', 'warn', 'schema', 'migration'],
  maxQueryExecutionTime: 1000, // Log queries taking longer than 1 second
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  cache: {
    type: 'redis',
    options: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0')
    },
    duration: 60000 // Cache for 1 minute
  }
};

export default defaultConfig;
