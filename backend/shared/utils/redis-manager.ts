/**
 * Redis Manager
 * Provides service-isolated Redis clients for improved scaling and performance
 */

import Redis from 'ioredis';
import { createServiceLogger } from './logger';
import config from '../config/index';

// Initialize logger
const logger = createServiceLogger('redis-manager');

// Service to DB mapping
// Each service gets its own Redis logical database number
export const SERVICE_DB_MAPPING: Record<string, number> = {
  'api-gateway': 0,
  'auth': 1,
  'user': 2,
  'subscription': 3,
  'content': 4,
  'notification': 5,
  'payment': 6,
  'monitoring': 7,
  'analytics': 8,
  // Reserve space for future services
  'default': 0  // Fallback to DB 0 for compatibility
};

// Redis client options interface
export interface RedisOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryStrategy?: (times: number) => number | null;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
  commandTimeout?: number;
  enableReadyCheck?: boolean;
  connectionName?: string;
}

// Exponential backoff retry strategy with maximum attempts
const createRetryStrategy = (serviceName: string) => (times: number): number | null => {
  const maxRetries = 5;
  if (times > maxRetries) {
    logger.warn(`[${serviceName}] Redis connection retry limit reached (${maxRetries}), stopping reconnection`);
    return null; // Stop retrying
  }
  
  // Exponential backoff with jitter (200ms to 5sec)
  const delay = Math.min(Math.floor(Math.random() * 200 + Math.pow(2, times) * 100), 5000);
  logger.info(`[${serviceName}] Redis connection retry in ${delay}ms (attempt ${times})`);
  return delay;
};

// Circuit breaker state
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

// Redis connection pool
const redisConnections: Record<string, Redis> = {};
const circuitStates: Record<string, CircuitBreakerState> = {};

/**
 * Create Redis client for a specific service
 * 
 * @param serviceName - Name of the service
 * @param options - Additional Redis options
 * @returns Redis client instance
 */
export function createServiceRedisClient(
  serviceName: string,
  options: RedisOptions = {}
): Redis {
  // Check if client already exists
  const cacheKey = `${serviceName}:${options.db ?? SERVICE_DB_MAPPING[serviceName] ?? 0}`;
  if (redisConnections[cacheKey]) {
    return redisConnections[cacheKey];
  }

  // Get service-specific database number
  const dbNumber = options.db ?? SERVICE_DB_MAPPING[serviceName] ?? SERVICE_DB_MAPPING.default;

  // Create service-specific key prefix
  const servicePrefix = `${config.get('redis.keyPrefix', 'sap:')}${serviceName}:`;

  // Default Redis configuration
  const defaultConfig: RedisOptions = {
    host: config.get('redis.host', 'localhost'),
    port: parseInt(config.get('redis.port', '6379')),
    password: config.get('redis.password', ''),
    db: dbNumber,
    keyPrefix: servicePrefix,
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    commandTimeout: 5000,
    enableReadyCheck: true,
    connectionName: `sap-${serviceName}`,
    retryStrategy: createRetryStrategy(serviceName)
  };

  // Merge default config with options
  const redisOptions: RedisOptions = { ...defaultConfig, ...options };
  
  // Initialize circuit breaker state
  if (!circuitStates[serviceName]) {
    circuitStates[serviceName] = {
      failures: 0,
      lastFailure: 0,
      isOpen: false
    };
  }

  // Create Redis client
  const client = new Redis(redisOptions);

  // Handle connection events
  client.on('connect', () => {
    logger.info(`[${serviceName}] Redis client connected to DB ${dbNumber}`);
    // Reset circuit breaker on successful connection
    circuitStates[serviceName].failures = 0;
    circuitStates[serviceName].isOpen = false;
  });

  client.on('error', (err: Error) => {
    logger.error(`[${serviceName}] Redis client error`, { error: err.message });
    // Update circuit breaker state
    const state = circuitStates[serviceName];
    state.failures++;
    state.lastFailure = Date.now();
    
    // Open circuit after 3 consecutive failures
    if (state.failures >= 3) {
      state.isOpen = true;
      logger.warn(`[${serviceName}] Redis circuit breaker opened after ${state.failures} failures`);
    }
  });

  client.on('reconnecting', () => {
    logger.info(`[${serviceName}] Redis client reconnecting`);
  });

  client.on('close', () => {
    logger.info(`[${serviceName}] Redis client connection closed`);
  });

  // Store for reuse
  redisConnections[cacheKey] = client;
  return client;
}

