import logger from '../../../../shared/utils/logger';
import config from '../../../../shared/config';
// Import the Redis Manager with all required types and functions
import {
  RedisCache,
  createServiceRedisClient,
  SERVICE_DB_MAPPING,
  RedisOptions
} from '../../../../shared/utils/redis-manager';
import type { Redis as IORedis } from 'ioredis';

// Constants
const SERVICE_NAME = 'auth';

// Create service-specific Redis clients by purpose
const defaultCache = new RedisCache(SERVICE_NAME);
const sessionCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:sessions:` });
const otpCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:otp:` });

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
  host: config.get('redis.host', 'localhost'),
  port: parseInt(config.get('redis.port', '6379')),
  password: config.get('redis.password', '') || undefined,
  // Note: username is not used as it's not in the RedisOptions interface
  // Use service-specific database number from mapping
  db: SERVICE_DB_MAPPING[SERVICE_NAME] || 1, // Fallback to DB 1 for auth service
});

// Log Redis database information
logger.info(`Auth service using Redis database ${SERVICE_DB_MAPPING[SERVICE_NAME] || 1}`);

/**
 * Enhanced Redis utilities for the Auth Service
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
        errors.push({ client: 'defaultCache', error: error instanceof Error ? error.message : String(error) });
        return '';
      })
    );
    
    closePromises.push(
      sessionCache.getClient().quit().catch(error => {
        errors.push({ client: 'sessionCache', error: error instanceof Error ? error.message : String(error) });
        return '';
      })
    );
    
    closePromises.push(
      otpCache.getClient().quit().catch(error => {
        errors.push({ client: 'otpCache', error: error instanceof Error ? error.message : String(error) });
        return '';
      })
    );
    
    // Also close legacy client
    closePromises.push(
      redisClient.quit().catch(error => {
        errors.push({ client: 'legacy', error: error instanceof Error ? error.message : String(error) });
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
   * Cache session data with appropriate TTL
   */
  async cacheSession(sessionId: string, sessionData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      return await sessionCache.set(`session:${sessionId}`, sessionData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching session ${sessionId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },
  
  /**
   * Get cached session data
   */
  async getCachedSession(sessionId: string): Promise<any> {
    try {
      return await sessionCache.get(`session:${sessionId}`);
    } catch (error: unknown) {
      logger.warn(`Error getting cached session ${sessionId}, returning uncached data:`, { error: error instanceof Error ? error.message : String(error) });
      return null; // Will cause a fresh fetch from database
    }
  },
  
  /**
   * Store OTP (One-Time Password) with expiry
   */
  async setOTP(userId: string, otpType: string, otpValue: string, ttlSeconds: number = 300): Promise<boolean> {
    try {
      return await otpCache.set(`otp:${userId}:${otpType}`, otpValue, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error storing OTP for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false; // Operation failed but we can continue without cached data
    }
  },
  
  /**
   * Verify OTP and delete if valid
   */
  async verifyAndConsumeOTP(userId: string, otpType: string, providedOtp: string): Promise<boolean> {
    try {
      const key = `otp:${userId}:${otpType}`;
      const storedOtp = await otpCache.get(key) as string;
      
      if (!storedOtp || storedOtp !== providedOtp) {
        return false;
      }
      
      // OTP is valid - delete it to prevent reuse
      await otpCache.del(key);
      return true;
    } catch (error: unknown) {
      logger.warn(`Error verifying OTP for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false; // Safe default
    }
  },
  
  /**
   * Track failed login attempts with expiry
   */
  async trackFailedLogin(username: string, ip: string): Promise<number> {
    try {
      const key = `failed:${username}:${ip}`;
      const attempts = await defaultCache.get<number>(key) || 0;
      const newAttempts = attempts + 1;
      
      // Store with a 30 minute expiry
      await defaultCache.set(key, newAttempts, 1800);
      return newAttempts;
    } catch (error: unknown) {
      logger.warn(`Failed to track login attempts for ${username}:`, { error: error instanceof Error ? error.message : String(error) });
      // Return a safe default that won't trigger account lockout
      return 0;
    }
  },
  
  /**
   * Reset failed login attempts counter
   */
  async resetFailedLogins(username: string, ip: string): Promise<boolean> {
    try {
      const key = `failed:${username}:${ip}`;
      return await defaultCache.del(key);
    } catch (error: unknown) {
      logger.warn(`Failed to reset login attempts for ${username}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
};

// Export both the legacy client and the new utilities
export { redisClient, redisUtils, sessionCache, otpCache };
export default redisClient; // For backward compatibility
