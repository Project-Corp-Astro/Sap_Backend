import Redis from 'ioredis';
import config from '../config';
import logger from './logger';
// Import the new Redis Manager with all required types and functions
import {
  RedisCache,
  createServiceRedisClient,
  SERVICE_DB_MAPPING,
  RedisOptions
} from '../../../../shared/utils/redis-manager';
import type { Redis as IORedis } from 'ioredis';

// Constants
const SERVICE_NAME = 'subscription';

// Create service-specific Redis clients by purpose
const defaultCache = new RedisCache(SERVICE_NAME);
const planCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:plans:` });
const userSubsCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:user-subscriptions:` });

// Local reference to RedisOptions interface for clarity
// RedisOptions fields from redis-manager.ts:
// - host?: string
// - port?: number
// - password?: string
// - db?: number
// - keyPrefix?: string
// - retryStrategy?, maxRetriesPerRequest?, connectTimeout?, etc.

// Create standard Redis client instance (for backward compatibility)
const redisClient: IORedis = createServiceRedisClient(SERVICE_NAME, {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password || undefined,
  // Note: username is not used as it's not in the RedisOptions interface
  // Use service-specific database number from mapping
  db: SERVICE_DB_MAPPING[SERVICE_NAME] || 3, // Fallback to DB 3 for subscription service
});

// Log Redis database information
logger.info(`Subscription service using Redis database ${SERVICE_DB_MAPPING[SERVICE_NAME] || 3}`);

/**
 * Enhanced Redis utilities for the Subscription Service
 * - Uses service-isolated Redis databases
 * - Provides purpose-specific caching for different data types
 * - Includes fault tolerance and fallback mechanisms
 */
