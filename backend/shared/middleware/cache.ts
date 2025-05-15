/**
 * Cache Middleware
 * Provides middleware for caching API responses
 */

import { Request, Response, NextFunction } from 'express';
import redisClient from '../utils/redis';
import { createServiceLogger } from '../utils/logger';
import config from '../config';

// Initialize logger
const logger = createServiceLogger('cache-middleware');

// Define interfaces
interface CacheOptions {
  ttl?: number;
  prefix?: string;
  enabled?: boolean;
  cacheAuthenticated?: boolean;
  [key: string]: any;
}

interface CachedResponse {
  status: number;
  data: any;
}

interface CacheInvalidationOptions {
  patterns?: string[];
  prefix?: string;
}

interface ExtendedResponse extends Response {
  originalJson?: (data: any) => Response;
  originalEnd?: (...args: any[]) => void;
}

interface AuthenticatedRequest extends Request {
  user?: any;
}

// Default cache configuration
const defaultOptions: CacheOptions = {
  ttl: config.get('cache.ttl', 3600), // Default TTL: 1 hour
  prefix: config.get('cache.prefix', 'api:'),
  enabled: config.get('cache.enabled', true)
};

/**
 * Generate cache key from request
 * @param req - Express request object
 * @param prefix - Cache key prefix
 * @returns Cache key
 */
const generateCacheKey = (req: Request, prefix: string = defaultOptions.prefix || 'api:'): string => {
  const path = req.originalUrl || req.url;
  const method = req.method.toLowerCase();
  
  // For GET requests, include query parameters in the cache key
  if (method === 'get') {
    return `${prefix}${method}:${path}`;
  }
  
  // For POST requests with body, include a hash of the body in the cache key
  if (method === 'post' && req.body) {
    // Simple hash function for request body
    const bodyStr = JSON.stringify(req.body);
    let hash = 0;
    for (let i = 0; i < bodyStr.length; i++) {
      const char = bodyStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${prefix}${method}:${path}:${hash}`;
  }
  
  // Default cache key
  return `${prefix}${method}:${path}`;
};

/**
 * Cache middleware factory
 * @param options - Cache options
 * @returns Express middleware
 */
const cacheMiddleware = (options: CacheOptions = {}): (req: AuthenticatedRequest, res: ExtendedResponse, next: NextFunction) => void => {
  const { ttl, prefix, enabled } = { ...defaultOptions, ...options };
  
  // Return middleware function
  return (req: AuthenticatedRequest, res: ExtendedResponse, next: NextFunction): void => {
    // Skip caching if disabled or for non-GET/POST requests
    if (!enabled || !['get', 'post'].includes(req.method.toLowerCase())) {
      return next();
    }
    
    // Skip caching for authenticated requests unless explicitly allowed
    if (req.user && !options.cacheAuthenticated) {
      return next();
    }
    
    const cacheKey = generateCacheKey(req, prefix);
    
    try {
      // Try to get cached response
      redisClient.get(cacheKey).then((cachedResponse: CachedResponse | null) => {
      
        if (cachedResponse) {
          logger.debug('Cache hit', { key: cacheKey });
          
          // Set cache header
          res.setHeader('X-Cache', 'HIT');
          
          // Send cached response
          res.status(cachedResponse.status).json(cachedResponse.data);
          return;
        }
      
        // Cache miss - continue to handler but intercept the response
        logger.debug('Cache miss', { key: cacheKey });
        res.setHeader('X-Cache', 'MISS');
        
        // Store original res.json method
        const originalJson = res.json;
        
        // Override res.json method to cache the response
        res.json = function(data: any) {
          // Only cache successful responses
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const responseToCache: CachedResponse = {
              status: res.statusCode,
              data: data
            };
            
            // Store in cache
            redisClient.set(cacheKey, responseToCache, ttl || 3600)
              .catch((err: Error) => {
                logger.error('Error caching response', { 
                  key: cacheKey, 
                  error: err.message 
                });
              });
          }
          
          // Call original res.json with data
          return originalJson.call(this, data);
        };
        
        next();
      }).catch((err: any) => {
        logger.error('Cache middleware error', { error: err.message });
        next();
      });
    } catch (err: any) {
      logger.error('Cache middleware error', { error: err.message });
      return next();
    }
  };
};

/**
 * Clear cache for a specific pattern
 * @param pattern - Cache key pattern to clear
 * @returns Number of keys removed
 */
const clearCache = async (pattern: string): Promise<number> => {
  try {
    const client = redisClient.getClient();
    const keys = await client.keys(pattern);
    
    if (keys.length === 0) {
      return 0;
    }
    
    const result = await client.del(keys);
    logger.info(`Cleared ${result} cache keys matching pattern: ${pattern}`);
    return result;
  } catch (err: any) {
    logger.error('Error clearing cache', { pattern, error: err.message });
    throw err;
  }
};

/**
 * Cache invalidation middleware factory
 * Creates middleware to invalidate cache based on request
 * @param options - Cache invalidation options
 * @returns Express middleware
 */
const invalidateCache = (options: CacheInvalidationOptions = {}): (req: Request, res: ExtendedResponse, next: NextFunction) => Promise<void> => {
  const { patterns, prefix } = { 
    patterns: [], 
    prefix: defaultOptions.prefix,
    ...options 
  };
  
  return async (req: Request, res: ExtendedResponse, next: NextFunction): Promise<void> => {
    // Store original end method
    const originalEnd = res.end;
    
    // Override end method to invalidate cache after successful response
    res.end = function(...args: any[]) {
      // Only invalidate cache for successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Process cache invalidation asynchronously without awaiting
        if (patterns && patterns.length > 0) {
          Promise.all(patterns.map(pattern => {
            const fullPattern = pattern.startsWith(prefix || '') ? pattern : `${prefix}${pattern}`;
            return clearCache(fullPattern);
          })).catch((err: any) => {
            logger.error('Error in cache invalidation', { error: err.message });
          });
        }
      }
      
      // Call original end method
      return originalEnd.apply(this, [args[0], args[1], args[2]]);
    };
    
    return next();
  };
};

export {
  cacheMiddleware,
  clearCache,
  invalidateCache,
  generateCacheKey,
  CacheOptions,
  CachedResponse,
  CacheInvalidationOptions
};
