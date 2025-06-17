import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import debugRoutes from './routes/debug.routes';
import logger, { requestLogger, errorLogger } from './utils/logger';
import type { ErrorRequestHandler } from 'express';
// Import Redis utilities with service isolation
import { redisUtils, sessionCache, otpCache } from './utils/redis';
import detectPort from 'detect-port';

// Initialize Express app
const app = express();

// Define standard service configuration
const SERVICE_NAME = 'auth-service';
const DEFAULT_PORT = 3001;

// Determine preferred port
const PORT = process.env.AUTH_SERVICE_PORT || DEFAULT_PORT;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

const jsonSyntaxErrorHandler = ((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      message: 'Invalid JSON payload',
    });
    return;
  }
  next(err);
}) as ErrorRequestHandler;

// Register the handler *after* body parsing middleware
app.use(jsonSyntaxErrorHandler);
// Request logging
app.use(requestLogger({
  skip: (req: Request) => req.originalUrl === '/health' || req.originalUrl === '/api/health',
  format: ':method :url :status :response-time ms - :res[content-length]'
}));


// Mongo URI config
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sap-db';
mongoose.set('strictQuery', false);

const mongooseOptions = {
  serverSelectionTimeoutMS: 5000,
  retryWrites: true,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4
};

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGO_URI, mongooseOptions);
    logger.info(`MongoDB Connected to ${MONGO_URI}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error after initial connection:', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected, attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (err) {
    logger.error('MongoDB connection error:', { error: (err as Error).message });

    if (process.env.NODE_ENV === 'development') {
      logger.warn('Running in development mode without MongoDB - some features may not work');
    } else {
      process.exit(1);
    }
  }
}

connectToDatabase();

// Routes
app.use('/api/auth', authRoutes);

// Debug routes - only available in development mode
if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
  logger.info('Debug routes enabled');
  app.use('/api/debug', debugRoutes);
}

// Enhanced health route with Redis connectivity check
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Check Redis connectivity
    const redisConnected = await redisUtils.pingRedis();
    
    res.status(200).json({
      status: 'ok',
      service: 'auth-service',
      redis: redisConnected ? 'connected' : 'disconnected'
    });
  } catch (error) {
    logger.error('Health check error:', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      status: 'error',
      service: 'auth-service',
      message: 'Error performing health check'
    });
  }
});

// Error logging and handling
app.use(errorLogger());
app.use(((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}) as express.ErrorRequestHandler);

// Start server safely
const startServer = async () => {
  try {
    // Check Redis connectivity before starting server
    try {
      const redisConnected = await redisUtils.pingRedis();
      if (redisConnected) {
        logger.info('Redis connection established successfully using service-isolated DB');
        
        // Check purpose-specific caches
        try {
          const sessionCachePong = await sessionCache.getClient().ping();
          if (sessionCachePong === 'PONG') {
            logger.info('Session cache connected');
          } else {
            logger.warn('Session cache not connected properly');
          }
        } catch (err) {
          logger.warn('Session cache error during ping:', { error: err instanceof Error ? err.message : String(err) });
        }
        
        try {
          const otpCachePong = await otpCache.getClient().ping();
          if (otpCachePong === 'PONG') {
            logger.info('OTP cache connected');
          } else {
            logger.warn('OTP cache not connected properly');
          }
        } catch (err) {
          logger.warn('OTP cache error during ping:', { error: err instanceof Error ? err.message : String(err) });
        }
        
      } else {
        logger.warn('Redis connection failed, but proceeding with service startup');
      }
    } catch (error) {
      logger.error('Redis connection error:', { error: error instanceof Error ? error.message : String(error) });
      logger.warn('Continuing without Redis - functionality will be limited');
    }
    
    // Use port 3001 for Auth Service
    const fixedPort = 3001;
    logger.info(`Starting Auth Service on fixed port ${fixedPort}`);

    const server = app.listen(fixedPort, () => {
      logger.info(`Auth Service running on port ${fixedPort}`);
      logger.info(`MongoDB Connected to ${MONGO_URI}`);
    });

    const gracefulShutdown = async () => {
      logger.info('Received shutdown signal, closing server and connections...');
      
      server.close(async () => {
        logger.info('HTTP server closed successfully');
        
        try {
          // Close Redis connections
          await redisUtils.close();
          logger.info('Redis connections closed successfully');
          
          // Close MongoDB connection
          await mongoose.connection.close();
          logger.info('MongoDB connection closed successfully');
          
          logger.info('All connections closed successfully');
          process.exit(0);
        } catch (error) {
          logger.error('Error during graceful shutdown:', { error: error instanceof Error ? error.message : String(error) });
          process.exit(1);
        }
      });
      
      // Safety timeout
      setTimeout(() => {
        logger.error('Could not close connections gracefully within timeout, forcing shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', { error: error.message, stack: error.stack });
      gracefulShutdown();
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', { reason });
      gracefulShutdown();
    });

  } catch (error) {
    logger.error('Failed to start server:', { error: (error as Error).message });
    process.exit(1);
  }
};

startServer();
