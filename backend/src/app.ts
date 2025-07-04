/**
 * Main Application File
 * Initializes and configures the Express application with hybrid database architecture
 */

import express, { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createServiceLogger } from '../shared/utils/logger';
import dbManager from './utils/DatabaseManager';
import healthRoutes from './routes/health.routes';
// Import route modules with explicit path resolution
// TypeScript will resolve these imports correctly without extensions
// import userRoutes from '../routes/users';
// import contentRoutes from '../routes/content';
import roleRoutes from '../services/user-service/src/routes/role.routes';

// Create logger
const logger = createServiceLogger('app');

// Create Express app
const app = express();

// Configure application

// Initialize database connections
dbManager.initializeAll()
  .then(() => {
    logger.info('Database connections initialized successfully');
  })
  .catch((error) => {
    logger.error('Error initializing database connections', { error: error.message });
  });

// Middleware
app.use(cors());
app.use(helmet());
// @ts-ignore - Ignoring type incompatibility between different Express versions
app.use(compression());
// @ts-ignore - Ignoring type incompatibility between different Express versions
app.use(express.json());
// @ts-ignore - Ignoring type incompatibility between different Express versions
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('combined'));

// Routes
app.use('/health', healthRoutes);

// // Use TypeScript route implementations
// try {
//   // Add type assertions to fix TypeScript errors with Express route handlers
//   // app.use('/api/users', userRoutes as express.Router);
//   // app.use('/api/content', contentRoutes as express.Router);
 
//   logger.info('Using TypeScript route implementations');
// } catch (error) {
//   logger.error('Error loading TypeScript routes', { error: (error as Error).message });
// }

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'SAP Backend API',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});


// Error handling middleware
const errorHandlerMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  
  // If headers already sent, delegate to the default Express error handler
  if (res.headersSent) {
    return next(err);
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation Error',
        details: err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
      }
    });
    return;
  }
  
  // Handle other errors
  const statusCode = (err as any).statusCode || 500;
  const errorMessage = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    error: {
      message: errorMessage,
      ...(process.env.NODE_ENV !== 'production' && { 
        details: errorMessage,
        stack: err.stack 
      })
    }
  });
};




// Apply general error handler
app.use(errorHandlerMiddleware);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  
  // Close database connections
  dbManager.gracefulShutdown(signal)
    .then(() => {
      logger.info('Database connections closed gracefully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    });
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
