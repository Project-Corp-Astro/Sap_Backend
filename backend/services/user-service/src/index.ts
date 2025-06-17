import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import userRoutes from './routes/user.routes';
import permissionRoutes from './routes/permission.routes';
import roleRoutes from './routes/role.routes';
import userPermissionRoutes from './routes/user-permission.routes';
import monitoringRoutes from './routes/monitoring.routes';
import logger, { requestLogger, errorLogger } from './utils/logger';
import { performanceMiddleware } from './utils/performance';
import redisUtils from './utils/redis';
import detectPort from 'detect-port';

// Initialize Express app
const app = express();
const PREFERRED_PORT = parseInt(process.env.USER_SERVICE_PORT || '3002', 10);

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(helmet());
app.use(express.json());
app.use(performanceMiddleware); // @ts-ignore
app.use(requestLogger);

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sap-users';
mongoose.set('strictQuery', false);

const mongooseOptions: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 5000,
  retryWrites: true,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4,
};

// Connect to MongoDB
// Import services for initialization
import permissionService from './services/permission.service';
import roleService from './services/role.service';

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGO_URI, mongooseOptions);
    logger.info(`MongoDB Connected to ${MONGO_URI}`);
    
    // Initialize permissions and roles
    await permissionService.initializePermissions();
    await roleService.initializeRoles();

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error after initial connection:', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected, attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (err: any) {
    logger.error('MongoDB connection error:', { error: err.message, stack: err.stack });
    logger.warn('Running with limited functionality. Some features may not work without MongoDB.');
  }
}
connectToDatabase();

// Routes
app.use('/api/users', userRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/user-permissions', userPermissionRoutes); // User permission routes
app.use('/api/monitoring', monitoringRoutes);

app.get('/health', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    const dbConnected = mongoose.connection.readyState === 1;
    
    // Check Redis connection
    const redisConnected = await redisUtils.redisUtils.pingRedis();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'user-service',
      db: { connected: dbConnected },
      redis: { connected: redisConnected }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'user-service',
      error: error instanceof Error ? error.message : 'Health check failed'
    });
  }
});

// Error Logging
app.use(errorLogger);
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start Server
let server: any;
const startServer = async () => {
  try {
    const availablePort = await detectPort(PREFERRED_PORT);

    if (availablePort !== PREFERRED_PORT) {
      logger.warn(`Preferred port ${PREFERRED_PORT} is in use, using available port ${availablePort}`);
    }

    server = app.listen(availablePort, () => {
      logger.info(`User Service running on port ${availablePort}`);
      logger.info(`Health check available at http://localhost:${availablePort}/health`);
    });

  } catch (error: any) {
    logger.error('Failed to start server:', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

startServer();

// Graceful Shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Closing server...`);

  try {
    // Close Redis connection
    await redisUtils.redisUtils.close();
    
    // Close MongoDB connection
    await mongoose.connection.close();
    
    // Close server
    server.close(() => {
      logger.info('Server closed successfully');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during graceful shutdown', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
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
