import { RedisCache, createServiceRedisClient, SERVICE_DB_MAPPING, RedisOptions } from '../../../../shared/utils/redis-manager';
import type { Redis as IORedis } from 'ioredis';
import logger from '../../../../shared/utils/logger';
import config from '../../../../shared/config';

// Constants
const SERVICE_NAME = 'user';

// Create service-specific Redis clients by purpose
export const defaultCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:default:` });
export const userCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:users:` });
export const permissionCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:permissions:` });
export const roleCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:roles:` });

// Create standard Redis client instance
const redisClient: IORedis = createServiceRedisClient(SERVICE_NAME, {
  host: config.get('redis.host', 'localhost'),
  port: parseInt(config.get('redis.port', '6379')),
  password: config.get('redis.password', '') || undefined,
  db: SERVICE_DB_MAPPING[SERVICE_NAME] || 2,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  connectTimeout: 3000,
  enableReadyCheck: true,
});

// Connection event handlers
redisClient.on('error', (error) => {
  logger.error('Redis client error:', { error: error.message });
});
redisClient.on('connect', () => {
  logger.info('Redis client connected successfully');
});
redisClient.on('end', () => {
  logger.warn('Redis client disconnected');
});
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
 * - Tracks cache hit/miss statistics
 */
interface RedisUtils {
  stats: {
    defaultCache: { hits: number; misses: number };
    userCache: { hits: number; misses: number };
    permissionCache: { hits: number; misses: number };
    roleCache: { hits: number; misses: number };
  };
  getStats: () => {
    defaultCache: { hits: number; misses: number; hitRate: number };
    userCache: { hits: number; misses: number; hitRate: number };
    permissionCache: { hits: number; misses: number; hitRate: number };
    roleCache: { hits: number; misses: number; hitRate: number };
  };
  set: (key: string, value: any, expiryInSeconds?: number) => Promise<'OK' | string>;
  get: <T = any>(key: string) => Promise<T | null>;
  del: (key: string) => Promise<number>;
  exists: (key: string) => Promise<number>;
  close: () => Promise<void>;
  pingRedis: () => Promise<boolean>;
  cacheUser: (userId: string, userData: any, ttlSeconds?: number) => Promise<boolean>;
  getCachedUser: (userId: string) => Promise<any>;
  cachePermission: (permissionId: string, permissionData: any, ttlSeconds?: number) => Promise<boolean>;
  getCachedPermission: (permissionId: string) => Promise<any>;
  cacheRole: (roleId: string, roleData: any, ttlSeconds?: number) => Promise<boolean>;
  getCachedRole: (roleId: string) => Promise<any>;
  invalidateUserCache: (userId: string) => Promise<number>;
}

