import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoose from 'mongoose';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
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
// Simple logger implementation
const logger = {
    info: (...args) => console.info('[Content Service]', ...args),
    error: (...args) => console.error('[Content Service]', ...args),
    warn: (...args) => console.warn('[Content Service]', ...args),
    debug: (...args) => console.debug('[Content Service]', ...args)
};
// Import routes
import contentRoutes from './routes/content.routes.js';
import mediaRoutes from './routes/media.routes.js';
import videoRoutes from './routes/video.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
const app = express();
// Middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// API routes
app.use('/api/content', contentRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/analytics', analyticsRoutes);
// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Error:', err.message);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: err.message
    });
});
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
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} signal received: closing HTTP server`);
    await new Promise((resolve) => {
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
