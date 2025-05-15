/**
 * Cache Service
 * Provides caching functionality for the application using Redis
 */

import { createServiceLogger } from '../../shared/utils/logger';
import redisClient from '../../shared/utils/redis';

const logger = createServiceLogger('cache-service');

export class CacheService {
  /**
   * Default TTL in seconds (1 hour)
   */
  private defaultTTL = 3600;

  /**
   * Get item from cache
   * @param key - Cache key
   * @returns Cached item or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      return await redisClient.get(key);
    } catch (error) {
      logger.error(`Error getting item from cache: ${key}`, { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Set item in cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional)
   * @returns Success status
   */
  async set<T>(key: string, value: T, ttl: number = this.defaultTTL): Promise<boolean> {
    try {
      await redisClient.set(key, value, ttl);
      return true;
    } catch (error) {
      logger.error(`Error setting item in cache: ${key}`, { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Delete item from cache
   * @param key - Cache key
   * @returns Success status
   */
  async delete(key: string): Promise<boolean> {
    try {
      await redisClient.del(key);
      return true;
    } catch (error) {
      logger.error(`Error deleting item from cache: ${key}`, { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Get or set item in cache
   * @param key - Cache key
   * @param fallback - Function to call if item is not in cache
   * @param ttl - Time to live in seconds (optional)
   * @returns Cached or fallback value
   */
  async getOrSet<T>(key: string, fallback: () => Promise<T>, ttl: number = this.defaultTTL): Promise<T> {
    try {
      // Try to get from cache first
      const cachedValue = await this.get<T>(key);
      
      if (cachedValue !== null) {
        logger.debug(`Cache hit: ${key}`);
        return cachedValue;
      }
      
      // Not in cache, get from fallback
      logger.debug(`Cache miss: ${key}`);
      const value = await fallback();
      
      // Store in cache
      await this.set(key, value, ttl);
      
      return value;
    } catch (error) {
      logger.error(`Error in getOrSet: ${key}`, { error: (error as Error).message });
      // If cache fails, still try to get the actual value
      return await fallback();
    }
  }

  /**
   * Delete multiple items from cache by pattern
   * @param pattern - Key pattern to match
   * @returns Number of deleted keys
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      // Get all keys matching pattern
      const keys = await redisClient.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      // Delete all matching keys
      await Promise.all(keys.map(key => redisClient.del(key)));
      
      logger.debug(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
      
      return keys.length;
    } catch (error) {
      logger.error(`Error deleting keys by pattern: ${pattern}`, { error: (error as Error).message });
      return 0;
    }
  }

  /**
   * Increment a counter in cache
   * @param key - Cache key
   * @param increment - Amount to increment (default: 1)
   * @param ttl - Time to live in seconds (optional)
   * @returns New counter value
   */
  async increment(key: string, increment: number = 1, ttl: number = this.defaultTTL): Promise<number> {
    try {
      const client = redisClient.getClient();
      const value = await client.incrby(key, increment);
      
      // Set expiry if not already set
      await client.expire(key, ttl);
      
      return typeof value === 'number' ? value : 0;
    } catch (error) {
      logger.error(`Error incrementing counter: ${key}`, { error: (error as Error).message });
      return 0;
    }
  }

  /**
   * Decrement a counter in cache
   * @param key - Cache key
   * @param decrement - Amount to decrement (default: 1)
   * @param ttl - Time to live in seconds (optional)
   * @returns New counter value
   */
  async decrement(key: string, decrement: number = 1, ttl: number = this.defaultTTL): Promise<number> {
    try {
      const client = redisClient.getClient();
      const value = await client.decrby(key, decrement);
      
      // Set expiry if not already set
      await client.expire(key, ttl);
      
      return typeof value === 'number' ? value : 0;
    } catch (error) {
      logger.error(`Error decrementing counter: ${key}`, { error: (error as Error).message });
      return 0;
    }
  }

  /**
   * Add item to a set
   * @param key - Set key
   * @param member - Member to add
   * @param ttl - Time to live in seconds (optional)
   * @returns Success status
   */
  async addToSet(key: string, member: string, ttl: number = this.defaultTTL): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      await client.sadd(key, member);
      
      // Set expiry if not already set
      await client.expire(key, ttl);
      
      return true;
    } catch (error) {
      logger.error(`Error adding to set: ${key}`, { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Check if set contains member
   * @param key - Set key
   * @param member - Member to check
   * @returns True if member exists in set
   */
  async isInSet(key: string, member: string): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      const result = await client.sismember(key, member);
      return Boolean(result);
    } catch (error) {
      logger.error(`Error checking set membership: ${key}`, { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Remove item from a set
   * @param key - Set key
   * @param member - Member to remove
   * @returns Success status
   */
  async removeFromSet(key: string, member: string): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      await client.srem(key, member);
      return true;
    } catch (error) {
      logger.error(`Error removing from set: ${key}`, { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Get all members of a set
   * @param key - Set key
   * @returns Array of set members
   */
  async getSetMembers(key: string): Promise<string[]> {
    try {
      const client = redisClient.getClient();
      return await client.smembers(key);
    } catch (error) {
      logger.error(`Error getting set members: ${key}`, { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Set hash field
   * @param key - Hash key
   * @param field - Hash field
   * @param value - Value to set
   * @param ttl - Time to live in seconds (optional)
   * @returns Success status
   */
  async hashSet(key: string, field: string, value: any, ttl: number = this.defaultTTL): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      await client.hset(key, field, value);
      
      // Set expiry if not already set
      await client.expire(key, ttl);
      
      return true;
    } catch (error) {
      logger.error(`Error setting hash field: ${key}.${field}`, { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Get hash field
   * @param key - Hash key
   * @param field - Hash field
   * @returns Field value or null if not found
   */
  async hashGet<T>(key: string, field: string): Promise<T | null> {
    try {
      const client = redisClient.getClient();
      return await client.hget(key, field) as T | null;
    } catch (error) {
      logger.error(`Error getting hash field: ${key}.${field}`, { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Get all hash fields
   * @param key - Hash key
   * @returns Object with all hash fields
   */
  async hashGetAll<T>(key: string): Promise<Record<string, T> | null> {
    try {
      const client = redisClient.getClient();
      return await client.hgetall(key) as Record<string, T> | null;
    } catch (error) {
      logger.error(`Error getting all hash fields: ${key}`, { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Delete hash field
   * @param key - Hash key
   * @param field - Hash field
   * @returns Success status
   */
  async hashDelete(key: string, field: string): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      await client.hdel(key, field);
      return true;
    } catch (error) {
      logger.error(`Error deleting hash field: ${key}.${field}`, { error: (error as Error).message });
      return false;
    }
  }
}

// Create and export a singleton instance
const cacheService = new CacheService();
export default cacheService;