const redisUtils = {
  /**
   * Set a key-value pair with optional expiry time
   */
  async set(key: string, value: any, expiryInSeconds?: number): Promise<'OK' | string> {
    try {
      // Use the default cache from RedisManager
      const success = await defaultCache.set(key, value, expiryInSeconds);
      return success ? 'OK' : 'ERROR';
    } catch (error: unknown) {
      // Fall back to legacy client if new client fails
      try {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        if (expiryInSeconds) {
          return await redisClient.set(key, stringValue, 'EX', expiryInSeconds);
        }
        return await redisClient.set(key, stringValue);
      } catch (fallbackError: unknown) {
        // Only log once with both error details
        logger.error(`Error setting Redis key ${key}:`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return 'ERROR'; // Return a safe value instead of throwing
      }
    }
  },

  /**
   * Get a value by key
   */
  async get(key: string): Promise<any> {
    try {
      // Use the default cache from RedisManager
      return await defaultCache.get(key);
    } catch (error: unknown) {
      // Fall back to legacy client
      try {
        const value = await redisClient.get(key);
        if (!value) return null;
        
        // Try to parse as JSON, fallback to original value
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      } catch (fallbackError: unknown) {
        // Only log once with both error details
        logger.error(`Error getting Redis key ${key}:`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return null; // Safe default
      }
    }
  },

  /**
   * Delete a key
   */
  async del(key: string): Promise<number> {
    try {
      const success = await defaultCache.del(key);
      return success ? 1 : 0;
    } catch (error: unknown) {
      // Fall back to legacy client
      try {
        return await redisClient.del(key);
      } catch (fallbackError: unknown) {
        // Only log once with combined error details
        logger.error(`Error deleting Redis key ${key}:`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return 0; // Safe default
      }
    }
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<number> {
    try {
      const exists = await defaultCache.exists(key);
      return exists ? 1 : 0;
    } catch (error: unknown) {
      // Fall back to legacy client
      try {
        return await redisClient.exists(key);
      } catch (fallbackError: unknown) {
        // Only log once with combined error details
        logger.error(`Error checking if Redis key ${key} exists:`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return 0; // Safe default
      }
    }
  },

  /**
   * Set expiry time on a key
   */
  async expire(key: string, seconds: number): Promise<number> {
    try {
      // Attempt with new client via direct client access
      const client = defaultCache.getClient();
      return await client.expire(key, seconds);
    } catch (error: unknown) {
      // Fall back to legacy client
      try {
        return await redisClient.expire(key, seconds);
      } catch (fallbackError: unknown) {
        // Only log once with combined error details
        logger.error(`Error setting expiry on Redis key ${key}:`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return 0; // Safe default
      }
    }
  },

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    // Define type for errors collection
    interface RedisCloseError {
      client: string;
      error: string;
    }
    
    const errors: RedisCloseError[] = [];
    const closePromises: Promise<string>[] = [];
    
    // Close all RedisCache clients
    closePromises.push(
      defaultCache.getClient().quit().catch(error => {
        errors.push({ client: 'default', error: (error as Error).message });
        return ''; // Need to return something to satisfy Promise type
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
    
    // Also close legacy client
    closePromises.push(
      redisClient.quit().catch(error => {
        errors.push({ client: 'legacy', error: (error as Error).message });
        return '';
      })
    );
    
    // Wait for all to complete
    await Promise.all(closePromises);
    
    // Consolidated error logging
    if (errors.length > 0) {
      logger.error('Errors closing Redis connections:', errors);
    } else {
      logger.info('All Redis connections closed successfully');
    }
  },

  /**
   * Ping Redis to check connectivity
   */
  /**
   * Check Redis connectivity by sending a ping command
   * Uses circuit breaker pattern with fallback
   */
  async pingRedis(): Promise<boolean> {
    try {
      // Try with the new RedisCache client first
      const response = await defaultCache.getClient().ping();
      return response === 'PONG';
    } catch (error: unknown) {
      // Fall back to legacy client
      try {
        const response = await redisClient.ping();
        return response === 'PONG';
      } catch (fallbackError: unknown) {
        // Only log once with combined error details
        logger.error('Error pinging Redis:', {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return false;
      }
    }
  },
  
  /**
   * Cache subscription plan data with appropriate TTL
   */
  async cachePlan(planId: string, planData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      return await planCache.set(`plan:${planId}`, planData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching plan ${planId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },
  
  /**
   * Get cached subscription plan
   */
  async getCachedPlan(planId: string): Promise<any> {
    try {
      return await planCache.get(`plan:${planId}`);
    } catch (error: unknown) {
      logger.warn(`Error getting cached plan ${planId}, returning uncached data:`, { error: error instanceof Error ? error.message : String(error) });
      return null; // Will cause a fresh fetch from database
    }
  },
  
  /**
   * Cache user subscriptions
   */
  async cacheUserSubscriptions(userId: string, subscriptions: any[], ttlSeconds: number = 1800): Promise<boolean> {
    try {
      return await userSubsCache.set(`user:${userId}:subscriptions`, subscriptions, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching subscriptions for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false; // Operation failed but we can continue without cached data
    }
  },
  
  /**
   * Get cached user subscriptions
   */
  async getCachedUserSubscriptions(userId: string): Promise<any[]> {
    try {
      const cached = await userSubsCache.get(`user:${userId}:subscriptions`) as any[];
      return cached || [];
    } catch (error: unknown) {
      logger.warn(`Error getting cached subscriptions for user ${userId}, returning empty array:`, { error: error instanceof Error ? error.message : String(error) });
      return []; // Safe default
    }
  },
  
  /**
   * Invalidate all cache entries for a user
   */
  async invalidateUserCache(userId: string): Promise<number> {
    try {
      const pattern = `user:${userId}:*`;
      const keys = await userSubsCache.getClient().keys(pattern);
      
      if (keys.length === 0) return 0;
      
      return await userSubsCache.getClient().del(...keys);
    } catch (error: unknown) {
      logger.warn(`Failed to invalidate cache for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      // Log as warning instead of error since this is not critical - data will expire naturally
      return 0;
    }
  }
};

export { redisClient, redisUtils, planCache, userSubsCache };
export default redisUtils;
