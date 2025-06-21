import Redis from 'ioredis';
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
const SERVICE_NAME = 'content';
const DB_NUMBER = 4; // Use DB 4 as specified

// Create service-specific Redis clients by purpose
const contentCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:content:` });
const mediaCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:media:` });
const videoCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:video:` });
const categoryCache = new RedisCache(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:category:` });

// Create standard Redis client instance (for backward compatibility)
const redisClient: IORedis = createServiceRedisClient(SERVICE_NAME, {
  host: config.get('redis.host', 'localhost'),
  port: parseInt(config.get('redis.port', '6379')),
  password: config.get('redis.password', '') || undefined,
  db: SERVICE_DB_MAPPING[SERVICE_NAME] || DB_NUMBER, // Fallback to DB 1 for auth service
});

// Log Redis database information
logger.info(`Content service using Redis database ${SERVICE_DB_MAPPING[SERVICE_NAME] || DB_NUMBER}`);

/**
 * Enhanced Redis utilities for the Content Service
 * - Uses service-isolated Redis databases
 * - Provides purpose-specific caching for different data types
 * - Includes fault tolerance and fallback mechanisms
 * - Tracks cache hit/miss statistics
 */
interface RedisUtils {
  stats: {
    contentCache: { hits: number; misses: number };
    mediaCache: { hits: number; misses: number };
    videoCache: { hits: number; misses: number };
    categoryCache: { hits: number; misses: number };
  };
  getStats: () => {
    contentCache: { hits: number; misses: number; hitRate: number };
    mediaCache: { hits: number; misses: number; hitRate: number };
    videoCache: { hits: number; misses: number; hitRate: number };
    categoryCache: { hits: number; misses: number; hitRate: number };
  };
  set: (key: string, value: any, expiryInSeconds?: number) => Promise<'OK' | string>;
  get: (key: string) => Promise<any>;
  del: (key: string) => Promise<number>;
  exists: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  close: () => Promise<void>;
  pingRedis: () => Promise<boolean>;
  cacheVideo: (videoId: string, videoData: any, ttlSeconds?: number) => Promise<boolean>;
  getCachedVideo: (videoId: string) => Promise<any>;
  cacheMedia: (mediaId: string, mediaData: any, ttlSeconds?: number) => Promise<boolean>;
  getCachedMedia: (mediaId: string) => Promise<any>;
  cacheCategory: (categoryId: string, categoryData: any, ttlSeconds?: number) => Promise<boolean>;
  getCachedCategory: (categoryId: string) => Promise<any>;
  invalidateCategoryCache: (categoryId: string) => Promise<number>;
}

