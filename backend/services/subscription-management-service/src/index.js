"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const detect_port_1 = __importDefault(require("detect-port"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("../../../shared/utils/swagger");
// Import database configuration
const data_source_1 = require("./db/data-source");
const config_1 = __importDefault(require("./config"));
const logger_1 = __importDefault(require("./utils/logger"));
const redis_1 = require("./utils/redis");
const elasticsearch_1 = require("./utils/elasticsearch");
const supabase_1 = require("./utils/supabase");
// Import routes
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const app_routes_1 = __importDefault(require("./routes/app.routes"));
const monitoring_routes_1 = __importDefault(require("./routes/monitoring.routes"));
const error_handler_1 = require("./middleware/error-handler");
// We import AppDataSource from our data-source file to avoid duplicate declarations
// Initialize Express app
const app = (0, express_1.default)();
const PREFERRED_PORT = config_1.default.port;
// Set up middleware directly
// Enable CORS
// @ts-ignore: Express middleware type error
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
}));
// Security middleware
// @ts-ignore: Express middleware type error
app.use((0, helmet_1.default)());
// Compression middleware
// @ts-ignore: Express middleware type error
app.use((0, compression_1.default)());
// Body parser middleware
// @ts-ignore: Express middleware type error
app.use(express_1.default.json({ limit: '10mb' }));
// @ts-ignore: Express middleware type error
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Configure request logging
app.use((req, res, next) => {
    // Skip logging for health check routes
    if (req.originalUrl === '/health' || req.originalUrl === '/api/subscription/health') {
        return next();
    }
    // Log request details
    const startTime = Date.now();
    // Log response when finished
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime}ms`;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            responseTime: `${responseTime}ms`,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            query: Object.keys(req.query).length > 0 ? req.query : undefined,
            body: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
            params: req.params && Object.keys(req.params).length > 0 ? req.params : undefined,
            headers: Object.assign({ 'content-type': req.headers['content-type'], authorization: req.headers.authorization ? '***' : undefined }, (req.headers['x-forwarded-for'] && { forwardedFor: req.headers['x-forwarded-for'] }))
        };
        if (res.statusCode >= 500) {
            logger_1.default.error(message, logData);
        }
        else if (res.statusCode >= 400) {
            logger_1.default.warn(message, logData);
        }
        else {
            logger_1.default.info(message, logData);
        }
    });
    next();
});
// Initialize service
function initializeService() {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.default.info(`Initializing ${config_1.default.serviceName} in ${config_1.default.env} mode...`);
        // Initialize TypeORM connection using our data-source module
        try {
            yield (0, data_source_1.initializeDatabase)();
            // Set global typeorm connection reference for backward compatibility with getRepository()
            // @ts-ignore - we need this for compatibility with existing code
            global.typeormConnection = data_source_1.AppDataSource;
            logger_1.default.info('Database connection established via data-source module');
            // Run migrations if in production mode
            if (config_1.default.env === 'production' && data_source_1.AppDataSource.migrations.length > 0) {
                yield data_source_1.AppDataSource.runMigrations();
                logger_1.default.info('Database migrations executed successfully');
            }
            else {
                logger_1.default.info('Skipping migrations in development mode');
            }
        }
        catch (error) {
            logger_1.default.error('Failed to connect to database:', error);
            throw new Error('Database connection failed');
        }
        // Check Redis connection with the new service-isolated implementation
        try {
            const redisConnected = yield redis_1.redisUtils.pingRedis();
            if (redisConnected) {
                logger_1.default.info('Redis connection established successfully using service-isolated DB');
                // Test purpose-specific caches
                try {
                    // Test plan cache
                    const planCacheConnected = (yield redis_1.planCache.getClient().ping()) === 'PONG';
                    logger_1.default.info(`Plan-specific cache ${planCacheConnected ? 'connected' : 'failed'}`);
                    // Test user subscription cache
                    const userSubsCacheConnected = (yield redis_1.userSubsCache.getClient().ping()) === 'PONG';
                    logger_1.default.info(`User subscription cache ${userSubsCacheConnected ? 'connected' : 'failed'}`);
                }
                catch (cacheError) {
                    logger_1.default.warn('Purpose-specific caches test failed, fallback to default cache', { error: cacheError instanceof Error ? cacheError.message : String(cacheError) });
                }
            }
            else {
                logger_1.default.warn('Redis connection test failed, service may have limited functionality');
            }
        }
        catch (error) {
            logger_1.default.error('Failed to connect to Redis:', { error: error instanceof Error ? error.message : String(error) });
            // We continue without Redis - the service can still work
            // but with reduced functionality/performance
        }
        // Check Elasticsearch connection
        try {
            const esConnected = yield (0, elasticsearch_1.checkElasticsearchConnection)();
            if (esConnected) {
                logger_1.default.info('Elasticsearch connection established successfully');
            }
            else {
                logger_1.default.warn('Elasticsearch connection failed, service will run with limited search functionality');
            }
        }
        catch (error) {
            logger_1.default.error('Error checking Elasticsearch connection:', error);
            logger_1.default.warn('Service will continue with limited Elasticsearch functionality');
        }
        // Check Supabase connection
        try {
            const supabaseConnected = yield (0, supabase_1.checkSupabaseConnection)();
            if (supabaseConnected) {
                logger_1.default.info('Supabase connection established successfully');
            }
            else {
                logger_1.default.warn('Supabase connection failed, service will run with limited Supabase functionality');
            }
        }
        catch (error) {
            logger_1.default.error('Error checking Supabase connection:', error);
            logger_1.default.warn('Service will continue with limited Supabase functionality');
        }
    });
}
// Routes setup
app.use('/api/subscription/admin', admin_routes_1.default);
app.use('/api/subscription/app', app_routes_1.default);
app.use('/api/subscription/monitoring', monitoring_routes_1.default);
// Health check route handler
const handleHealthCheck = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Initialize connection statuses
        const dbStatus = { connected: false, error: '' };
        const redisStatus = { connected: false, error: '' };
        const esStatus = { connected: false, error: '' };
        const supabaseStatus = { connected: false, error: '' };
        // Check database connectivity using TypeORM
        try {
            // Test the connection by running a simple query
            const connection = yield data_source_1.AppDataSource.query('SELECT 1');
            dbStatus.connected = true;
        }
        catch (error) {
            dbStatus.connected = false;
            dbStatus.error = error instanceof Error ? error.message : 'Database connection failed';
        }
        // Check Redis connectivity
        try {
            redisStatus.connected = yield redis_1.redisUtils.pingRedis();
        }
        catch (error) {
            redisStatus.error = error instanceof Error ? error.message : 'Connection failed';
        }
        // Check Elasticsearch connectivity
        try {
            esStatus.connected = yield (0, elasticsearch_1.checkElasticsearchConnection)();
        }
        catch (error) {
            esStatus.error = error instanceof Error ? error.message : 'Connection failed';
        }
        // Check Supabase connectivity
        try {
            supabaseStatus.connected = yield (0, supabase_1.checkSupabaseConnection)();
        }
        catch (error) {
            supabaseStatus.error = error instanceof Error ? error.message : 'Connection failed';
        }
        // Determine overall status based on critical services
        const criticalServices = [dbStatus, supabaseStatus];
        const isHealthy = criticalServices.every(service => service.connected);
        const status = isHealthy ? 'OK' : 'WARNING';
        // Return response with detailed status
        res.status(isHealthy ? 200 : 503).json({
            status,
            service: config_1.default.serviceName,
            environment: config_1.default.env,
            timestamp: new Date().toISOString(),
            connections: {
                database: dbStatus,
                redis: redisStatus,
                elasticsearch: esStatus,
                supabase: supabaseStatus,
            },
            healthy: isHealthy
        });
    }
    catch (error) {
        logger_1.default.error('Health check error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Health check failed',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Register health check routes
app.get('/health', (req, res) => {
    res.redirect('/api/subscription/monitoring/health');
});
app.get('/api/subscription/health', handleHealthCheck);
// Setup Swagger documentation
// Use absolute paths for file patterns to ensure they're found correctly
const swaggerOptions = (0, swagger_1.createServiceSwaggerConfig)('Subscription Management Service', 'API for managing subscription plans, user subscriptions, and promo codes', config_1.default.port, [
    // Make sure paths are relative to current directory
    `${__dirname}/controllers/**/*.ts`,
    `${__dirname}/routes/**/*.ts`,
    `${__dirname}/entities/**/*.ts`,
    `${__dirname}/models/**/*.ts`
]);
const swaggerSpec = (0, swagger_jsdoc_1.default)(swaggerOptions);
// Use type assertion to fix TypeScript compatibility issue
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpec));
// Expose swagger.json for API Gateway aggregation
app.get('/swagger.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});
// Error handling middleware
app.use(error_handler_1.errorHandler);
// Not found handler - should be the last non-error middleware
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
    });
});
// Start server
let server;
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const availablePort = yield (0, detect_port_1.default)(PREFERRED_PORT);
        if (availablePort !== PREFERRED_PORT) {
            logger_1.default.warn(`Preferred port ${PREFERRED_PORT} is in use, using available port ${availablePort}`);
        }
        // Initialize services before starting the server
        yield initializeService();
        server = app.listen(availablePort, () => {
            logger_1.default.info(`${config_1.default.serviceName} running on port ${availablePort}`);
            logger_1.default.info(`Health check available at http://localhost:${availablePort}/health`);
        });
    }
    catch (error) {
        logger_1.default.error('Failed to start server:', { error: error.message, stack: error.stack });
        process.exit(1);
    }
});
startServer();
// Graceful shutdown handler
const gracefulShutdown = (signal) => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.default.info(`${signal} signal received: closing HTTP server`);
    if (server) {
        server.close(() => {
            logger_1.default.info('HTTP server closed');
            // Close database connections
            Promise.all([
                redis_1.redisUtils.close(),
                elasticsearch_1.elasticsearchUtils.close(),
                supabase_1.supabaseUtils.close()
            ])
                .then(() => {
                logger_1.default.info('All connections closed successfully');
                process.exit(0);
            })
                .catch((error) => {
                logger_1.default.error('Error during cleanup:', error);
                process.exit(1);
            });
        });
    }
});
// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('Unhandled Rejection at:', { reason: String(reason) });
});
process.on('uncaughtException', (error) => {
    if (error.code === 'EADDRINUSE') {
        logger_1.default.error(`Port ${PREFERRED_PORT} is already in use. Please use a different port or stop the process using this port.`, { error: error.message });
        setTimeout(() => process.exit(1), 1000);
    }
    else {
        logger_1.default.error('Uncaught Exception:', { error: error.message, stack: error.stack });
    }
});
exports.default = app;
