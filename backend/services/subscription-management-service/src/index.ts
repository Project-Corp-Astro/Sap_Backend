import 'reflect-metadata';
import express from 'express';
import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import http from 'http';
import detectPort from 'detect-port';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { createServiceSwaggerConfig } from '../../../shared/utils/swagger';
// Import database configuration
import { AppDataSource, initializeDatabase } from './db/data-source';
import config from './config';
import logger, { errorLoggerMiddleware } from './utils/logger';
import { redisClient, redisUtils, planCache, userSubsCache } from './utils/redis';
import { elasticsearchClient, elasticsearchUtils, checkElasticsearchConnection } from './utils/elasticsearch';
import { supabaseClient, checkSupabaseConnection, supabaseUtils } from './utils/supabase';
import * as path from 'path';

// Import routes
import adminRoutes from './routes/admin.routes';
import appRoutes from './routes/app.routes';
import monitoringRoutes from './routes/monitoring.routes';
import subscriptionAnalyticsRoutes from './routes/subscription-analytics.routes';
import { errorHandler } from './middleware/error-handler';



// We import AppDataSource from our data-source file to avoid duplicate declarations

// Initialize Express app
const app = express();
const PREFERRED_PORT = config.port;

// Set up middleware directly
// Enable CORS
// @ts-ignore: Express middleware type error
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

// Security middleware
// @ts-ignore: Express middleware type error
app.use(helmet());

// Compression middleware
// @ts-ignore: Express middleware type error
app.use(compression());

