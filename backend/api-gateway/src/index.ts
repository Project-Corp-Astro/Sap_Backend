import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options as ProxyOptions } from 'http-proxy-middleware';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';

// Import shared modules
import config from '../../shared/config';
import { createServiceLogger } from '../../shared/utils/logger';
import { errorMiddleware } from '../../shared/utils/errorHandler';
import { 
  serviceHealth, 
  systemMetrics, 
  RequestTracker, 
  requestTrackerMiddleware 
} from '../../shared/utils/monitoring';
import { applySecurityMiddleware } from '../../shared/middleware/security';
import { setupSwagger } from '../../shared/utils/swagger';

// Initialize logger
const logger = createServiceLogger('api-gateway');

// Initialize request tracker
const requestTracker = new RequestTracker(logger);

// Initialize Express app
const app = express();
const PORT = config.get('port', 5001);
const SERVICE_NAME = 'api-gateway';

/**
 * Service routes configuration
 * Defines the endpoints for various microservices in the astrology platform
 */
interface ServiceConfig {
  AUTH_SERVICE: string;      // Authentication service
  USER_SERVICE: string;      // User management service
  CONTENT_SERVICE: string;   // Content management service
  ASTRO_ENGINE_SERVICE?: string; // Astrological calculation engine service
  ASTRO_RATAN_SERVICE?: string;  // AI astrologer service
}

const SERVICES: ServiceConfig = {
  AUTH_SERVICE: config.get('services.auth', 'http://localhost:3001'),
  USER_SERVICE: config.get('services.user', 'http://localhost:3002'),
  CONTENT_SERVICE: config.get('services.content', 'http://localhost:3003'),
  // Add optional services if configured
  ...(config.get('services.astroEngine') ? { ASTRO_ENGINE_SERVICE: config.get('services.astroEngine') } : {}),
  ...(config.get('services.astroRatan') ? { ASTRO_RATAN_SERVICE: config.get('services.astroRatan') } : {}),
};

// Register service with health monitoring
serviceHealth.registerService(SERVICE_NAME, {
  name: 'API Gateway',
  description: 'Routes requests to appropriate microservices for Corp Astro platform',
  version: '1.0.0',
  endpoints: [
    '/api/auth',
    '/api/users',
    '/api/content',
    ...(SERVICES.ASTRO_ENGINE_SERVICE ? ['/api/astro-engine'] : []),
    ...(SERVICES.ASTRO_RATAN_SERVICE ? ['/api/astro-ratan'] : []),
    '/health',
    '/api-docs'
  ]
});

// Apply security middleware (CORS, Helmet, XSS protection, etc.)
applySecurityMiddleware(app);

// Additional middleware
app.use(express.json({ limit: '50mb' })); // Increased limit for astrological chart data
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(compression()); // Compress responses
app.use(requestTrackerMiddleware(requestTracker)); // Track requests for monitoring

// Configure proxy middleware for Auth Service
app.use('/api/auth', createProxyMiddleware({
  target: SERVICES.AUTH_SERVICE,
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': '/api/auth',
  },
  logProvider: () => logger,
  onError: (err: Error, req: Request, res: Response) => {
    logger.error(`Proxy error to Auth Service: ${err.message}`, { error: err });
    res.status(503).json({
      success: false,
      message: 'Auth Service unavailable',
      error: config.get('nodeEnv') === 'development' ? err.message : undefined
    });
  }
}));

// Configure proxy middleware for User Service
app.use('/api/users', createProxyMiddleware({
  target: SERVICES.USER_SERVICE,
  changeOrigin: true,
  pathRewrite: {
    '^/api/users': '/api/users',
  },
  logProvider: () => logger,
  onError: (err: Error, req: Request, res: Response) => {
    logger.error(`Proxy error to User Service: ${err.message}`, { error: err });
    res.status(503).json({
      success: false,
      message: 'User Service unavailable',
      error: config.get('nodeEnv') === 'development' ? err.message : undefined
    });
  }
}));

// Configure proxy middleware for Content Service
app.use('/api/content', createProxyMiddleware({
  target: SERVICES.CONTENT_SERVICE,
  changeOrigin: true,
  pathRewrite: {
    '^/api/content': '/api/content',
  },
  logProvider: () => logger,
  onError: (err: Error, req: Request, res: Response) => {
    logger.error(`Proxy error to Content Service: ${err.message}`, { error: err });
    res.status(503).json({
      success: false,
      message: 'Content Service unavailable',
      error: config.get('nodeEnv') === 'development' ? err.message : undefined
    });
  }
}));

