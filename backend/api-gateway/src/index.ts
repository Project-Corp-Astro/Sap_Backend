import express, { Express, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options as ProxyOptions } from 'http-proxy-middleware';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { aggregateSwaggerSpecs, type ServiceInfo, type SwaggerSpec, swaggerEvents, SWAGGER_EVENTS } from './utils/swagger-aggregator';

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
import { rateLimit, serviceDiscovery, stats, swagger, statsCache } from './utils/redis';
import { rateLimitMiddleware } from './middleware/rate-limit.middleware';

// Service routes configuration
interface ServiceConfig {
  AUTH_SERVICE: string;
  USER_SERVICE: string;
  CONTENT_SERVICE: string;
  SUBSCRIPTION_SERVICE?: string;
  ASTRO_ENGINE_SERVICE?: string;
  ASTRO_RATAN_SERVICE?: string;
}

interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down' | 'unknown';
  code: number;
  message: string;
}

interface ServiceHealthResponse {
  services: Record<string, HealthCheckResponse>;
}

// Health status tracking
const serviceHealthStatus: Record<string, HealthCheckResponse> = {
  AUTH_SERVICE: { status: 'unknown', code: 503, message: 'Service status unknown' },
  USER_SERVICE: { status: 'unknown', code: 503, message: 'Service status unknown' },
  CONTENT_SERVICE: { status: 'unknown', code: 503, message: 'Service status unknown' },
  SUBSCRIPTION_SERVICE: { status: 'unknown', code: 503, message: 'Service status unknown' },
  ASTRO_ENGINE_SERVICE: { status: 'unknown', code: 503, message: 'Service status unknown' },
  ASTRO_RATAN_SERVICE: { status: 'unknown', code: 503, message: 'Service status unknown' }
};

// Update health check implementation
const updateHealthStatus = (serviceName: string, status: 'ok' | 'degraded' | 'down' | 'unknown', message: string) => {
  serviceHealthStatus[serviceName] = {
    status,
    code: status === 'ok' ? 200 : status === 'degraded' ? 503 : 503,
    message
  };
};

// Constants and state
const SERVICE_NAME = 'api-gateway';
const PORT = config.get('port', 5100);
let hasServiceSpecs = false;

// Define default ports for each service
const DEFAULT_PORTS = {
  AUTH: 3001,
  USER: 3002,
  SUBSCRIPTION: 3003,
  CONTENT: 3005,
  ASTRO_ENGINE: 3006,
  ASTRO_RATAN: 3007
};

// Get URLs from environment variables with fallbacks using default ports
const SERVICES: ServiceConfig = {
  AUTH_SERVICE: process.env.AUTH_SERVICE_URL || `http://localhost:${DEFAULT_PORTS.AUTH}`,
  USER_SERVICE: process.env.USER_SERVICE_URL || `http://localhost:${DEFAULT_PORTS.USER}`,
  SUBSCRIPTION_SERVICE: process.env.SUBSCRIPTION_SERVICE_URL || `http://localhost:${DEFAULT_PORTS.SUBSCRIPTION}`,
  CONTENT_SERVICE: process.env.CONTENT_SERVICE_URL || `http://localhost:${DEFAULT_PORTS.CONTENT}`,
  ASTRO_ENGINE_SERVICE: process.env.ASTRO_ENGINE_SERVICE_URL || `http://localhost:${DEFAULT_PORTS.ASTRO_ENGINE}`,
  ASTRO_RATAN_SERVICE: process.env.ASTRO_RATAN_SERVICE_URL || `http://localhost:${DEFAULT_PORTS.ASTRO_RATAN}`
};

// Initialize Express app and logger
const app: Express = express();
const logger = createServiceLogger(SERVICE_NAME);

// Initialize request tracker and Redis utilities
const requestTracker = new RequestTracker(logger);
const rateLimitWindow = config.get('rateLimit.window', 60);
const rateLimitMax = config.get('rateLimit.max', 100);

