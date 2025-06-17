import { RedisCache, createServiceRedisClient, SERVICE_DB_MAPPING, RedisOptions } from '../../../../shared/utils/redis-manager';
import type { Redis as IORedis } from 'ioredis';
import logger from '../../../../shared/utils/logger';
import config from '../../../../shared/config';

// Constants
const SERVICE_NAME = 'user';

// Create service-specific Redis clients by purpose
export const defaultCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:default:` } as RedisOptions);
export const userCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:users:` } as RedisOptions);
export const permissionCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:permissions:` } as RedisOptions);
export const roleCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:roles:` } as RedisOptions);

// Create standard Redis client instance (for backward compatibility)
const redisClient = createServiceRedisClient(SERVICE_NAME, {
  host: config.get('redis.host', 'localhost'),
  port: parseInt(config.get('redis.port', '6379')) || 6379,
  password: config.get('redis.password') || undefined,
  db: SERVICE_DB_MAPPING[SERVICE_NAME] || 2,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  connectTimeout: 3000,
  enableReadyCheck: true,
});

// Add connection error handling
redisClient.on('error', (error) => {
  logger.error('Redis client error:', { error: error.message });
});

redisClient.on('connect', () => {
  logger.info('Redis client connected successfully');
});

// Add disconnect handler
redisClient.on('end', () => {
  logger.warn('Redis client disconnected');
});

// Add reconnect handler
redisClient.on('reconnecting', () => {
  logger.info('Redis client reconnecting...');
});

// Log Redis database information
logger.info(`User service using Redis database ${SERVICE_DB_MAPPING[SERVICE_NAME] || 2}`);

/**
 * Enhanced Redis utilities for the User Service
 * - Uses service-isolated Redis databases
 * - Provides purpose-specific caching for different data types
 * - Includes fault tolerance and fallback mechanisms
 */
const redisUtils = {
  /**
   * Set a key-value pair with optional expiry time
   */
  async set(key: string, value: any, expiryInSeconds?: number): Promise<boolean> {
    try {
      // Use the default cache from RedisManager
      const success = await defaultCache.set(key, value, expiryInSeconds);
      return success;
    } catch (error: unknown) {
      // Fall back to legacy client if new client fails
      try {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        if (expiryInSeconds) {
          await redisClient.set(key, stringValue, 'EX', expiryInSeconds);
        } else {
          await redisClient.set(key, stringValue);
        }
        return true;
      } catch (fallbackError: unknown) {
        // Only log once with both error details
        logger.error(`Error setting Redis key ${key}:`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return false;
      }
    }
  },

  /**
   * Get a value by key
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      // Use the default cache from RedisManager
      const value = await defaultCache.get<T>(key);
      if (!value) return null;
      return value;
    } catch (error: unknown) {
      // Fall back to legacy client
    }
  },

  /**
   * Delete a key
   */
  async del(key: string): Promise<boolean> {
    try {
      return await defaultCache.del(key);
    } catch (error) {
      logger.error(`Error deleting Redis key ${key}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      return await defaultCache.exists(key);
    } catch (error) {
      logger.error(`Error checking Redis key ${key}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await defaultCache.getClient().quit();
    } catch (error) {
      logger.error('Error closing Redis connection:', { error: error instanceof Error ? error.message : String(error) });
    }
  },

  /**
   * Check Redis connectivity by sending a ping command
   */
  async pingRedis(): Promise<boolean> {
    try {
      const client = defaultCache.getClient();
      const pong = await client.ping();
      return pong === 'PONG';
    } catch (error) {
      logger.error('Error pinging Redis:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  /**
   * Cache user data with appropriate TTL
   */
  async cacheUser(userId: string, userData: any, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const cacheKey = `${userId}:user`;
      return await userCache.set(cacheKey, userData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  /**
   * Get cached user data
   */
  async getCachedUser(userId: string): Promise<any> {
    try {
      const cacheKey = `${userId}:user`;
      return await userCache.get<any>(cacheKey);
    } catch (error: unknown) {
      logger.error(`Error getting cached user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  /**
   * Cache permission data with appropriate TTL
   */
  async cachePermission(permissionId: string, permissionData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      const cacheKey = `${permissionId}:permission`;
      return await permissionCache.set(cacheKey, permissionData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching permission ${permissionId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  /**
   * Get cached permission data
   */
  async getCachedPermission(permissionId: string): Promise<any> {
    try {
      const cacheKey = `${permissionId}:permission`;
      return await permissionCache.get<any>(cacheKey);
    } catch (error: unknown) {
      logger.error(`Error getting cached permission ${permissionId}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  /**
   * Cache role data with appropriate TTL
   */
  async cacheRole(roleId: string, roleData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      const cacheKey = `${roleId}:role`;
      return await roleCache.set(cacheKey, roleData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching role ${roleId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  /**
   * Get cached role data
   */
  async getCachedRole(roleId: string): Promise<any> {
    try {
      const cacheKey = `${roleId}:role`;
      return await roleCache.get<any>(cacheKey);
    } catch (error: unknown) {
      logger.error(`Error getting cached role ${roleId}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  /**
   * Invalidate all cache entries for a user
   */
  async invalidateUserCache(userId: string): Promise<number> {
    try {
      const userPattern = `${userId}:user`;
      const permissionPattern = `${userId}:permissions`;
      const rolePattern = `${userId}:roles`;

      const [userKeys, permissionKeys, roleKeys] = await Promise.all([
        userCache.keys(userPattern),
        permissionCache.keys(permissionPattern),
        roleCache.keys(rolePattern)
      ]);

      const allKeys = [...userKeys, ...permissionKeys, ...roleKeys];
      if (allKeys.length === 0) return 0;

      return await Promise.all([
        userCache.deleteByPattern(userPattern),
        permissionCache.deleteByPattern(permissionPattern),
        roleCache.deleteByPattern(rolePattern)
      ]).then((results) => results.reduce((sum, result) => sum + result, 0));
    } catch (error: unknown) {
      logger.error(`Error invalidating cache for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  },

} as const;

// Export the Redis utilities
export default {
  redisClient,
  redisUtils,
  defaultCache,
  userCache,
  permissionCache,
  roleCache
} as const;
