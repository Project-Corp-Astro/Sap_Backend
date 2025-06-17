import { Redis } from 'ioredis';
import logger from '../../../../shared/utils/logger';
import config from '../../../../shared/config';
import { createRedisCache } from '../../../../shared/utils/redis-manager';

// Content service uses logical DB #3 for service isolation
const DB_NUMBER = 3;

// Create Redis client with service isolation using logical DB
const redisOptions = {
  host: config.get('redis.host', 'localhost'),
  port: config.get('redis.port', 6379),
  password: config.get('redis.password'),
  db: DB_NUMBER,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3
};

// Create Redis client
const createRedisClient = (): Redis => {
  try {
    const client = new Redis(redisOptions);

    client.on('connect', () => {
      logger.info('Content service connected to Redis', { db: DB_NUMBER });
    });

    client.on('error', (err) => {
      logger.error('Content service Redis client error', { error: err.message, db: DB_NUMBER });
    });

    client.on('close', () => {
      logger.warn('Content service Redis connection closed', { db: DB_NUMBER });
    });

    return client;
  } catch (error) {
    logger.error('Failed to create Redis client for Content service', {
      error: error instanceof Error ? error.message : String(error),
      db: DB_NUMBER
    });
    throw error;
  }
};

// Redis client instance with fallback to legacy client to avoid breaking changes
const redisClient = createRedisClient();

// Create purpose-specific caches with unique key prefixes for the Content service
export const contentCache = createRedisCache({
  db: DB_NUMBER,
  keyPrefix: 'content:',
  redisConfig: {
    host: config.get('redis.host', 'localhost'),
    port: config.get('redis.port', 6379),
    password: config.get('redis.password')
  },
  serviceName: 'content'
});

export const mediaCache = createRedisCache({
  db: DB_NUMBER,
  keyPrefix: 'media:',
  redisConfig: {
    host: config.get('redis.host', 'localhost'),
    port: config.get('redis.port', 6379),
    password: config.get('redis.password')
  },
  serviceName: 'content'
});

export const videoCache = createRedisCache({
  db: DB_NUMBER,
  keyPrefix: 'video:',
  redisConfig: {
    host: config.get('redis.host', 'localhost'),
    port: config.get('redis.port', 6379),
    password: config.get('redis.password')
  },
  serviceName: 'content'
});

export const categoryCache = createRedisCache({
  db: DB_NUMBER,
  keyPrefix: 'category:',
  redisConfig: {
    host: config.get('redis.host', 'localhost'),
    port: config.get('redis.port', 6379),
    password: config.get('redis.password')
  },
  serviceName: 'content'
});

// Redis utilities for health checks and management
export const redisUtils = {
  pingRedis: async (): Promise<boolean> => {
    try {
      const pong = await redisClient.ping();
      return pong === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },
  
  close: async (): Promise<void> => {
    try {
      await Promise.all([
        redisClient.quit(),
        contentCache.getClient().quit(),
        mediaCache.getClient().quit(),
        videoCache.getClient().quit(),
        categoryCache.getClient().quit()
      ]);
      logger.info('All Redis connections closed successfully for Content service');
    } catch (error) {
      logger.error('Error closing Redis connections', { 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
};

// For backward compatibility with existing services
export default redisClient;

// Export all cache utilities
export { redisClient };
