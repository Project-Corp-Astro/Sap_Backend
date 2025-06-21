import Redis from 'ioredis';
import config from '../config';
import logger from './logger';
import {
  RedisCache,
  createServiceRedisClient,
  SERVICE_DB_MAPPING,
  RedisOptions
} from '../../../../shared/utils/redis-manager';
import type { Redis as IORedis } from 'ioredis';

// Constants
const SERVICE_NAME = 'subscription';
const DB_NUMBER = 3;

// Create service-specific Redis clients
const defaultCache = new RedisCache(SERVICE_NAME);
const planCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:plans:` });
const userSubsCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:user-subscriptions:` });
const promoCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:promos:` });

// Create standard Redis client instance
const redisClient: IORedis = createServiceRedisClient(SERVICE_NAME, {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  db: SERVICE_DB_MAPPING[SERVICE_NAME] || DB_NUMBER
});

// Connection event handlers
redisClient.on('error', (error) => logger.error('Redis client error:', { error: error.message }));
redisClient.on('connect', () => logger.info('Redis client connected successfully'));
redisClient.on('end', () => logger.warn('Redis client disconnected'));
redisClient.on('reconnecting', () => logger.info('Redis client reconnecting...'));

// Log Redis database information
logger.info(`Subscription service using Redis database ${SERVICE_DB_MAPPING[SERVICE_NAME] || DB_NUMBER}`);

/**
 * Enhanced Redis utilities for the Subscription Service
 * - Uses service-isolated Redis databases
 * - Provides purpose-specific caching for different data types
 * - Includes fault tolerance and fallback mechanisms
 * - Tracks cache hit/miss statistics
 */
interface RedisUtils {
  stats: {
    defaultCache: { hits: number; misses: number };
    planCache: { hits: number; misses: number };
    userSubsCache: { hits: number; misses: number };
    promoCache: { hits: number; misses: number };
  };
  getStats: () => {
    defaultCache: { hits: number; misses: number; hitRate: number };
    planCache: { hits: number; misses: number; hitRate: number };
    userSubsCache: { hits: number; misses: number; hitRate: number };
    promoCache: { hits: number; misses: number; hitRate: number };
  };
  set: <T>(key: string, value: T, expiryInSeconds?: number) => Promise<'OK' | string>;
  get: <T>(key: string) => Promise<T | null>;
  del: (key: string) => Promise<number>;
  exists: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  close: () => Promise<void>;
  pingRedis: () => Promise<boolean>;
  cachePlan: (planId: string, planData: any, ttlSeconds?: number) => Promise<boolean>;
  getCachedPlan: (planId: string) => Promise<any>;
  cacheUserSubscriptions: (userId: string, subscriptions: any[], ttlSeconds?: number) => Promise<boolean>;
  getCachedUserSubscriptions: (userId: string) => Promise<any[]>;
  cachePromo: (promoId: string, promoData: any, ttlSeconds?: number) => Promise<boolean>;
  getCachedPromo: (promoId: string) => Promise<any>;
  invalidateUserCache: (userId: string) => Promise<number>;
}

const redisUtils: RedisUtils = {
  stats: {
    defaultCache: { hits: 0, misses: 0 },
    planCache: { hits: 0, misses: 0 },
    userSubsCache: { hits: 0, misses: 0 },
    promoCache: { hits: 0, misses: 0 }
  },

  getStats() {
    return {
      defaultCache: {
        ...this.stats.defaultCache,
        hitRate: this.stats.defaultCache.hits / (this.stats.defaultCache.hits + this.stats.defaultCache.misses) || 0
      },
      planCache: {
        ...this.stats.planCache,
        hitRate: this.stats.planCache.hits / (this.stats.planCache.hits + this.stats.planCache.misses) || 0
      },
      userSubsCache: {
        ...this.stats.userSubsCache,
        hitRate: this.stats.userSubsCache.hits / (this.stats.userSubsCache.hits + this.stats.userSubsCache.misses) || 0
      },
      promoCache: {
        ...this.stats.promoCache,
        hitRate: this.stats.promoCache.hits / (this.stats.promoCache.hits + this.stats.promoCache.misses) || 0
      }
    };
  },

  async set<T>(key: string, value: T, expiryInSeconds?: number): Promise<'OK' | string> {
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

  async get<T>(key: string): Promise<T | null> {
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

  async expire(key: string, seconds: number): Promise<number> {
    try {
      const client = defaultCache.getClient();
      return await client.expire(key, seconds);
    } catch (error: unknown) {
      try {
        return await redisClient.expire(key, seconds);
      } catch (fallbackError: unknown) {
        logger.error(`Error setting expiry on Redis key ${key}:`, {
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
      planCache.getClient().quit().catch(error => {
        errors.push({ client: 'plan', error: (error as Error).message });
        return '';
      })
    );
    closePromises.push(
      userSubsCache.getClient().quit().catch(error => {
        errors.push({ client: 'user-subs', error: (error as Error).message });
        return '';
      })
    );
    closePromises.push(
      promoCache.getClient().quit().catch(error => {
        errors.push({ client: 'promo', error: (error as Error).message });
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

  async cachePlan(planId: string, planData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      return await planCache.set(`plan:${planId}`, planData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching plan ${planId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async getCachedPlan(planId: string): Promise<any> {
    try {
      const value = await planCache.get(`plan:${planId}`);
      this.stats.planCache[value ? 'hits' : 'misses']++;
      return value;
    } catch (error: unknown) {
      this.stats.planCache.misses++;
      logger.warn(`Error getting cached plan ${planId}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  async cacheUserSubscriptions(userId: string, subscriptions: any[], ttlSeconds: number = 1800): Promise<boolean> {
    try {
      return await userSubsCache.set(`user:${userId}:subscriptions`, subscriptions, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching subscriptions for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async getCachedUserSubscriptions(userId: string): Promise<any[]> {
    try {
      const value = await userSubsCache.get(`user:${userId}:subscriptions`) as any[];
      this.stats.userSubsCache[value ? 'hits' : 'misses']++;
      return value || [];
    } catch (error: unknown) {
      this.stats.userSubsCache.misses++;
      logger.warn(`Error getting cached subscriptions for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  },

  async cachePromo(promoId: string, promoData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      return await promoCache.set(`promo:${promoId}`, promoData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching promo ${promoId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async getCachedPromo(promoId: string): Promise<any> {
    try {
      const value = await promoCache.get(`promo:${promoId}`);
      this.stats.promoCache[value ? 'hits' : 'misses']++;
      return value;
    } catch (error: unknown) {
      this.stats.promoCache.misses++;
      logger.warn(`Error getting cached promo ${promoId}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  async invalidateUserCache(userId: string): Promise<number> {
    try {
      const pattern = `user:${userId}:*`;
      const keys = await userSubsCache.getClient().keys(pattern);
      if (keys.length === 0) return 0;
      return await userSubsCache.getClient().del(...keys);
    } catch (error: unknown) {
      logger.warn(`Failed to invalidate cache for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }
};

export { redisClient, redisUtils, defaultCache, planCache, userSubsCache, promoCache };
export default redisUtils;