/**
 * Create a Redis cache utility
 * Provides a simple interface for cache operations
 */
export class RedisCache {
  private readonly client: Redis;
  private readonly serviceName: string;
  private readonly logger: any;

  /**
   * Create a Redis cache instance
   * 
   * @param serviceName - Name of the service
   * @param options - Redis connection options
   */
  constructor(serviceName: string, options: RedisOptions = {}) {
    this.serviceName = serviceName;
    this.client = createServiceRedisClient(serviceName, options);
    this.logger = createServiceLogger(`${serviceName}-cache`);
  }

  /**
   * Get a value from cache
   * 
   * @param key - Cache key
   * @returns Cached value or null
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Check circuit breaker
      const state = circuitStates[this.serviceName];
      if (state?.isOpen) {
        const now = Date.now();
        const cooldownPeriod = 30000; // 30 seconds
        
        if (now - state.lastFailure < cooldownPeriod) {
          this.logger.warn(`[${this.serviceName}] Circuit breaker open, skipping Redis call`);
          return null;
        }
        
        // Try to reset after cooldown period
        state.isOpen = false;
      }

      const value = await this.client.get(key);
      if (!value) return null;
      
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      this.logger.error(`Error getting cache key ${key}`, { 
        error: (error as Error).message,
        service: this.serviceName
      });
      return null;
    }
  }

  /**
   * Set a value in cache with optional expiration
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds
   * @returns Operation success
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      // Check circuit breaker
      if (circuitStates[this.serviceName]?.isOpen) {
        this.logger.warn(`[${this.serviceName}] Circuit breaker open, skipping Redis call`);
        return false;
      }

      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.client.set(key, valueStr, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, valueStr);
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Error setting cache key ${key}`, { 
        error: (error as Error).message,
        service: this.serviceName
      });
      return false;
    }
  }

  /**
   * Delete a key from cache
   * 
   * @param key - Cache key
   * @returns Operation success
   */
  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting cache key ${key}`, { 
        error: (error as Error).message,
        service: this.serviceName
      });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   * 
   * @param key - Cache key
   * @returns True if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Error checking if key ${key} exists`, { 
        error: (error as Error).message,
        service: this.serviceName
      });
      return false;
    }
  }

  /**
   * Find keys matching a pattern
   * 
   * @param pattern - Key pattern (e.g., "user:*")
   * @returns Array of matching keys
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Error finding keys matching pattern ${pattern}`, { 
        error: (error as Error).message,
        service: this.serviceName
      });
      return [];
    }
  }

  /**
   * Delete keys matching a pattern
   * 
   * @param pattern - Key pattern (e.g., "user:*")
   * @returns Number of keys deleted
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      
      return await this.client.del(...keys);
    } catch (error) {
      this.logger.error(`Error deleting keys by pattern ${pattern}`, {
        error: (error as Error).message,
        service: this.serviceName
      });
      return 0;
    }
  }

  /**
   * Get the Redis client instance
   * @returns Redis client
   */
  getClient(): Redis {
    return this.client;
  }
}

/**
 * Create a PubSub utility for Redis
 * Handles subscription and publication of messages
 */
export class RedisPubSub {
  private readonly serviceName: string;
  private readonly publisher: Redis;
  private readonly subscribers: Record<string, Redis> = {};
  private readonly logger: any;

  /**
   * Create Redis PubSub instance
   * 
   * @param serviceName - Name of the service
   * @param options - Redis connection options
   */
  constructor(serviceName: string, options: RedisOptions = {}) {
    this.serviceName = serviceName;
    this.publisher = createServiceRedisClient(`${serviceName}-pub`, options);
    this.logger = createServiceLogger(`${serviceName}-pubsub`);
  }

