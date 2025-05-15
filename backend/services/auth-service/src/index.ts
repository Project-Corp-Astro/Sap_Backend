import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes';
import logger, { requestLogger, errorLogger } from './utils/logger';

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Request logging middleware
app.use(requestLogger({
  // Skip health check endpoints to avoid cluttering logs
  skip: (req: Request) => req.originalUrl === '/health' || req.originalUrl === '/api/health',
  // Custom format for request logs
  format: ':method :url :status :response-time ms - :res[content-length]'
}));

// MongoDB Connection (should be moved to a separate config in production)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sap-auth';

// Set strictQuery to false to suppress the deprecation warning
mongoose.set('strictQuery', false);

mongoose.connect(MONGO_URI)
  .then(() => logger.info('MongoDB Connected'))
  .catch(err => {
    logger.error('MongoDB connection error:', { error: err.message, stack: err.stack });
    process.exit(1);
  });

// Routes
app.use('/api/auth', authRoutes);

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'auth-service' });
});

// Error logging middleware
app.use(errorLogger());

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error:', { error: err.message, stack: err.stack, path: req.path });
  
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Auth Service running on port ${PORT}`);
});
