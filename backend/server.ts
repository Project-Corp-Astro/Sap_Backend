/**
 * Server Entry Point
 * Starts the Express server and handles configuration
 */

import dotenv from 'dotenv';
import path from 'path';
import { createServiceLogger } from './shared/utils/logger';
import dbManager from './src/utils/DatabaseManager';

// Load environment variables
dotenv.config();

// Create logger
const logger = createServiceLogger('server');

// Import app after environment variables are loaded
import app from './src/app';

// Get port from environment or use default
const PORT = process.env.PORT || 3000;

// Initialize database connections
dbManager.initializeAll()
  .then(() => {
    logger.info('Database connections initialized successfully');
  })
  .catch((error) => {
    // Log the error but continue starting the server
    logger.error('Error during database initialization', { error: error.message });
    logger.warn('Starting server despite database initialization errors');
  })
  .finally(() => {
    // Start server regardless of database connection status
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
    
    // Handle graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`${signal} signal received: closing HTTP server`);
      
      server.close(() => {
        logger.info('HTTP server closed');
        
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
      });
    };
    
    // Listen for termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Promise Rejection', { reason: reason.message, stack: reason.stack });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  
  // Exit with error
  process.exit(1);
});