  /**
   * Subscribe to a channel
   * 
   * @param channel - Channel to subscribe to
   * @param callback - Callback for messages
   * @returns Redis subscriber instance
   */
  subscribe(channel: string, callback: (message: any) => void): Redis {
    if (this.subscribers[channel]) {
      return this.subscribers[channel];
    }

    const subscriber = createServiceRedisClient(
      `${this.serviceName}-sub-${channel}`, 
      { db: this.publisher.options.db }
    );

    subscriber.on('message', (ch: string, message: string) => {
      if (ch === channel && callback) {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (err) {
          this.logger.error('Error parsing Redis message', { 
            error: (err as Error).message, 
            channel, 
            message 
          });
          callback(message);
        }
      }
    });

    subscriber.subscribe(channel).then(() => {
      this.logger.info(`[${this.serviceName}] Subscribed to Redis channel: ${channel}`);
    }).catch((err: Error) => {
      this.logger.error(`[${this.serviceName}] Error subscribing to channel: ${channel}`, { 
        error: err.message 
      });
    });

    this.subscribers[channel] = subscriber;
    return subscriber;
  }

  /**
   * Publish message to a channel
   * 
   * @param channel - Channel to publish to
   * @param message - Message to publish
   * @returns Number of clients that received the message
   */
  async publish(channel: string, message: any): Promise<number> {
    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      return await this.publisher.publish(channel, messageStr);
    } catch (error) {
      this.logger.error(`Error publishing to channel ${channel}`, { 
        error: (error as Error).message,
        service: this.serviceName 
      });
      return 0;
    }
  }

  /**
   * Close all subscribers
   */
  async close(): Promise<void> {
    const closeTasks: Promise<string>[] = [];
    
    Object.values(this.subscribers).forEach((subscriber) => {
      closeTasks.push(subscriber.quit());
    });
    
    closeTasks.push(this.publisher.quit());
    
    try {
      await Promise.all(closeTasks);
      this.logger.info(`[${this.serviceName}] All PubSub connections closed`);
    } catch (error) {
      this.logger.error(`[${this.serviceName}] Error closing PubSub connections`, { 
        error: (error as Error).message 
      });
    }
  }
}

/**
 * Close all Redis connections
 */
export async function closeAllRedisConnections(): Promise<void> {
  const closeTasks: Promise<string>[] = [];
  
  Object.values(redisConnections).forEach((client) => {
    closeTasks.push(client.quit());
  });
  
  try {
    await Promise.all(closeTasks);
    logger.info('All Redis connections closed');
  } catch (error) {
    logger.error('Error closing Redis connections', { 
      error: (error as Error).message 
    });
  }
}

/**
 * Get Redis health metrics
 * 
 * @param serviceName - Name of the service to check
 */
export async function getRedisHealthMetrics(serviceName: string): Promise<Record<string, any> | null> {
  try {
    const client = createServiceRedisClient(`${serviceName}-health`);
    const info = await client.info();
    
    // Parse important metrics
    const metrics = {
      uptime: parseRedisInfo(info, 'uptime_in_seconds'),
      connectedClients: parseRedisInfo(info, 'connected_clients'),
      usedMemory: parseRedisInfo(info, 'used_memory_human'),
      totalKeys: await getTotalKeys(client),
      hitRate: calculateHitRate(info)
    };
    
    return metrics;
  } catch (error) {
    logger.error(`Error getting Redis health metrics for ${serviceName}`, {
      error: (error as Error).message
    });
    return null;
  }
}

// Helper function to parse Redis info output
function parseRedisInfo(info: string, key: string): string {
  const regex = new RegExp(`^${key}:(.*)$`, 'm');
  const match = info.match(regex);
  return match ? match[1].trim() : '';
}

// Helper function to calculate cache hit rate
function calculateHitRate(info: string): string {
  const hits = parseInt(parseRedisInfo(info, 'keyspace_hits')) || 0;
  const misses = parseInt(parseRedisInfo(info, 'keyspace_misses')) || 0;
  const total = hits + misses;
  
  if (total === 0) return '0%';
  return `${((hits / total) * 100).toFixed(2)}%`;
}

// Helper function to get total keys in a Redis instance
async function getTotalKeys(client: Redis): Promise<number> {
  try {
    const keys = await client.keys('*');
    return keys.length;
  } catch {
    return 0;
  }
}

// Export default functions for convenience
export default {
  createServiceRedisClient,
  RedisCache,
  RedisPubSub,
  closeAllRedisConnections,
  getRedisHealthMetrics,
  SERVICE_DB_MAPPING
};