const redisUtils: RedisUtils = {
  // Cache statistics
  stats: {
    defaultCache: { hits: 0, misses: 0 },
    userCache: { hits: 0, misses: 0 },
    permissionCache: { hits: 0, misses: 0 },
    roleCache: { hits: 0, misses: 0 }
  },

  getStats() {
    return {
      defaultCache: {
        ...this.stats.defaultCache,
        hitRate: this.stats.defaultCache.hits / (this.stats.defaultCache.hits + this.stats.defaultCache.misses) || 0
      },
      userCache: {
        ...this.stats.userCache,
        hitRate: this.stats.userCache.hits / (this.stats.userCache.hits + this.stats.userCache.misses) || 0
      },
      permissionCache: {
        ...this.stats.permissionCache,
        hitRate: this.stats.permissionCache.hits / (this.stats.permissionCache.hits + this.stats.permissionCache.misses) || 0
      },
      roleCache: {
        ...this.stats.roleCache,
        hitRate: this.stats.roleCache.hits / (this.stats.roleCache.hits + this.stats.roleCache.misses) || 0
      }
    };
  },

  async set(key: string, value: any, expiryInSeconds?: number): Promise<'OK' | string> {
    try {
      const success = await defaultCache.set(key, value, expiryInSeconds);
      return success ? 'OK' : 'ERROR';
    } catch (error: unknown) {
      try {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        if (expiryInSeconds) {
          await redisClient.set(key, stringValue, 'EX', expiryInSeconds);
        } else {
          await redisClient.set(key, stringValue);
        }
        return 'OK';
      } catch (fallbackError: unknown) {
        logger.error(`Error setting Redis key ${key}:`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return 'ERROR';
      }
    }
  },

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await defaultCache.get<T>(key);
      this.stats.defaultCache[value ? 'hits' : 'misses']++;
      return value;
    } catch (error: unknown) {
      this.stats.defaultCache.misses++;
      try {
        const value = await redisClient.get(key);
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      } catch (fallbackError: unknown) {
        logger.error(`Error getting Redis key ${key}:`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return null;
      }
    }
  },

  async del(key: string): Promise<number> {
    try {
      const success = await defaultCache.del(key);
      return success ? 1 : 0;
    } catch (error: unknown) {
      try {
        return await redisClient.del(key);
      } catch (fallbackError: unknown) {
        logger.error(`Error deleting Redis key ${key}:`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return 0;
      }
    }
  },

  async exists(key: string): Promise<number> {
    try {
      const exists = await defaultCache.exists(key);
      return exists ? 1 : 0;
    } catch (error: unknown) {
      try {
        return await redisClient.exists(key);
      } catch (fallbackError: unknown) {
        logger.error(`Error checking if Redis key ${key} exists:`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return 0;
      }
    }
  },

  async close(): Promise<void> {
    interface RedisCloseError {
      client: string;
      error: string;
    }
    const errors: RedisCloseError[] = [];
    const closePromises: Promise<string>[] = [];

    closePromises.push(
      defaultCache.getClient().quit().catch(error => {
        errors.push({ client: 'default', error: (error as Error).message });
        return '';
      })
    );
    closePromises.push(
      userCache.getClient().quit().catch(error => {
        errors.push({ client: 'user', error: (error as Error).message });
        return '';
      })
    );
    closePromises.push(
      permissionCache.getClient().quit().catch(error => {
        errors.push({ client: 'permission', error: (error as Error).message });
        return '';
      })
    );
    closePromises.push(
      roleCache.getClient().quit().catch(error => {
        errors.push({ client: 'role', error: (error as Error).message });
        return '';
      })
    );
    closePromises.push(
      redisClient.quit().catch(error => {
        errors.push({ client: 'legacy', error: (error as Error).message });
        return '';
      })
    );

    await Promise.all(closePromises);

    if (errors.length > 0) {
      logger.error('Errors closing Redis connections:', errors);
    } else {
      logger.info('All Redis connections closed successfully');
    }
  },

  async pingRedis(): Promise<boolean> {
    try {
      const response = await defaultCache.getClient().ping();
      return response === 'PONG';
    } catch (error: unknown) {
      try {
        const response = await redisClient.ping();
        return response === 'PONG';
      } catch (fallbackError: unknown) {
        logger.error('Error pinging Redis:', {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return false;
      }
    }
  },

  async cacheUser(userId: string, userData: any, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const cacheKey = `${userId}:user`;
      return await userCache.set(cacheKey, userData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async getCachedUser(userId: string): Promise<any> {
    try {
      const cacheKey = `${userId}:user`;
      const value = await userCache.get<any>(cacheKey);
      this.stats.userCache[value ? 'hits' : 'misses']++;
      return value;
    } catch (error: unknown) {
      this.stats.userCache.misses++;
      logger.warn(`Error getting cached user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  async cachePermission(permissionId: string, permissionData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      const cacheKey = `${permissionId}:permission`;
      return await permissionCache.set(cacheKey, permissionData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching permission ${permissionId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async getCachedPermission(permissionId: string): Promise<any> {
    try {
      const cacheKey = `${permissionId}:permission`;
      const value = await permissionCache.get<any>(cacheKey);
      this.stats.permissionCache[value ? 'hits' : 'misses']++;
      return value;
    } catch (error: unknown) {
      this.stats.permissionCache.misses++;
      logger.warn(`Error getting cached permission ${permissionId}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  async cacheRole(roleId: string, roleData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      const cacheKey = `${roleId}:role`;
      return await roleCache.set(cacheKey, roleData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching role ${roleId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async getCachedRole(roleId: string): Promise<any> {
    try {
      const cacheKey = `${roleId}:role`;
      const value = await roleCache.get<any>(cacheKey);
      this.stats.roleCache[value ? 'hits' : 'misses']++;
      return value;
    } catch (error: unknown) {
      this.stats.roleCache.misses++;
      logger.warn(`Error getting cached role ${roleId}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  async invalidateUserCache(userId: string): Promise<number> {
    try {
      const userPattern = `${userId}:user`;
      const permissionPattern = `${userId}:permissions`;
      const rolePattern = `${userId}:roles`;

      const [userKeys, permissionKeys, roleKeys] = await Promise.all([
        userCache.getClient().keys(userPattern),
        permissionCache.getClient().keys(permissionPattern),
        roleCache.getClient().keys(rolePattern)
      ]);

      const allKeys = [...userKeys, ...permissionKeys, ...roleKeys];
      if (allKeys.length === 0) return 0;

      const deletions = await Promise.all([
        allKeys.length ? userCache.getClient().del(...allKeys) : Promise.resolve(0)
      ]);
      return deletions.reduce((sum, count) => sum + count, 0);
    } catch (error: unknown) {
      logger.warn(`Failed to invalidate cache for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }
};

// Export the Redis utilities
export default {
  redisClient,
  redisUtils,
  defaultCache,
  userCache,
  permissionCache,
  roleCache
};