const redisUtils: RedisUtils = {
  // Cache statistics
  stats: {
    contentCache: { hits: 0, misses: 0 },
    mediaCache: { hits: 0, misses: 0 },
    videoCache: { hits: 0, misses: 0 },
    categoryCache: { hits: 0, misses: 0 }
  },

  /**
   * Get cache statistics
   * @returns Cache hit/miss statistics and hit rates
   */
  getStats() {
    return {
      contentCache: {
        ...this.stats.contentCache,
        hitRate: this.stats.contentCache.hits / (this.stats.contentCache.hits + this.stats.contentCache.misses) || 0
      },
      mediaCache: {
        ...this.stats.mediaCache,
        hitRate: this.stats.mediaCache.hits / (this.stats.mediaCache.hits + this.stats.mediaCache.misses) || 0
      },
      videoCache: {
        ...this.stats.videoCache,
        hitRate: this.stats.videoCache.hits / (this.stats.videoCache.hits + this.stats.videoCache.misses) || 0
      },
      categoryCache: {
        ...this.stats.categoryCache,
        hitRate: this.stats.categoryCache.hits / (this.stats.categoryCache.hits + this.stats.categoryCache.misses) || 0
      }
    };
  },

  /**
   * Set a key-value pair with optional expiry time
   */
  async set(key: string, value: any, expiryInSeconds?: number): Promise<'OK' | string> {
    try {
      const success = await contentCache.set(key, value, expiryInSeconds);
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

  /**
   * Get a value by key
   */
  async get(key: string): Promise<any> {
    try {
      const value = await contentCache.get(key);
      this.stats.contentCache[value ? 'hits' : 'misses']++;
      return value;
    } catch (error: unknown) {
      this.stats.contentCache.misses++;
      try {
        const value = await redisClient.get(key);
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch (e) {
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

  /**
   * Delete a key
   */
  async del(key: string): Promise<number> {
    try {
      const success = await contentCache.del(key);
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

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<number> {
    try {
      const exists = await contentCache.exists(key);
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

  /**
   * Set expiry time on a key
   */
  async expire(key: string, seconds: number): Promise<number> {
    try {
      const client = contentCache.getClient();
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

  /**
   * Close Redis connections
   */
  async close(): Promise<void> {
    interface RedisCloseError {
      client: string;
      error: string;
    }
    
    const errors: RedisCloseError[] = [];
    const closePromises: Promise<string>[] = [];
    
    closePromises.push(
      contentCache.getClient().quit().catch(error => {
        errors.push({ client: 'content', error: (error as Error).message });
        return '';
      })
    );
    
    closePromises.push(
      mediaCache.getClient().quit().catch(error => {
        errors.push({ client: 'media', error: (error as Error).message });
        return '';
      })
    );
    
    closePromises.push(
      videoCache.getClient().quit().catch(error => {
        errors.push({ client: 'video', error: (error as Error).message });
        return '';
      })
    );
    
    closePromises.push(
      categoryCache.getClient().quit().catch(error => {
        errors.push({ client: 'category', error: (error as Error).message });
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

  /**
   * Check Redis connectivity
   */
  async pingRedis(): Promise<boolean> {
    try {
      const response = await contentCache.getClient().ping();
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

  /**
   * Cache video content with appropriate TTL
   */
  async cacheVideo(videoId: string, videoData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      return await videoCache.set(`video:${videoId}`, videoData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching video ${videoId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  /**
   * Get cached video content
   */
  async getCachedVideo(videoId: string): Promise<any> {
    try {
      const value = await videoCache.get(`video:${videoId}`);
      this.stats.videoCache[value ? 'hits' : 'misses']++;
      return value;
    } catch (error: unknown) {
      this.stats.videoCache.misses++;
      logger.warn(`Error getting cached video ${videoId}, returning uncached data:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  /**
   * Cache media content with appropriate TTL
   */
  async cacheMedia(mediaId: string, mediaData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      return await mediaCache.set(`media:${mediaId}`, mediaData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching media ${mediaId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  /**
   * Get cached media content
   */
  async getCachedMedia(mediaId: string): Promise<any> {
    try {
      const value = await mediaCache.get(`media:${mediaId}`);
      this.stats.mediaCache[value ? 'hits' : 'misses']++;
      return value;
    } catch (error: unknown) {
      this.stats.mediaCache.misses++;
      logger.warn(`Error getting cached media ${mediaId}, returning uncached data:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  /**
   * Cache category content with appropriate TTL
   */
  async cacheCategory(categoryId: string, categoryData: any, ttlSeconds: number = 3600): Promise<boolean> {
    try {
      return await categoryCache.set(`category:${categoryId}`, categoryData, ttlSeconds);
    } catch (error: unknown) {
      logger.error(`Error caching category ${categoryId}:`, { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  },

  /**
   * Get cached category content
   */
  async getCachedCategory(categoryId: string): Promise<any> {
    try {
      const value = await categoryCache.get(`category:${categoryId}`);
      this.stats.categoryCache[value ? 'hits' : 'misses']++;
      return value;
    } catch (error: unknown) {
      this.stats.categoryCache.misses++;
      logger.warn(`Error getting cached category ${categoryId}, returning uncached data:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  /**
   * Invalidate all cache entries for a category
   */
  async invalidateCategoryCache(categoryId: string): Promise<number> {
    try {
      const pattern = `category:${categoryId}:*`;
      const keys = await categoryCache.getClient().keys(pattern);
      
      if (keys.length === 0) return 0;
      
      return await categoryCache.getClient().del(...keys);
    } catch (error: unknown) {
      logger.warn(`Failed to invalidate cache for category ${categoryId}:`, { error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }
};

// Export all cache utilities and clients
export { redisClient, redisUtils, contentCache, mediaCache, videoCache, categoryCache };
export default redisUtils;