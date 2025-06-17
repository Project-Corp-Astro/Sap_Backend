/**
 * Redis Legacy Adapter
 * 
 * This adapter provides a backward-compatible interface for the new redis-manager.
 * It allows for gradual migration from the old singleton Redis client to the new service-isolated clients.
 */

import Redis from 'ioredis';
import { createServiceLogger } from './logger';
import { createServiceRedisClient, RedisCache, SERVICE_DB_MAPPING } from './redis-manager';

// Initialize logger
const logger = createServiceLogger('redis-legacy-adapter');

// Main client (compatible with the old singleton pattern)
let mainClient: Redis | null = null;

// Subscribers map
const subscribers: Record<string, Redis> = {};

// Publisher instance
let publisherInstance: Redis | null = null;

/**
 * Legacy Redis client that mimics the original redis.ts interface
 * but uses the new redis-manager.ts implementation under the hood
 */
class RedisLegacyClient {
  /**
   * Initialize Redis client (compatible with original interface)
   * @param options - Redis connection options
   * @returns Redis client instance
   */
  initialize(options = {}): Redis {
    if (mainClient) {
      return mainClient;
    }
    
    // Use the new redis-manager with 'legacy' service name (DB 0)
    mainClient = createServiceRedisClient('legacy', options);
    
    logger.info('Legacy Redis client initialized using the new redis-manager');
    
    return mainClient;
  }

  /**
   * Get Redis client instance
   * @returns Redis client instance
   */
  getClient(): Redis {
    if (!mainClient) {
      return this.initialize();
    }
    return mainClient;
  }

  /**
   * Create a dedicated subscriber client for a channel
   * @param channel - Channel to subscribe to
   * @param callback - Callback function for messages
   * @returns Redis subscriber instance
   */
  createSubscriber(channel: string, callback: (message: any) => void): Redis {
    if (subscribers[channel]) {
      return subscribers[channel];
    }

    // Use new redis-manager with 'legacy-sub' service
    const subscriber = createServiceRedisClient('legacy-sub');
    
    subscriber.on('message', (ch: string, message: string) => {
      if (ch === channel && callback) {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (err) {
          logger.error('Error parsing Redis message', { 
            error: (err as Error).message, 
            channel, 
            message 
          });
          callback(message);
        }
      }
    });

    subscriber.subscribe(channel).then(() => {
      logger.info(`Subscribed to Redis channel: ${channel}`);
    }).catch((err: Error) => {
      logger.error(`Error subscribing to channel: ${channel}`, { error: err.message });
    });

    subscribers[channel] = subscriber;
    return subscriber;
  }

  /**
   * Get publisher client
   * @returns Redis publisher instance
   */
  getPublisher(): Redis {
    if (publisherInstance) {
      return publisherInstance;
    }
    
    // Use new redis-manager with 'legacy-pub' service
    publisherInstance = createServiceRedisClient('legacy-pub');
    return publisherInstance;
  }

  /**
   * Publish message to a channel
   * @param channel - Channel to publish to
   * @param message - Message to publish
   * @returns Number of clients that received the message
   */
  async publish(channel: string, message: any): Promise<number> {
    const publisher = this.getPublisher();
    
    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      return await publisher.publish(channel, messageStr);
    } catch (err) {
      logger.error(`Error publishing to channel ${channel}`, { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Set cache value with expiration
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds
   * @returns Redis response
   */
  async set(key: string, value: any, ttlSeconds: number | string = 3600): Promise<string> {
    const client = this.getClient();
    
    try {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (typeof ttlSeconds === 'string') {
        if (ttlSeconds === 'NX') {
          return await client.set(key, valueStr, 'NX');
        } else if (ttlSeconds === 'XX') {
          return await client.set(key, valueStr, 'XX');
        } else if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
          return await client.set(key, valueStr, 'EX', ttlSeconds);
        }
      }
      return await client.set(key, valueStr);
    } catch (err) {
      logger.error(`Error setting cache key ${key}`, { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Get cache value
   * @param key - Cache key
   * @returns Cached value or null
   */
  async get(key: string): Promise<any> {
    const client = this.getClient();
    
    try {
      const value = await client.get(key);
      
      if (!value) {
        return null;
      }
      
      // Try to parse as JSON, return as string if not valid JSON
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    } catch (err) {
      logger.error(`Error getting cache key ${key}`, { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Delete cache key
   * @param key - Cache key
   * @returns Number of keys removed
   */
  async del(key: string): Promise<number> {
    const client = this.getClient();
    
    try {
      return await client.del(key);
    } catch (err) {
      logger.error(`Error deleting cache key ${key}`, { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Check if key exists
   * @param key - Cache key
   * @returns True if key exists
   */
  async exists(key: string): Promise<boolean> {
    const client = this.getClient();
    
    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (err) {
      logger.error(`Error checking if key ${key} exists`, { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Set key expiration
   * @param key - Cache key
   * @param ttlSeconds - Time to live in seconds
   * @returns 1 if successful, 0 if key doesn't exist
   */
  async expire(key: string, ttlSeconds: number): Promise<number> {
    const client = this.getClient();
    
    try {
      return await client.expire(key, ttlSeconds);
    } catch (err) {
      logger.error(`Error setting expiration for key ${key}`, { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Get time to live for key
   * @param key - Cache key
   * @returns TTL in seconds, -2 if key doesn't exist, -1 if no expiration
   */
  async ttl(key: string): Promise<number> {
    const client = this.getClient();
    
    try {
      return await client.ttl(key);
    } catch (err) {
      logger.error(`Error getting TTL for key ${key}`, { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Find keys matching a pattern
   * @param pattern - Key pattern (e.g., "user:*")
   * @returns Array of matching keys
   */
  async keys(pattern: string): Promise<string[]> {
    const client = this.getClient();
    
    try {
      return await client.keys(pattern);
    } catch (err) {
      logger.error(`Error finding keys matching pattern ${pattern}`, { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Close all Redis connections
   */
  async closeAll(): Promise<void> {
    const closeTasks: Promise<string>[] = [];
    
    if (mainClient) {
      closeTasks.push(mainClient.quit());
    }
    
    if (publisherInstance) {
      closeTasks.push(publisherInstance.quit());
    }
    
    Object.values(subscribers).forEach((subscriber) => {
      closeTasks.push(subscriber.quit());
    });
    
    try {
      await Promise.all(closeTasks);
      logger.info('All Redis connections closed');
      
      mainClient = null;
      publisherInstance = null;
      Object.keys(subscribers).forEach(key => delete subscribers[key]);
    } catch (err) {
      logger.error('Error closing Redis connections', { error: (err as Error).message });
      throw err;
    }
  }
}

// Export singleton instance that's compatible with the original redis.ts
const redisClient = new RedisLegacyClient();

export default redisClient;
