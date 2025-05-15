import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import logger, { requestLogger, errorLogger } from './utils/logger.js';
import { trackResponseTime, trackDatabasePerformance } from './middlewares/performance.middleware.js';

// Simple config implementation for development
const config = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3002,
  env: process.env.NODE_ENV || 'development',
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/sap-content'
  },
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
  jwtExpiration: process.env.JWT_EXPIRATION || '1d'
};

// Logger is imported from ./utils/logger.js

// Import routes
import contentRoutes from './routes/content.routes.js';
import mediaRoutes from './routes/media.routes.js';
import videoRoutes from './routes/video.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import monitoringRoutes from './routes/monitoring.routes.js';

// Import error handling middleware
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware.js';

const app = express();

// Middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
app.use(requestLogger({
  // Skip health check endpoints to avoid cluttering logs
  skip: (req) => req.originalUrl === '/health' || req.originalUrl === '/api/health',
  // Custom format for request logs
  format: ':method :url :status :response-time ms - :res[content-length]'
}));

// Performance monitoring middleware
app.use(trackResponseTime);
app.use(trackDatabasePerformance);

// API routes
app.use('/api/content', contentRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/monitoring', monitoringRoutes);

// Health check endpoint (shortcut for monitoring/health)
app.get('/health', (req, res) => {
  res.redirect('/api/monitoring/health');
});

// 404 handler for undefined routes
app.use('*', notFoundHandler);

// Error logging middleware
app.use(errorLogger());

// Global error handling middleware
app.use(errorHandler);

// Create HTTP server
const server = http.createServer(app);

// Socket.io setup
const io = new SocketServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info('New client connected');
  
  socket.on('disconnect', () => {
    logger.info('Client disconnected');
  });
});

// Set strictQuery to false to suppress the deprecation warning
mongoose.set('strictQuery', false);

// Connect to MongoDB
mongoose.connect(config.mongodb.uri)
  .then(() => {
    logger.info('Connected to MongoDB');
    
    // Start server
    server.listen(config.port, () => {
      logger.info(`Content Service running on port ${config.port} in ${config.env} mode`);
    });
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`);

  await new Promise<void>((resolve) => {
    server.close(() => {
      logger.info('HTTP server closed');
      resolve();
    });
  });

  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
  process.exit(0);
};

// Handle signals for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
