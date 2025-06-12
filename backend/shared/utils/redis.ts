/**
 * Redis Client Utility
 * Provides a centralized Redis client for caching, session storage, and pub/sub
 */

import Redis from 'ioredis';
import { createServiceLogger } from './logger';
import config from '../config/index';
import { mockRedisClient } from './mock-database';

// Determine if we should use mock databases
const USE_MOCK_DATABASES = process.env.USE_MOCK_DATABASES === 'true' || process.env.NODE_ENV === 'development';

// Initialize logger
const logger = createServiceLogger('redis-client');

// Define interfaces
interface RedisOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryStrategy?: (times: number) => number | null;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
  commandTimeout?: number;
}

// Default Redis configuration
const defaultConfig: RedisOptions = {
  host: config.get('redis.host', 'localhost'),
  port: parseInt(config.get('redis.port', '6379')),
  password: config.get('redis.password', ''),
  db: parseInt(config.get('redis.db', '0')),
  keyPrefix: config.get('redis.keyPrefix', 'sap:'),
  maxRetriesPerRequest: 5,  // Increased from 3 to 5
  connectTimeout: 10000,    // Increased from 5s to 10s
  commandTimeout: 8000,     // Increased from 3s to 8s
  retryStrategy: (times: number) => {
    // Limit retry attempts to 5
    if (times > 5) {
      logger.warn('Redis connection retry limit reached, stopping reconnection attempts');
      return null; // Stop retrying
    }
    
    const delay = Math.min(times * 200, 2000); // Increased delay
    logger.info(`Redis connection retry in ${delay}ms (attempt ${times})`);
    return delay;
  }
};

/**
 * Redis client singleton
 */
class RedisClient {
  private client: Redis | null;
  private subscribers: Record<string, Redis>;
  private publisher: Redis | null;

  constructor() {
    this.client = null;
    this.subscribers = {};
    this.publisher = null;
  }

  /**
   * Initialize Redis client
   * @param options - Redis connection options
   * @returns Redis client instance
   */
  initialize(options: RedisOptions = {}): Redis {
    if (this.client) {
      return this.client;
    }

    const redisOptions = { ...defaultConfig, ...options };
    
    // Create Redis client
    this.client = new Redis(redisOptions);

    // Handle connection events
    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });

    this.client.on('error', (err: Error) => {
      logger.error('Redis client error', { error: err.message });
    });

    this.client.on('close', () => {
      logger.info('Redis client connection closed');
    });

    return this.client;
  }

  /**
   * Get Redis client instance
   * @returns Redis client instance
   */
  getClient(): Redis {
    if (!this.client) {
      return this.initialize();
    }
    return this.client;
  }

  /**
   * Create a dedicated subscriber client for a channel
   * @param channel - Channel to subscribe to
   * @param callback - Callback function for messages
   * @returns Redis subscriber instance
   */
  createSubscriber(channel: string, callback: (message: any) => void): Redis {
    if (this.subscribers[channel]) {
      return this.subscribers[channel];
    }

    const subscriber = new Redis(defaultConfig);
    
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

    // Fix the subscribe method to match the expected signature
    subscriber.subscribe(channel).then(() => {
      logger.info(`Subscribed to Redis channel: ${channel}`);
    }).catch((err: Error) => {
      logger.error(`Error subscribing to channel ${channel}`, { error: err.message });
    });

    this.subscribers[channel] = subscriber;
    return subscriber;
  }

  /**
   * Get publisher client
   * @returns Redis publisher instance
   */
  getPublisher(): Redis {
    if (!this.publisher) {
      this.publisher = new Redis(defaultConfig);
    }
    return this.publisher;
  }

  /**
   * Publish message to a channel
   * @param channel - Channel to publish to
   * @param message - Message to publish
   * @returns Number of clients that received the message
   */
  async publish(channel: string, message: any): Promise<number> {
    const publisher = this.getPublisher();
    const messageStr = typeof message === 'object' ? JSON.stringify(message) : message;
    
    try {
      const result = await publisher.publish(channel, messageStr);
      logger.debug(`Published message to channel ${channel}`, { recipients: result });
      return result;
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
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
    
    try {
      if (ttlSeconds) {
        if (typeof ttlSeconds === 'string' && ttlSeconds.toUpperCase() === 'EX') {
          // Handle the case where ttlSeconds is 'EX' and the next argument is the actual TTL
          const args = Array.from(arguments).slice(3);
          return await client.set(key, valueStr, 'EX', args[0]);
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
    
    if (this.client) {
      closeTasks.push(this.client.quit());
    }
    
    if (this.publisher) {
      closeTasks.push(this.publisher.quit());
    }
    
    Object.values(this.subscribers).forEach((subscriber) => {
      closeTasks.push(subscriber.quit());
    });
    
    try {
      await Promise.all(closeTasks);
      logger.info('All Redis connections closed');
      
      this.client = null;
      this.publisher = null;
      this.subscribers = {};
    } catch (err) {
      logger.error('Error closing Redis connections', { error: (err as Error).message });
      throw err;
    }
  }
}

// Export singleton instance
const redisClient = new RedisClient();
export default redisClient;