// Set rate limit settings
app.set('rateLimit', {
  max: rateLimitMax,
  window: rateLimitWindow
});

// Initialize Redis connection
const initRedis = async () => {
  try {
    // Initialize stats
    await statsCache.set('requests:total', '0');
    logger.info('Redis connection established successfully');
  } catch (error) {
    logger.warn('Redis connection failed - some features may not work');
  }
};

initRedis().catch(error => logger.error('Failed to initialize Redis:', error));

// Configure rate limiting
app.set('rateLimit', {
  window: config.get('rateLimit.windowMs', 60000) / 1000,  // Convert ms to seconds
  max: config.get('rateLimit.max', 100)
});

// Initialize service discovery
Object.entries(SERVICES).forEach(([serviceName, url]) => {
  if (url) {
    serviceDiscovery.setServiceInfo(serviceName, url);
  }
});

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
    ...(SERVICES.SUBSCRIPTION_SERVICE ? ['/api/subscription'] : []),
    '/health',
    '/api-docs',
    '/api/subscription'
  ]
});

// Apply middlewares
applySecurityMiddleware(app);
app.use(rateLimitMiddleware as any);

// Additional middleware
app.use(express.json({ limit: '50mb' })); // Increased limit for large data payloads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(compression() as any); // Compress responses - need type assertion due to Express typing issues
app.use(requestTrackerMiddleware(requestTracker) as any); // Track requests for monitoring

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
    ...(SERVICES.SUBSCRIPTION_SERVICE ? ['/api/subscription'] : []),
    '/health',
    '/api-docs',
    '/api/subscription'
  ]
});

// Apply security middleware (CORS, Helmet, XSS protection, etc.)
applySecurityMiddleware(app);

