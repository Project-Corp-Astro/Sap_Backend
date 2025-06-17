import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '../../../shared/utils/logger';
import config from '../../../shared/config';
import { rateLimit, serviceDiscovery, stats, swagger } from '../utils/redis';
import { rateLimitCache, statsCache } from '../utils/redis';

interface RateLimitConfig {
  max: number;
  window: number;
}

const logger = createServiceLogger('RateLimitMiddleware');

/**
 * Rate limiting middleware
 * @param req - Express request
 * @param res - Express response
 * @param next - Next middleware function
 */
export const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get client IP
    const ip = Array.isArray(req.ip) ? req.ip[0] : 
      (req.headers['x-forwarded-for'] as string) || 
      req.ip || 'unknown';
    
    // Get endpoint path
    const endpoint = req.path;
    
    // Get rate limit configuration
    const rateLimitConfig = req.app.get('rateLimit') as RateLimitConfig;
    const limit = rateLimitConfig?.max ? parseInt(rateLimitConfig.max.toString()) : 100;
    const window = rateLimitConfig?.window ? parseInt(rateLimitConfig.window.toString()) : 60;

    if (isNaN(limit) || isNaN(window)) {
      logger.warn('Invalid rate limit values, using defaults');
      return next();
    }

    try {
      // Check and increment rate limit using utility
      const isAllowed = await rateLimit.checkAndIncrement(ip, endpoint, limit, window);
      
      if (!isAllowed) {
        return res.status(429).json({
          error: 'Too many requests',
          message: `Rate limit exceeded. Please wait ${window} seconds before making another request.`
        });
      }

      // Increment total requests counter
      await statsCache.incr('requests:total');
      
      return next();
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      // If Redis fails, allow request to proceed
      return next();
    }
  } catch (error) {
    logger.error('Unexpected error in rate limit middleware:', error);
    return next();
  }
};
