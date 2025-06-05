import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import userRoutes from './routes/user.routes';
import monitoringRoutes from './routes/monitoring.routes';
import logger, { requestLogger, errorLogger } from './utils/logger';
import { performanceMiddleware } from './utils/performance';
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

  } catch (err: any) {
    logger.error('MongoDB connection error:', { error: err.message, stack: err.stack });
    logger.warn('Running with limited functionality. Some features may not work without MongoDB.');
  }
}
connectToDatabase();

// Routes
app.use('/api/users', userRoutes);
app.use('/api/monitoring', monitoringRoutes);

app.get('/health', (req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      name: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
    },
    uptime: process.uptime(),
  });
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
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`);

  server.close(() => {
    logger.info('HTTP server closed');

    if (mongoose.connection.readyState !== 0) {
      mongoose.connection.close(false, () => {
        logger.info('MongoDB connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
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