// Body parser middleware
// @ts-ignore: Express middleware type error
app.use(express.json({ limit: '10mb' }));
// @ts-ignore: Express middleware type error
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Configure request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip logging for health check routes
  if (req.originalUrl === '/health' || req.originalUrl === '/api/subscription/health') {
    return next();
  }
  
  // Log request details
  const startTime = Date.now();
  
  // Log response when finished
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime}ms`;
    
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
      params: req.params && Object.keys(req.params).length > 0 ? req.params : undefined,
      headers: {
        'content-type': req.headers['content-type'],
        authorization: req.headers.authorization ? '***' : undefined,
        ...(req.headers['x-forwarded-for'] && { forwardedFor: req.headers['x-forwarded-for'] })
      }
    };
    
    if (res.statusCode >= 500) {
      logger.error(message, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(message, logData);
    } else {
      logger.info(message, logData);
    }
  });
  
  next();
});

// Initialize service
async function initializeService() {
  logger.info(`Initializing ${config.serviceName} in ${config.env} mode...`);
  
  // Initialize TypeORM connection using our data-source module
  try {
    await initializeDatabase();
    
    // Set global typeorm connection reference for backward compatibility with getRepository()
    // @ts-ignore - we need this for compatibility with existing code
    global.typeormConnection = AppDataSource;
    logger.info('Database connection established via data-source module');
    
    // Run migrations if in production mode
    if (config.env === 'production' && AppDataSource.migrations.length > 0) {
      await AppDataSource.runMigrations();
      logger.info('Database migrations executed successfully');
    } else {
      logger.info('Skipping migrations in development mode');
    }
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw new Error('Database connection failed');
  }
  
  // Check Redis connection with the new service-isolated implementation
  try {
    const redisConnected = await redisUtils.pingRedis();
    if (redisConnected) {
      logger.info('Redis connection established successfully using service-isolated DB');
      
      // Test purpose-specific caches
      try {
        // Test plan cache
        const planCacheConnected = await planCache.getClient().ping() === 'PONG';
        logger.info(`Plan-specific cache ${planCacheConnected ? 'connected' : 'failed'}`);
        
        // Test user subscription cache
        const userSubsCacheConnected = await userSubsCache.getClient().ping() === 'PONG';
        logger.info(`User subscription cache ${userSubsCacheConnected ? 'connected' : 'failed'}`);
      } catch (cacheError) {
        logger.warn('Purpose-specific caches test failed, fallback to default cache', { error: cacheError instanceof Error ? cacheError.message : String(cacheError) });
      }
    } else {
      logger.warn('Redis connection test failed, service may have limited functionality');
    }
  } catch (error: unknown) {
    logger.error('Failed to connect to Redis:', { error: error instanceof Error ? error.message : String(error) });
    // We continue without Redis - the service can still work
    // but with reduced functionality/performance
  }
  
  // Check Elasticsearch connection
  try {
    const esConnected = await checkElasticsearchConnection();
    if (esConnected) {
      logger.info('Elasticsearch connection established successfully');
    } else {
      logger.warn('Elasticsearch connection failed, service will run with limited search functionality');
    }
  } catch (error) {
    logger.error('Error checking Elasticsearch connection:', error);
    logger.warn('Service will continue with limited Elasticsearch functionality');
  }
  
  // Check Supabase connection
  try {
    const supabaseConnected = await checkSupabaseConnection();
    if (supabaseConnected) {
      logger.info('Supabase connection established successfully');
    } else {
      logger.warn('Supabase connection failed, service will run with limited Supabase functionality');
    }
  } catch (error) {
    logger.error('Error checking Supabase connection:', error);
    logger.warn('Service will continue with limited Supabase functionality');
  }
}

// Routes setup
app.use('/api/subscription/admin', adminRoutes);
app.use('/api/subscription/app', appRoutes);
app.use('/api/subscription/monitoring', monitoringRoutes);
app.use('/api/subscription/analytics', subscriptionAnalyticsRoutes);

// Health check route handler
const handleHealthCheck = async (_req: Request, res: Response) => {
  try {
    // Initialize connection statuses
    const dbStatus = { connected: false, error: '' };
    const redisStatus = { connected: false, error: '' };
    const esStatus = { connected: false, error: '' };
    const supabaseStatus = { connected: false, error: '' };

    // Check database connectivity using TypeORM
    try {
      // Test the connection by running a simple query
      const connection = await AppDataSource.query('SELECT 1');
      dbStatus.connected = true;
    } catch (error) {
      dbStatus.connected = false;
      dbStatus.error = error instanceof Error ? error.message : 'Database connection failed';
    }

    // Check Redis connectivity
    try {
      redisStatus.connected = await redisUtils.pingRedis();
    } catch (error) {
      redisStatus.error = error instanceof Error ? error.message : 'Connection failed';
    }

    // Check Elasticsearch connectivity
    try {
      esStatus.connected = await checkElasticsearchConnection();
    } catch (error) {
      esStatus.error = error instanceof Error ? error.message : 'Connection failed';
    }

    // Check Supabase connectivity
    try {
      supabaseStatus.connected = await checkSupabaseConnection();
    } catch (error) {
      supabaseStatus.error = error instanceof Error ? error.message : 'Connection failed';
    }

    // Determine overall status based on critical services
    const criticalServices = [dbStatus, supabaseStatus];
    const isHealthy = criticalServices.every(service => service.connected);
    const status = isHealthy ? 'OK' : 'WARNING';

    // Return response with detailed status
    res.status(isHealthy ? 200 : 503).json({
      status,
      service: config.serviceName,
      environment: config.env,
      timestamp: new Date().toISOString(),
      connections: {
        database: dbStatus,
        redis: redisStatus,
        elasticsearch: esStatus,
        supabase: supabaseStatus,
      },
      healthy: isHealthy
    });
  } catch (error: any) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message || 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Register health check routes
app.get('/health', (req, res) => {
  res.redirect('/api/subscription/monitoring/health');
});
app.get('/api/subscription/health', handleHealthCheck);

// Setup Swagger documentation
// Use absolute paths for file patterns to ensure they're found correctly
const swaggerOptions = createServiceSwaggerConfig(
  'Subscription Management Service',
  'API for managing subscription plans, user subscriptions, and promo codes',
  config.port,
  [
    // Make sure paths are relative to current directory
    `${__dirname}/controllers/**/*.ts`,
    `${__dirname}/routes/**/*.ts`,
    `${__dirname}/entities/**/*.ts`,
    `${__dirname}/models/**/*.ts`
  ]
);

const swaggerSpec = swaggerJsdoc(swaggerOptions);
// Use type assertion to fix TypeScript compatibility issue
app.use('/api-docs', swaggerUi.serve as any, swaggerUi.setup(swaggerSpec) as any);

// Expose swagger.json for API Gateway aggregation
app.get('/swagger.json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Regular route handlers should be registered before these

// 404 handler - must be after all other route handlers but before error handlers
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handling middleware - must have 4 parameters to be recognized as an error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // Delegate to the error handler
  errorHandler(err, req, res, next);
});

// Start server
let server: http.Server;
const startServer = async () => {
  try {
    const availablePort = await detectPort(PREFERRED_PORT);
    
    if (availablePort !== PREFERRED_PORT) {
      logger.warn(`Preferred port ${PREFERRED_PORT} is in use, using available port ${availablePort}`);
    }
    
    // Initialize services before starting the server
    await initializeService();
    
    server = app.listen(availablePort, () => {
      logger.info(`${config.serviceName} running on port ${availablePort}`);
      logger.info(`Health check available at http://localhost:${availablePort}/health`);
    });
    
  } catch (error: any) {
    logger.error('Failed to start server:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

startServer();

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      
      // Close database connections
      Promise.all([
        redisUtils.close(),
        elasticsearchUtils.close(),
        supabaseUtils.close()
      ])
        .then(() => {
          logger.info('All connections closed successfully');
          process.exit(0);
        })
        .catch((error) => {
          logger.error('Error during cleanup:', error);
          process.exit(1);
        });
    });
  }
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', { reason: String(reason) });
});

process.on('uncaughtException', (error: Error) => {
  if ((error as any).code === 'EADDRINUSE') {
    logger.error(`Port ${PREFERRED_PORT} is already in use. Please use a different port or stop the process using this port.`, { error: error.message });
    setTimeout(() => process.exit(1), 1000);
  } else {
    logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  }
});

export default app;