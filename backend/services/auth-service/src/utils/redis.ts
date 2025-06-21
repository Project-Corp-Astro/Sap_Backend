import logger from '../../../../shared/utils/logger';
import config from '../../../../shared/config';
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
const userCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:users:` }); // New user cache

// Create standard Redis client instance (for backward compatibility)
const redisClient: IORedis = createServiceRedisClient(SERVICE_NAME, {
  host: config.get('redis.host', 'localhost'),
  port: parseInt(config.get('redis.port', '6379')),
  password: config.get('redis.password', '') || undefined,
  db: SERVICE_DB_MAPPING[SERVICE_NAME] || 1, // Fallback to DB 1 for auth service
});

// Log Redis database information
logger.info(`Auth service using Redis database ${SERVICE_DB_MAPPING[SERVICE_NAME] || 1}`);

// Enhanced Redis utilities for the Auth Service
const redisUtils = {
  async set(key: string, value: any, expiryInSeconds?: number): Promise<'OK' | string> {
    try {
      const success = await defaultCache.set(key, value, expiryInSeconds);
      return success ? 'OK' : 'ERROR';
    } catch (error: unknown) {
      try {
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        if (expiryInSeconds) {
          return await redisClient.set(key, stringValue, 'EX', expiryInSeconds);
        }
        return await redisClient.set(key, stringValue);
      } catch (fallbackError: unknown) {
        logger.error(`Error setting Redis key ${key}:`, {
          primaryError: error instanceof Error ? error.message : String(error),
          fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        return 'ERROR';
      }
    }
  },

  async get(key: string): Promise<any> {
    try {
      return await defaultCache.get(key);
    } catch (error: unknown) {
      try {
        const value = await redisClient.get(key);
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch {
          return value;
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
    
    closePromises.push(
      userCache.getClient().quit().catch(error => {
        errors.push({ client: 'userCache', error: error instanceof Error ? error.message : String(error) });
        return '';
      })
    );
    
    closePromises.push(
      redisClient.quit().catch(error => {
        errors.push({ client: 'legacy', error: error instanceof Error ? error.message : String(error) });
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

  async cacheSession(sessionId: string, sessionData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      const success = await sessionCache.set(`session:${sessionId}`, sessionData, ttlSeconds);
      if (success) {
        logger.debug(`Stored session in cache key: auth:sessions:session:${sessionId} with TTL ${ttlSeconds} seconds in Redis DB1`);
      }
      return success;
    } catch (error: unknown) {
      logger.error(`Error caching session ${sessionId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async getCachedSession(sessionId: string): Promise<any> {
    try {
      const sessionData = await sessionCache.get(`session:${sessionId}`);
      if (sessionData) {
        logger.debug(`Cache hit for session key: auth:sessions:session:${sessionId} in Redis DB1`);
      } else {
        logger.debug(`Cache miss for session key: auth:sessions:session:${sessionId} in Redis DB1`);
      }
      return sessionData;
    } catch (error: unknown) {
      logger.warn(`Error getting cached session ${sessionId}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  async setOTP(userId: string, otpType: string, otpValue: string, ttlSeconds: number = 300): Promise<boolean> {
    try {
      const key = `otp:${userId}:${otpType}`;
      const success = await otpCache.set(key, otpValue, ttlSeconds);
      if (success) {
        logger.debug(`Stored OTP in cache key: auth:otp:${key} with TTL ${ttlSeconds} seconds in Redis DB1`);
      }
      return success;
    } catch (error: unknown) {
      logger.error(`Error storing OTP for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async verifyAndConsumeOTP(userId: string, otpType: string, providedOtp: string): Promise<boolean> {
    try {
      const key = `otp:${userId}:${otpType}`;
      const fullKey = `auth:otp:${key}`;
      const storedOtp = await otpCache.get(key) as string;
      
      if (!storedOtp) {
        logger.debug(`Cache miss or expired OTP for key: ${fullKey} in Redis DB1`);
        return false;
      }
      
      if (storedOtp !== providedOtp) {
        logger.warn(`Invalid OTP for key: ${fullKey} in Redis DB1`);
        return false;
      }
      
      const success = await otpCache.del(key);
      if (success) {
        logger.debug(`Deleted OTP cache key: ${fullKey} in Redis DB1`);
      }
      return true;
    } catch (error: unknown) {
      logger.warn(`Error verifying OTP for user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async trackFailedLogin(username: string, ip: string): Promise<number> {
    try {
      const key = `failed:${username}:${ip}`;
      const fullKey = `auth:${key}`;
      const attempts = await defaultCache.get<number>(key) || 0;
      const newAttempts = attempts + 1;
      
      const success = await defaultCache.set(key, newAttempts, 1800);
      if (success) {
        logger.debug(`Stored ${newAttempts} failed login attempts in cache key: ${fullKey} with TTL 1800 seconds in Redis DB1`);
      }
      return newAttempts;
    } catch (error: unknown) {
      logger.warn(`Failed to track login attempts for ${username}:`, { error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  },

  async resetFailedLogins(username: string, ip: string): Promise<boolean> {
    try {
      const key = `failed:${username}:${ip}`;
      const fullKey = `auth:${key}`;
      const success = await defaultCache.del(key);
      if (success) {
        logger.debug(`Deleted failed login attempts cache key: ${fullKey} in Redis DB1`);
      }
      return success;
    } catch (error: unknown) {
      logger.warn(`Failed to reset login attempts for ${username}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async cacheUser(userId: string, userData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      const key = `user:${userId}`;
      const success = await userCache.set(key, userData, ttlSeconds);
      if (success) {
        logger.debug(`Stored user data in cache key: auth:users:${key} with TTL ${ttlSeconds} seconds in Redis DB1`);
      }
      return success;
    } catch (error: unknown) {
      logger.error(`Error caching user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  async getCachedUser(userId: string): Promise<any> {
    try {
      const key = `user:${userId}`;
      const userData = await userCache.get(key);
      if (userData) {
        logger.debug(`Cache hit for user key: auth:users:${key} in Redis DB1`);
      } else {
        logger.debug(`Cache miss for user key: auth:users:${key} in Redis DB1`);
      }
      return userData;
    } catch (error: unknown) {
      logger.warn(`Error getting cached user ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  async invalidateUserCache(userId: string): Promise<void> {
    try {
      const key = `user:${userId}`;
      const fullKey = `auth:users:${key}`;
      const success = await userCache.del(key);
      if (success) {
        logger.debug(`Deleted user cache key: ${fullKey} in Redis DB1`);
      }
    } catch (error: unknown) {
      logger.warn(`Failed to invalidate user cache for ${userId}:`, { error: error instanceof Error ? error.message : String(error) });
    }
  },

  async invalidateSessionCache(sessionId: string): Promise<void> {
    try {
      const key = `session:${sessionId}`;
      const fullKey = `auth:sessions:${key}`;
      const success = await sessionCache.del(key);
      if (success) {
        logger.debug(`Deleted session cache key: ${fullKey} in Redis DB1`);
      }
    } catch (error: unknown) {
      logger.warn(`Failed to invalidate session cache for ${sessionId}:`, { error: error instanceof Error ? error.message : String(error) });
    }
  }
};

export { redisClient, redisUtils, sessionCache, otpCache, userCache,defaultCache };
export default redisClient;