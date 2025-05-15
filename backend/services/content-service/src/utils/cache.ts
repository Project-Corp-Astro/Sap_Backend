/**
 * Enhanced in-memory cache implementation for the Content Service
 * This helps reduce database load for frequently accessed data
 * and integrates with performance monitoring
 */

import logger from './logger.js';
import performanceMonitor from './performance.js';

class CacheService {
  private cache: Map<string, { data: any; expiry: number }>;
  private defaultTTL: number; // Time to live in milliseconds
  private maxSize: number; // Maximum number of items in cache
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(defaultTTL: number = 60 * 60 * 1000, maxSize: number = 1000) { // Default 1 hour, 1000 items
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
    
    // Log cache stats periodically
    setInterval(() => this.logCacheStats(), 15 * 60 * 1000); // Every 15 minutes
  }

  /**
   * Set a value in the cache with an optional TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (optional, defaults to constructor value)
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // Check if cache is at capacity and evict oldest item if needed
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data: value, expiry });
    
    // Track cache operation
    performanceMonitor.trackCacheOperation('set', key);
    
    logger.debug(`Cache set: ${key}`, { ttl: ttl || this.defaultTTL });
  }

  /**
   * Get a value from the cache
   * @param key - Cache key
   * @returns The cached value or undefined if not found or expired
   */
  get<T>(key: string): T | undefined {
    const item = this.cache.get(key);
    
    // Return undefined if item doesn't exist or is expired
    if (!item || item.expiry < Date.now()) {
      if (item) this.delete(key); // Clean up expired item
      
      // Track cache miss
      this.missCount++;
      performanceMonitor.trackCacheOperation('miss', key);
      
      return undefined;
    }
    
    // Track cache hit
    this.hitCount++;
    performanceMonitor.trackCacheOperation('hit', key);
    
    return item.data as T;
  }

  /**
   * Get a value from cache or set it if not found
   * @param key - Cache key
   * @param fetchFn - Function to fetch the data if not in cache
   * @param ttl - Time to live in milliseconds (optional)
   * @returns The cached or fetched value
   */
  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number): Promise<T> {
    // Try to get from cache first
    const cachedValue = this.get<T>(key);
    if (cachedValue !== undefined) {
      return cachedValue;
    }
    
    // If not in cache, fetch the data
    const startTime = Date.now();
    try {
      const value = await fetchFn();
      
      // Track database query time
      performanceMonitor.trackDbQuery(startTime, Date.now(), 'fetch', 'unknown');
      
      // Cache the fetched value
      this.set(key, value, ttl);
      
      return value;
    } catch (error) {
      logger.error(`Error fetching data for cache key ${key}:`, { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Delete a value from the cache
   * @param key - Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
    
    // Track cache operation
    performanceMonitor.trackCacheOperation('delete', key);
    
    logger.debug(`Cache delete: ${key}`);
  }

  /**
   * Clear all values from the cache
   */
  clear(): void {
    this.cache.clear();
    logger.info(`Cache cleared (${this.size()} items)`);
  }

  /**
   * Get the number of items in the cache
   */
  size(): number {
    return this.cache.size;
  }
  
  /**
   * Evict the oldest item from the cache
   */
  private evictOldest(): void {
    // Find the item with the earliest expiry
    let oldestKey: string | null = null;
    let oldestExpiry = Infinity;
    
    for (const [key, item] of this.cache.entries()) {
      if (item.expiry < oldestExpiry) {
        oldestExpiry = item.expiry;
        oldestKey = key;
      }
    }
    
    // Delete the oldest item
    if (oldestKey) {
      this.delete(oldestKey);
      logger.debug(`Cache eviction: ${oldestKey} (cache full)`);
    }
  }
  
  /**
   * Log cache statistics
   */
  private logCacheStats(): void {
    const totalOps = this.hitCount + this.missCount;
    const hitRate = totalOps > 0 ? (this.hitCount / totalOps) * 100 : 0;
    
    logger.info('Cache statistics', {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: `${hitRate.toFixed(2)}%`,
      utilization: `${((this.cache.size / this.maxSize) * 100).toFixed(2)}%`
    });
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const totalOps = this.hitCount + this.missCount;
    const hitRate = totalOps > 0 ? (this.hitCount / totalOps) * 100 : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: hitRate,
      utilization: (this.cache.size / this.maxSize) * 100
    };
  }
}

// Create a singleton instance
export const cacheService = new CacheService();
