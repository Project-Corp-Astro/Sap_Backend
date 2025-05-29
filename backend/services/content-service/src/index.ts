import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import logger, { requestLogger, errorLogger } from './utils/logger';
import { trackResponseTime, trackDatabasePerformance } from './middlewares/performance.middleware';
import config from './config';


// Logger is imported from ./utils/logger

// Import routes
import contentRoutes from './routes/content.routes';
import mediaRoutes from './routes/media.routes';
import videoRoutes from './routes/video.routes';
import analyticsRoutes from './routes/analytics.routes';
import monitoringRoutes from './routes/monitoring.routes';

// Import error handling middleware
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.middleware';

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

// Root path handler
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'Content Service',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      '/api/content',
      '/api/media',
      '/api/videos',
      '/api/analytics',
      '/api/monitoring'
    ]
  });
});

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

// Set strictQuery to false to suppress the deprecation warning
mongoose.set('strictQuery', false);

// Connect to MongoDB with additional options
const mongooseOptions = {
  ...config.mongodb.options,
  serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds instead of 30 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4 // Use IPv4, skip trying IPv6
};

// Store active server instance
let activeServer: http.Server | null = null;

// Function to create and start server with port fallback
const createAndStartServer = (port: number) => {
  // Create HTTP server for this port attempt
  const server = http.createServer(app);
  
  // Initialize Socket.io
  const io = new SocketServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  
  // Socket.io connection handler
  io.on('connection', (socket) => {
    logger.info('New client connected');
    
    // Handle client disconnection
    socket.on('disconnect', () => {
      logger.info('Client disconnected');
    });
  });
  
  // Try to start the server on the given port
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${port} is already in use, trying port ${port + 1}`);
      server.close();
      createAndStartServer(port + 1);
    } else {
      logger.error('Error starting server:', err);
    }
  });
  
  server.on('listening', () => {
    logger.info(`Content Service running on port ${port} in ${config.env} mode`);
  });
  
  server.listen(port, '127.0.0.1');

  
  // Store the active server instance
  activeServer = server;
  
  return server;
};

// Connect to MongoDB
mongoose.connect(config.mongodb.uri, mongooseOptions)
  .then(() => {
    logger.info('Connected to MongoDB');
    
    // Start server with initial port
    createAndStartServer(config.port);
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    logger.info('Please ensure MongoDB is running and accessible at the configured URI');
    logger.info(`Current MongoDB URI: ${config.mongodb.uri}`);
    
    // In development mode, don't exit the process to allow for hot reloading
    if (config.env === 'production') {
      process.exit(1);
    }
  });

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`);

  if (activeServer) {
    await new Promise<void>((resolve) => {
      activeServer.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });
  }

  await mongoose.connection.close();
  logger.info('MongoDB connection closed');
  process.exit(0);
};

// Handle signals for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