// Apply rate limiting middleware
app.use(rateLimitMiddleware as any);

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const health: Record<string, HealthCheckResponse> = {};
    
    // Check each service
    for (const [serviceName, url] of Object.entries(SERVICES)) {
      if (url) {
        try {
          const response = await fetch(`${url}/health`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          const status = response.ok ? 'ok' : 'down';
          const message = response.ok ? 'OK' : await response.text();
          
          health[serviceName] = {
            status: 'ok',
            code: response.status,
            message: response.ok ? 'OK' : await response.text()
          };
          
          // Update Redis with health status
          await serviceDiscovery.setServiceInfo(serviceName, url, 'ok');
          
          // Update monitoring service
          serviceHealth.updateServiceHealth(serviceName, {
            status: 'ok',
            metrics: {
              responseTime: response.ok ? parseInt(response.headers.get('x-response-time') || '0') : null,
              lastCheck: new Date().toISOString()
            }
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Service unavailable';
          
          health[serviceName] = {
            status: 'down',
            code: 503,
            message: errorMessage
          };
          
          // Update Redis with unhealthy status
          await serviceDiscovery.setServiceInfo(serviceName, url, 'down');
          
          // Update monitoring service
          serviceHealth.updateServiceHealth(serviceName, {
            status: 'down',
            metrics: {
              lastCheck: new Date().toISOString(),
              error: errorMessage
            }
          });
          
          logger.error(`Health check failed for ${serviceName}:`, error);
        }
      }
    }
    
    res.json({ services: health } as ServiceHealthResponse);
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Periodic health monitoring
const checkServiceHealth = async () => {
  try {
    for (const [serviceName, url] of Object.entries(SERVICES)) {
      if (!url) {
        updateHealthStatus(serviceName, 'unknown', 'Service not configured');
        continue;
      }

      try {
        const response = await fetch(`${url}/health`);
        const status = response.ok ? 'ok' : 'down';
        const message = response.ok ? 'OK' : await response.text();
        
        updateHealthStatus(serviceName, status, message);
        await serviceDiscovery.setServiceInfo(serviceName, url, status);
        
        serviceHealth.updateServiceHealth(serviceName, {
          status: status,
          metrics: {
            responseTime: response.ok ? parseInt(response.headers.get('x-response-time') || '0') : null,
            lastCheck: new Date().toISOString()
          }
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Health check failed';
        logger.error(`Health check failed for ${serviceName}:`, { error: errorMessage });
        
        updateHealthStatus(serviceName, 'down', errorMessage);
        await serviceDiscovery.setServiceInfo(serviceName, url, 'down');
        
        serviceHealth.updateServiceHealth(serviceName, {
          status: 'down',
          metrics: {
            lastCheck: new Date().toISOString(),
            error: errorMessage
          }
        });
      }
    }

    // Update API Gateway's own health status
    updateHealthStatus('API_GATEWAY', 'ok', 'API Gateway is healthy');
    await serviceDiscovery.setServiceInfo('API_GATEWAY', `http://localhost:${PORT}`, 'ok');
    serviceHealth.updateServiceHealth('API_GATEWAY', {
      status: 'ok',
      metrics: {
        lastCheck: new Date().toISOString()
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Health check failed';
    logger.error('Error in periodic health check:', { error: errorMessage });
    updateHealthStatus('API_GATEWAY', 'down', errorMessage);
    await serviceDiscovery.setServiceInfo('API_GATEWAY', `http://localhost:${PORT}`, 'down');
    serviceHealth.updateServiceHealth('API_GATEWAY', {
      status: 'down',
      metrics: {
        lastCheck: new Date().toISOString(),
        error: errorMessage
      }
    });
  }
};

// Start periodic health checks (every 30 seconds)
setInterval(checkServiceHealth, 30000).unref();

// Initial health check
checkServiceHealth().catch(error => logger.error('Initial health check failed:', error));

// Additional middleware
app.use(express.json({ limit: '50mb' })); // Increased limit for large data payloads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(compression() as any); // Compress responses - need type assertion due to Express typing issues
app.use(requestTrackerMiddleware(requestTracker) as any); // Track requests for monitoring

// Configure proxy middleware for Auth Service
app.use('/api/auth', rateLimitMiddleware, createProxyMiddleware({
  target: SERVICES.AUTH_SERVICE,
  changeOrigin: true,
  pathRewrite: {
    '^/api/auth': '/api/auth',  // Keep the prefix intact
  },
  // Add timeout settings (in milliseconds)
  proxyTimeout: 60000,    // Increase to 60 seconds
  timeout: 60000,         // Increase to 60 seconds
  // Connection handling
  secure: false,          // Don't verify SSL certificates
  xfwd: true,             // Add x-forwarded headers
  ws: true,               // Enable WebSocket proxying
  followRedirects: true,  // Follow any redirects
  // Error handling
  logLevel: 'debug',      // Increase logging for troubleshooting
  // Add important body parsing options
  onProxyReq: (proxyReq, req, res) => {
    // Add additional request handling if needed
    if (req.body && Object.keys(req.body).length > 0) {
      // If content-type is application/json, stringify the body
      const contentType = proxyReq.getHeader('Content-Type');
      if (contentType && contentType.toString().includes('application/json')) {
        const bodyData = JSON.stringify(req.body);
        // Update content-length
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        // Write body data to the proxy request
        proxyReq.write(bodyData);
      }
    }
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

// Helper function to create proxy middleware for User Service endpoints
const createUserServiceProxy = (path: string) => {
  return createProxyMiddleware({
    target: SERVICES.USER_SERVICE,
    changeOrigin: true,
    pathRewrite: {
      [`^${path}`]: path,  // Keep the prefix intact
    },
    // Add timeout settings (in milliseconds)
    proxyTimeout: 60000,    // Increase to 60 seconds
    timeout: 60000,         // Increase to 60 seconds
    // Connection handling
    secure: false,          // Don't verify SSL certificates
    xfwd: true,             // Add x-forwarded headers
    ws: true,               // Enable WebSocket proxying
    followRedirects: true,  // Follow any redirects
    // Error handling
    logLevel: 'debug',      // Increase logging for troubleshooting
    // Add important body parsing options
    onProxyReq: (proxyReq, req, res) => {
      // Add additional request handling if needed
      if (req.body && Object.keys(req.body).length > 0) {
        // If content-type is application/json, stringify the body
        const contentType = proxyReq.getHeader('Content-Type');
        if (contentType && contentType.toString().includes('application/json')) {
          const bodyData = JSON.stringify(req.body);
          // Update content-length
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          // Write body data to the proxy request
          proxyReq.write(bodyData);
        }
      }
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
  });
};

// Configure proxy middleware for User Service
app.use('/api/users', createUserServiceProxy('/api/users'));
app.use('/api/permissions', createUserServiceProxy('/api/permissions'));
app.use('/api/roles', createUserServiceProxy('/api/roles'));
app.use('/api/user-permissions', createUserServiceProxy('/api/user-permissions'));
app.use('/api/monitoring', createUserServiceProxy('/api/monitoring'));

// Configure proxy middleware for Content Service
app.use('/api/content', createProxyMiddleware({
  target: SERVICES.CONTENT_SERVICE,
  changeOrigin: true,
  pathRewrite: {
    '^/api/content': '/api/content',  // Keep the prefix intact
  },
  // Add timeout settings (in milliseconds)
  proxyTimeout: 60000,    // 60 seconds for proxy response
  timeout: 60000,         // 60 seconds for connection timeout
  // Connection handling
  secure: false,          // Don't verify SSL certificates
  xfwd: true,             // Add x-forwarded headers
  ws: true,               // Enable WebSocket proxying
  followRedirects: true,  // Follow any redirects
  // Error handling
  logLevel: 'debug',      // Increase logging for troubleshooting
  // Add important body parsing options
  onProxyReq: (proxyReq, req, res) => {
    // Add additional request handling if needed
    if (req.body && Object.keys(req.body).length > 0) {
      // If content-type is application/json, stringify the body
      const contentType = proxyReq.getHeader('Content-Type');
      if (contentType && contentType.toString().includes('application/json')) {
        const bodyData = JSON.stringify(req.body);
        // Update content-length
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        // Write body data to the proxy request
        proxyReq.write(bodyData);
      }
    }
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
      '^/api/astro-engine': '/',
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
      '^/api/astro-ratan': '/',
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

// Configure proxy middleware for Subscription Service
app.use('/api/subscription', createProxyMiddleware({
  target: SERVICES.SUBSCRIPTION_SERVICE,
  changeOrigin: true,
  pathRewrite: {
    '^/api/subscription': '/api/subscription',  // Keep the prefix intact
  },
  // Add timeout settings (in milliseconds)
  proxyTimeout: 60000,    // Increase to 60 seconds
  timeout: 60000,         // Increase to 60 seconds
  // Connection handling
  secure: false,          // Don't verify SSL certificates
  xfwd: true,             // Add x-forwarded headers
  ws: true,               // Enable WebSocket proxying
  followRedirects: true,  // Follow any redirects
  // Error handling
  logLevel: 'debug',      // Increase logging for troubleshooting
  // Add important body parsing options
  onProxyReq: (proxyReq, req, res) => {
    // Set headers first
    const host = req.headers.host || 'localhost';
    proxyReq.setHeader('x-forwarded-host', host);
    proxyReq.setHeader('x-forwarded-proto', 'https');
  
    // Then handle body if needed
    if (req.body && Object.keys(req.body).length > 0) {
      const contentType = proxyReq.getHeader('Content-Type');
      if (contentType && contentType.toString().includes('application/json')) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    }
  },
  logProvider: () => logger,
  onError: (err: Error, req: Request, res: Response) => {
    logger.error(`Proxy error to Subscription Service: ${err.message}`, { error: err });
    res.status(503).json({
      success: false,
      message: 'Subscription Service unavailable',
      error: config.get('nodeEnv') === 'development' ? err.message : undefined
    });
  }
}));

/**
 * Setup Swagger documentation by aggregating specs from all microservices
 * Includes dynamic updating when services come online after initial startup
 */
async function setupGatewaySwagger(): Promise<void> {
  try {
    // Define services for Swagger aggregation
    const services: ServiceInfo[] = [
      // Core services
      {
        name: 'Auth Service',
        url: SERVICES.AUTH_SERVICE,
        swaggerPath: '/swagger.json'
      },
      {
        name: 'User Service',
        url: SERVICES.USER_SERVICE,
        swaggerPath: '/swagger.json'
      },
      {
        name: 'Content Service',
        url: SERVICES.CONTENT_SERVICE,
        swaggerPath: '/swagger.json'
      }
    ];
    
    // Add subscription service if available
    if (SERVICES.SUBSCRIPTION_SERVICE) {
      services.push({ 
        name: 'Subscription', 
        url: SERVICES.SUBSCRIPTION_SERVICE, 
        swaggerPath: '/swagger.json' 
      });
    }

    // Base OpenAPI configuration
    const mainInfo = {
      title: 'SAP Backend Services',
      version: '1.0.0',
      description: 'API documentation for all SAP backend services'
    };
    
    // Use the aggregator utility to fetch and merge all specs
    let gatewaySwaggerConfig = await aggregateSwaggerSpecs(services, mainInfo);
    
    // Add health check endpoint to all configurations and handle empty specs gracefully
    hasServiceSpecs = gatewaySwaggerConfig.paths && Object.keys(gatewaySwaggerConfig.paths).length > 0;
    
    // If no services are available or we have partial specs, ensure we add our core endpoints
    logger.info(`${hasServiceSpecs ? 'Some' : 'No'} service specs were aggregated successfully`);
    
    // Ensure we always have a properly structured spec
    if (!gatewaySwaggerConfig.paths) {
      gatewaySwaggerConfig.paths = {};
    }
    
    // Always add the health endpoint
    gatewaySwaggerConfig.paths['/health'] = {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        description: 'Returns the health status of the API Gateway',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'Successful operation',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'healthy'
                    },
                    version: {
                      type: 'string',
                      example: '1.0.0'
                    },
                    services: {
                      type: 'object'
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    
    // If nothing was available, provide a completely new spec
    if (!hasServiceSpecs) {
      logger.warn('No service specs available, using fallback OpenAPI specification');
      gatewaySwaggerConfig = {
        openapi: '3.0.0',
        info: {
          ...mainInfo,
          description: `${mainInfo.description}\n\n**NOTE: This is a fallback API specification because no microservices are currently available.**\n\nTo see the complete API documentation, please ensure the following services are running:\n- Auth Service (port ${DEFAULT_PORTS.AUTH})\n- User Service (port ${DEFAULT_PORTS.USER})\n- Subscription Service (port ${DEFAULT_PORTS.SUBSCRIPTION})\n- Content Service (port ${DEFAULT_PORTS.CONTENT})`,
        },
        servers: [{
          url: `http://localhost:${PORT}`,
          description: 'API Gateway Server'
        }],
        paths: {
          '/health': {
            get: {
              tags: ['Health'],
              summary: 'Health check endpoint',
              description: 'Returns the health status of the API Gateway',
              operationId: 'getHealth',
              responses: {
                '200': {
                  description: 'Successful operation',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: {
                            type: 'string',
                            example: 'healthy'
                          },
                          version: {
                            type: 'string',
                            example: '1.0.0'
                          },
                          services: {
                            type: 'object'
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/auth/login': {
            post: {
              tags: ['Auth (Sample)'],
              summary: 'User login (SAMPLE - Auth service not available)',
              description: 'Sample login endpoint that would be available from the Auth service',
              operationId: 'login',
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['email', 'password'],
                      properties: {
                        email: {
                          type: 'string',
                          format: 'email'
                        },
                        password: {
                          type: 'string',
                          format: 'password'
                        }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'Successful operation',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          token: {
                            type: 'string'
                          },
                          user: {
                            type: 'object'
                          }
                        }
                      }
                    }
                  }
                },
                '401': {
                  description: 'Invalid credentials'
                }
              }
            }
          },
          '/api/subscription/plans': {
            get: {
              tags: ['Subscription (Sample)'],
              summary: 'Get subscription plans (SAMPLE - Subscription service not available)',
              description: 'Sample subscription plans endpoint that would be available from the Subscription service',
              operationId: 'getSubscriptionPlans',
              security: [{
                bearerAuth: []
              }],
              responses: {
                '200': {
                  description: 'Successful operation',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: {
                              type: 'string'
                            },
                            name: {
                              type: 'string'
                            },
                            price: {
                              type: 'number'
                            },
                            features: {
                              type: 'array',
                              items: {
                                type: 'string'
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                '401': {
                  description: 'Unauthorized'
                }
              }
            }
          }
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            }
          }
        }
      };
    }

    // Add API Gateway server URL
    gatewaySwaggerConfig.servers = [
      {
        url: `http://localhost:${PORT}`,
        description: 'API Gateway'
      }
    ];
    
    // Ensure security scheme is available
    if (!gatewaySwaggerConfig.components) {
      gatewaySwaggerConfig.components = {};
    }
    
    if (!gatewaySwaggerConfig.components.securitySchemes) {
      gatewaySwaggerConfig.components.securitySchemes = {};
    }
    
    gatewaySwaggerConfig.components.securitySchemes.bearerAuth = {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT'
    };

    // Save the config globally for later updates
    globalGatewaySwaggerConfig = gatewaySwaggerConfig;
    
    // Setup Swagger UI with the combined specification
    app.use('/api-docs', swaggerUi.serve as any[]);
    app.get('/api-docs', (_req: Request, res: Response) => {
      // Always use the latest global config
      res.send(swaggerUi.generateHTML(globalGatewaySwaggerConfig as any, { explorer: true }));
    });

    // Expose the combined Swagger spec as JSON for other tools to consume
    app.get('/swagger.json', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      // Always use the latest global config
      res.send(globalGatewaySwaggerConfig);
    });

    // Endpoint to manually refresh Swagger specs (useful for debugging)
    app.post('/api/internal/refresh-swagger', async (_req: Request, res: Response) => {
      try {
        await setupGatewaySwagger();
        res.status(200).json({
          success: true,
          message: 'Swagger documentation refreshed successfully',
          hasSpecs: hasServiceSpecs
        });
      } catch (error: any) {
        res.status(500).json({
          success: false,
          message: 'Failed to refresh Swagger documentation',
          error: error.message
        });
      }
    });

    logger.info('Swagger UI available at /api-docs');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to setup Swagger documentation', { error: errorMessage });
    // Don't throw error - allow gateway to start even if Swagger setup fails
  }
};

// Call the setup function for Swagger aggregation
let globalGatewaySwaggerConfig: SwaggerSpec | null = null; // Store the current Swagger configuration

setupGatewaySwagger().catch((err: Error) => {
  logger.error('Failed to initialize Swagger aggregation', { error: err.message });
});

// Setup event listener for dynamic swagger spec updates when services become available after initial startup
swaggerEvents.on(SWAGGER_EVENTS.NEW_SPECS_AVAILABLE, async (newSpecs: SwaggerSpec[]) => {
  try {
    logger.info(`Received ${newSpecs.length} new service specs, updating Swagger documentation`);
    
    if (!globalGatewaySwaggerConfig) {
      logger.warn('Cannot update Swagger docs: no base configuration available');
      return;
    }
    
    // Merge the new specs into our existing configuration
    const mainInfo = globalGatewaySwaggerConfig.info;
    
    // Custom merge logic for new specs with existing configuration
    for (const newSpec of newSpecs) {
      // Merge paths
      if (newSpec.paths) {
        globalGatewaySwaggerConfig.paths = { 
          ...globalGatewaySwaggerConfig.paths || {}, 
          ...newSpec.paths 
        };
      }
      
      // Merge components
      if (newSpec.components) {
        if (!globalGatewaySwaggerConfig.components) {
          globalGatewaySwaggerConfig.components = {};
        }
        
        for (const componentType in newSpec.components) {
          if (Object.prototype.hasOwnProperty.call(newSpec.components, componentType)) {
            const componentKey = componentType as keyof SwaggerSpec['components'];
            if (!globalGatewaySwaggerConfig.components[componentKey]) {
              // @ts-ignore - Initialize component type with empty object
              globalGatewaySwaggerConfig.components[componentKey] = {};
            }
            // @ts-ignore - Dynamic property access
            globalGatewaySwaggerConfig.components[componentKey] = {
              // @ts-ignore - Dynamic property access
              ...globalGatewaySwaggerConfig.components[componentKey],
              // @ts-ignore - Dynamic property access
              ...newSpec.components[componentKey]
            };
          }
        }
      }
      
      // Merge tags
      if (newSpec.tags && newSpec.tags.length) {
        if (!globalGatewaySwaggerConfig.tags) {
          globalGatewaySwaggerConfig.tags = [];
        }
        globalGatewaySwaggerConfig.tags = [...globalGatewaySwaggerConfig.tags, ...newSpec.tags];
      }
    }
    
    // Mark that we now have service specs
    hasServiceSpecs = true;
    
    logger.info('Successfully updated Swagger documentation with newly available service specs');
    
    // The updated specs will be automatically used since we're referencing the global object
  } catch (error: any) {
    logger.error('Failed to update Swagger documentation with new specs', { error: error.message });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorHandler = errorMiddleware(logger);
  errorHandler(err, req as any, res as any, next);
});

const server = app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Auth Service proxy: ${SERVICES.AUTH_SERVICE}`);
  logger.info(`User Service proxy: ${SERVICES.USER_SERVICE}`);
  logger.info(`Content Service proxy: ${SERVICES.CONTENT_SERVICE}`);
  
  // Log optional services if configured
  if (SERVICES.SUBSCRIPTION_SERVICE) {
    logger.info(`Subscription Service proxy: ${SERVICES.SUBSCRIPTION_SERVICE}`);
  }
  

  
  if (SERVICES.ASTRO_ENGINE_SERVICE) {
    logger.info(`Astro Engine Service proxy: ${SERVICES.ASTRO_ENGINE_SERVICE}`);
  }
  if (SERVICES.ASTRO_RATAN_SERVICE) {
    logger.info(`Astro Ratan Service proxy: ${SERVICES.ASTRO_RATAN_SERVICE}`);
  }
  
  logger.info(`API Docs available at: http://localhost:${PORT}/api-docs`);
  logger.info(`Swagger JSON available at: http://localhost:${PORT}/swagger.json`);
  
  // Show summary message regarding service status
  if (!hasServiceSpecs) {
    logger.warn('========================================================');
    logger.warn('⚠️  NOTICE: API Gateway is running but no microservices were detected');
    logger.warn('To see the complete API documentation, please ensure microservices are running:');
    logger.warn(`- Auth Service: ${DEFAULT_PORTS.AUTH} → http://localhost:${DEFAULT_PORTS.AUTH}/swagger.json`);
    logger.warn(`- User Service: ${DEFAULT_PORTS.USER} → http://localhost:${DEFAULT_PORTS.USER}/swagger.json`);
    logger.warn(`- Subscription Service: ${DEFAULT_PORTS.SUBSCRIPTION} → http://localhost:${DEFAULT_PORTS.SUBSCRIPTION}/swagger.json`);
    logger.warn(`- Content Service: ${DEFAULT_PORTS.CONTENT} → http://localhost:${DEFAULT_PORTS.CONTENT}/swagger.json`);
    logger.warn('After starting these services, restart the API Gateway to aggregate their Swagger specs');
    logger.warn('========================================================');
  } else {
    logger.info('API Gateway successfully connected to all available microservices');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => logger.info('HTTP server closed'));
});

// Export for testing
export default app;