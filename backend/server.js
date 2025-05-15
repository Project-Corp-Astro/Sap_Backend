/**
 * SAP Project - Main Server
 * This is a development server that combines all microservices for easier local development
 * In production, each microservice should be run separately
 */

const express = require('express');
const compression = require('compression');

// Import shared modules
const config = require('./shared/config');
const { createServiceLogger } = require('./shared/utils/logger');
const { errorMiddleware } = require('./shared/utils/errorHandler');
const { serviceHealth, systemMetrics, RequestTracker, requestTrackerMiddleware } = require('./shared/utils/monitoring');
const { applySecurityMiddleware } = require('./shared/middleware/security');
const dbConnection = require('./shared/utils/database');
const { setupSwagger } = require('./shared/utils/swagger');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const contentRoutes = require('./routes/content');

// Initialize logger
const logger = createServiceLogger('sap-server');

// Initialize request tracker
const requestTracker = new RequestTracker(logger);

// Initialize Express app
const app = express();
const PORT = config.get('port', 5000);
const SERVICE_NAME = 'sap-server';

// Register service with health monitoring
serviceHealth.registerService(SERVICE_NAME, {
  name: 'SAP Development Server',
  description: 'Combined development server for SAP project',
  version: '1.0.0',
  endpoints: [
    '/api/auth',
    '/api/users',
    '/api/content',
    '/api/dashboard',
    '/api/health'
  ]
});

// Apply security middleware (CORS, Helmet, XSS protection, etc.)
applySecurityMiddleware(app);

// Additional middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression()); // Compress responses
app.use(requestTrackerMiddleware(requestTracker)); // Track requests for monitoring

// Connect to MongoDB
dbConnection.connect(config.get('mongo.uri', 'mongodb://localhost:27017/sap-db'))
  .then(() => {
    logger.info('MongoDB Connected');
  })
  .catch(err => {
    logger.error('MongoDB connection error', { error: err.message });
    logger.warn('Continuing without database connection');
  });

// Setup Swagger documentation
setupSwagger(app, {
  definition: {
    info: {
      title: 'SAP API Documentation',
      version: '1.0.0',
      description: 'API documentation for the SAP project'
    },
  },
  apis: ['./routes/*.js']
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/content', contentRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  // Get system metrics
  const metrics = systemMetrics.getSystemMetrics();
  
  // Get database status
  const dbStatus = dbConnection.getStatus();
  
  // Get request stats
  const requestStats = requestTracker.getStats();
  
  // Update service health
  serviceHealth.updateServiceHealth(SERVICE_NAME, {
    status: 'ok',
    metrics: {
      responseTime: requestStats.avgResponseTime,
      errorRate: requestStats.errorRate,
      cpuUsage: metrics.cpu.loadAvg[0] * 100 / metrics.cpu.cpus,
      memoryUsage: (1 - (metrics.memory.free / metrics.memory.total)) * 100
    }
  });
  
  res.status(200).json({
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
    metrics: {
      system: metrics,
      database: dbStatus,
      requests: requestStats
    }
  });
});

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'SAP Backend API',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// Error handling middleware
app.use(errorMiddleware(logger));

// Start server
const server = app.listen(PORT, () => {
  logger.info(`SAP Development Server running on port ${PORT}`);
  logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    // Close database connection
    dbConnection.gracefulShutdown('SIGTERM');
  });
});

module.exports = app; // Export for testing