// Configure proxy middleware for Astro Engine Service (if configured)
if (SERVICES.ASTRO_ENGINE_SERVICE) {
  app.use('/api/astro-engine', createProxyMiddleware({
    target: SERVICES.ASTRO_ENGINE_SERVICE,
    changeOrigin: true,
    pathRewrite: {
      '^/api/astro-engine': '/api/astro-engine',
    },
    logProvider: () => logger,
    onError: (err: Error, req: Request, res: Response) => {
      logger.error(`Proxy error to Astro Engine Service: ${err.message}`, { error: err });
      res.status(503).json({
        success: false,
        message: 'Astro Engine Service unavailable',
        error: config.get('nodeEnv') === 'development' ? err.message : undefined
      });
    }
  }));
  
  logger.info(`Astro Engine Service proxy configured: ${SERVICES.ASTRO_ENGINE_SERVICE}`);
}

// Configure proxy middleware for Astro Ratan AI Service (if configured)
if (SERVICES.ASTRO_RATAN_SERVICE) {
  app.use('/api/astro-ratan', createProxyMiddleware({
    target: SERVICES.ASTRO_RATAN_SERVICE,
    changeOrigin: true,
    pathRewrite: {
      '^/api/astro-ratan': '/api/astro-ratan',
    },
    logProvider: () => logger,
    onError: (err: Error, req: Request, res: Response) => {
      logger.error(`Proxy error to Astro Ratan AI Service: ${err.message}`, { error: err });
      res.status(503).json({
        success: false,
        message: 'Astro Ratan AI Service unavailable',
        error: config.get('nodeEnv') === 'development' ? err.message : undefined
      });
    }
  }));
  
  logger.info(`Astro Ratan AI Service proxy configured: ${SERVICES.ASTRO_RATAN_SERVICE}`);
}

// Setup Swagger documentation
setupSwagger(app, {
  definition: {
    info: {
      title: 'SAP API Gateway',
      version: '1.0.0',
      description: 'API Gateway for SAP backend services'
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Local API Gateway'
      }
    ]
  }
});

/**
 * Health check route
 * Provides health status for all microservices in the Corp Astro platform
 */
app.get('/health', async (req: Request, res: Response) => {
  // Get system metrics
  const metrics = systemMetrics.getSystemMetrics();
  
  // Get request stats
  const requestStats = requestTracker.getStats();
  
  /**
   * Check health status of a service
   * @param url Service URL to check
   * @returns Health status: 'ok', 'degraded', or 'down'
   */
  const checkServiceHealth = async (url: string): Promise<string> => {
    try {
      const response = await fetch(`${url}/health`);
      return response.ok ? 'ok' : 'degraded';
    } catch (err) {
      logger.warn(`Health check failed for service at ${url}`, { error: (err as Error).message });
      return 'down';
    }
  };
  
  // Update service health
  serviceHealth.updateServiceHealth(SERVICE_NAME, {
    status: 'ok',
    metrics: {
      responseTime: requestStats.avgResponseTime,
      errorRate: requestStats.errorRate,
      cpuUsage: metrics.cpu.loadAvg[0] * 100 / metrics.cpu.cpus,
      memoryUsage: (1 - (metrics.memory.free / metrics.memory.total)) * 100
    }
  });
  
  // Create services object with all configured services
  const servicesStatus: Record<string, string> = {
    authService: SERVICES.AUTH_SERVICE,
    userService: SERVICES.USER_SERVICE,
    contentService: SERVICES.CONTENT_SERVICE,
  };
  
  // Add optional services if configured
  if (SERVICES.ASTRO_ENGINE_SERVICE) {
    servicesStatus.astroEngineService = SERVICES.ASTRO_ENGINE_SERVICE;
  }
  
  if (SERVICES.ASTRO_RATAN_SERVICE) {
    servicesStatus.astroRatanService = SERVICES.ASTRO_RATAN_SERVICE;
  }
  
  // Return health status
  res.status(200).json({
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    services: servicesStatus,
    metrics: {
      system: metrics,
      requests: requestStats
    }
  });
});

/**
 * Root route
 * Provides basic information about the API Gateway
 */
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Corp Astro Super Administration Panel API Gateway',
    version: '1.0.0',
    documentation: '/api-docs',
    platform: 'Corp Astro Astrology Platform'
  });
});

// Error handling middleware
app.use(errorMiddleware(logger));

// Start server
const server = app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Auth Service proxy: ${SERVICES.AUTH_SERVICE}`);
  logger.info(`User Service proxy: ${SERVICES.USER_SERVICE}`);
  logger.info(`Content Service proxy: ${SERVICES.CONTENT_SERVICE}`);
  
  // Log optional services
  if (SERVICES.ASTRO_ENGINE_SERVICE) {
    logger.info(`Astro Engine Service proxy: ${SERVICES.ASTRO_ENGINE_SERVICE}`);
  }
  
  if (SERVICES.ASTRO_RATAN_SERVICE) {
    logger.info(`Astro Ratan AI Service proxy: ${SERVICES.ASTRO_RATAN_SERVICE}`);
  }
});

/**
 * Handle graceful shutdown
 * Ensures all connections are properly closed before shutting down
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
  });
});

// Export for testing
export default app;
