"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const monitoring_routes_1 = __importDefault(require("./routes/monitoring.routes"));
const logger_1 = __importStar(require("./utils/logger"));
const performance_1 = require("./utils/performance");
// Initialize Express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3002;
// Middleware
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
// Performance monitoring middleware
// @ts-ignore - Ignoring type error for middleware compatibility
app.use(performance_1.performanceMiddleware);
// Request logging middleware
// @ts-ignore - Ignoring type error for requestLogger compatibility
app.use((0, logger_1.requestLogger)({
    skip: (req) => req.originalUrl === '/health' || req.originalUrl === '/api/health',
    format: ':method :url :status :response-time ms - :res[content-length]'
}));
// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sap-users';
// Set strictQuery to false to suppress the deprecation warning
mongoose_1.default.set('strictQuery', false);
const mongooseOptions = {
    serverSelectionTimeoutMS: 5000,
    retryWrites: true,
};
mongoose_1.default.connect(MONGO_URI, mongooseOptions)
    .then(() => {
    logger_1.default.info('MongoDB Connected');
})
    .catch((err) => {
    logger_1.default.error('MongoDB connection error:', { error: err.message, stack: err.stack });
    process.exit(1);
});
// Routes
app.use('/api/users', user_routes_1.default);
// Monitoring routes
app.use('/api/monitoring', monitoring_routes_1.default);
// Health check route - maintain backward compatibility
// @ts-ignore - Ignoring type error for route handler compatibility
app.get('/health', (req, res) => {
    const dbStatus = mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.status(200).json({
        status: 'ok',
        service: 'user-service',
        timestamp: new Date().toISOString(),
        database: {
            status: dbStatus,
            name: mongoose_1.default.connection.name,
            host: mongoose_1.default.connection.host,
            port: mongoose_1.default.connection.port,
        },
        uptime: process.uptime(),
    });
});
// Error logging middleware
app.use((0, logger_1.errorLogger)());
// Error handling middleware
// @ts-ignore - Ignoring type error for error middleware compatibility
app.use((err, req, res, next) => {
    logger_1.default.error('Unhandled error:', { error: err.message, stack: err.stack, path: req.path });
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
// Start server
const server = app.listen(PORT, () => {
    logger_1.default.info(`User Service running on port ${PORT}`);
    logger_1.default.info(`Health check available at http://localhost:${PORT}/health`);
});
// Handle graceful shutdown
const gracefulShutdown = (signal) => {
    logger_1.default.info(`${signal} signal received: closing HTTP server`);
    server.close(() => {
        logger_1.default.info('HTTP server closed');
        // Close MongoDB connection
        mongoose_1.default.connection.close(false, () => {
            logger_1.default.info('MongoDB connection closed');
            process.exit(0);
        });
    });
};
// Handle signals for graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('Unhandled Rejection at:', { promise, reason });
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger_1.default.error('Uncaught Exception:', { error });
    // Consider whether to exit the process here
    // process.exit(1);
});
exports.default = app; // Export for testing
