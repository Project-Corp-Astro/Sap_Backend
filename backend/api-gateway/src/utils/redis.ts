import { RedisCache, createServiceRedisClient } from '../../../shared/utils/redis-manager';
import { createServiceLogger } from '../../../shared/utils/logger';
import config from '../../../shared/config';

// Initialize service-specific Redis clients
const SERVICE_NAME = 'api-gateway';
const logger = createServiceLogger(SERVICE_NAME);

// Create Redis clients with service-specific prefixes
const gatewayCache = createServiceRedisClient(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:gateway:` });
const rateLimitCache = createServiceRedisClient(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:ratelimit:` });
const serviceCache = createServiceRedisClient(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:service:` });
const statsCache = createServiceRedisClient(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:stats:` });
const swaggerCache = createServiceRedisClient(SERVICE_NAME, { keyPrefix: `${SERVICE_NAME}:swagger:` });

// Stats tracking
const stats = {
  increment: async (type: 'success' | 'error' | 'total') => {
    await statsCache.incr(`stats:requests:${type}`);
  },
  getStats: async () => {
    const [total, success, error] = await Promise.all([
      statsCache.get('stats:requests:total'),
      statsCache.get('stats:requests:success'),
      statsCache.get('stats:requests:error')
    ]);
    return {
      total: total ? parseInt(total) : 0,
      success: success ? parseInt(success) : 0,
      error: error ? parseInt(error) : 0
    };
  },
  set: async (key: string, value: string) => {
    await statsCache.set(`stats:requests:${key}`, value);
  }
};

/**
 * Rate limiting utilities
 */
const rateLimit = {
  /**
   * Check and increment rate limit for an IP and endpoint
   * @param ip - Client IP address
   * @param endpoint - API endpoint
   * @param limit - Maximum requests allowed
   * @param window - Time window in seconds
   * @returns {boolean} - Whether request is allowed
   */
  checkAndIncrement: async (ip: string, endpoint: string, limit: number = 100, window: number = 60): Promise<boolean> => {
    try {
      const key = `${SERVICE_NAME}:ratelimit:${ip}:${endpoint}`;
      const current = await rateLimitCache.get(key);
      const count = current ? parseInt(current) : 0;
      
      if (count >= limit) {
        return false;
      }
      
      await rateLimitCache.set(key, String(count + 1), 'EX', window);
      return true;
    } catch (error) {
      logger.error('Error in rate limiting:', { error: error instanceof Error ? error.message : String(error) });
      return true; // Allow request on error
    }
  }
};

/**
 * Service discovery utilities
 */
const serviceDiscovery = {
  /**
   * Set service URL and health status
   * @param serviceName - Name of the service
   * @param url - Service URL
   * @param healthStatus - Health status
   */
  setServiceInfo: async (serviceName: string, url: string, healthStatus: string = 'healthy') => {
    try {
      // Convert service name to uppercase to match the keys
      const upperServiceName = serviceName.toUpperCase();
      const keyPrefix = `${SERVICE_NAME}:service:${upperServiceName}`;
      await serviceCache.set(`${keyPrefix}:url`, url);
      await serviceCache.set(`${keyPrefix}:health`, healthStatus);
    } catch (error) {
      logger.error('Error setting service info:', { error: error instanceof Error ? error.message : String(error) });
    }
  },

  /**
   * Get service URL
   * @param serviceName - Name of the service
   * @returns {string | null} - Service URL
   */
  getServiceUrl: async (serviceName: string): Promise<string | null> => {
    try {
      const upperServiceName = serviceName.toUpperCase();
      const keyPrefix = `${SERVICE_NAME}:service:${upperServiceName}`;
      return await serviceCache.get(`${keyPrefix}:url`);
    } catch (error) {
      logger.error('Error getting service URL:', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  },

  /**
   * Get service health status
   * @param serviceName - Name of the service
   * @returns {string | null} - Health status
   */
  getServiceHealth: async (serviceName: string): Promise<string | null> => {
    try {
      const upperServiceName = serviceName.toUpperCase();
      const keyPrefix = `${SERVICE_NAME}:service:${upperServiceName}`;
      return await serviceCache.get(`${keyPrefix}:health`);
    } catch (error) {
      logger.error('Error getting service health:', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }
};

/**
 * Swagger utilities
 */
const swagger = {
  /**
   * Set Swagger specs
   * @param specs - Swagger specifications
   * @param ttl - Time to live in seconds
   */
  setSpecs: async (specs: any, ttl: number = 300): Promise<void> => {
    try {
      await swaggerCache.set('swagger', JSON.stringify(specs), 'EX', ttl);
    } catch (error) {
      logger.error('Error setting Swagger specs:', { error: error instanceof Error ? error.message : String(error) });
    }
  },

  /**
   * Get Swagger specs
   * @returns {Promise<any>} - Swagger specifications
   */
  getSpecs: async (): Promise<any> => {
    try {
      const specs = await swaggerCache.get('swagger');
      return specs ? JSON.parse(specs) : null;
    } catch (error) {
      logger.error('Error getting Swagger specs:', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }
};

// Export Redis clients and utilities
export {
  gatewayCache,
  rateLimitCache,
  serviceCache,
  statsCache,
  swaggerCache,
  rateLimit,
  serviceDiscovery,
  stats,
  swagger
};

// Initialize Redis connection
const initRedis = async () => {
  try {
    const pingResult = await gatewayCache.ping();
    if (pingResult === 'PONG') {
      logger.info('Redis connection established successfully');
    } else {
      throw new Error('Redis ping failed');
    }
  } catch (error) {
    logger.error('Failed to initialize Redis:', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
};

// Initialize Redis connection
initRedis();
