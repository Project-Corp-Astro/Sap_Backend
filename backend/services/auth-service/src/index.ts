import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import logger, { requestLogger, errorLogger } from './utils/logger';
import type { ErrorRequestHandler } from 'express';
import detectPort from 'detect-port';

// Initialize Express app
const app = express();

// Determine preferred port
const PORT = process.env.AUTH_SERVICE_PORT ||
  (process.env.AUTH_SERVICE_URL ? new URL(process.env.AUTH_SERVICE_URL).port : 3001);

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

// Health route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'auth-service' });
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
    // Use port 3001 for Auth Service
    const fixedPort = 3001;
    logger.info(`Starting Auth Service on fixed port ${fixedPort}`);

    const server = app.listen(fixedPort, () => {
      logger.info(`Auth Service running on port ${fixedPort}`);
      logger.info(`MongoDB Connected to ${MONGO_URI}`);
    });

    const gracefulShutdown = () => {
      logger.info('Received shutdown signal, closing server...');
      server.close(() => {
        logger.info('Server closed successfully');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Could not close server gracefully, forcing shutdown');
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
