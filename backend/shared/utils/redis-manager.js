"use strict";
/**
 * Redis Manager
 * Provides service-isolated Redis clients for improved scaling and performance
 */
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
exports.RedisPubSub = exports.RedisCache = exports.SERVICE_DB_MAPPING = void 0;
exports.createServiceRedisClient = createServiceRedisClient;
exports.closeAllRedisConnections = closeAllRedisConnections;
exports.getRedisHealthMetrics = getRedisHealthMetrics;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
const index_1 = __importDefault(require("../config/index"));
// Initialize logger
const logger = (0, logger_1.createServiceLogger)('redis-manager');
// Service to DB mapping
// Each service gets its own Redis logical database number
exports.SERVICE_DB_MAPPING = {
    'api-gateway': 0,
    'auth': 1,
    'user': 2,
    'subscription': 3,
    'content': 4,
    'notification': 5,
    'payment': 6,
    'monitoring': 7,
    'analytics': 8,
    // Reserve space for future services
    'default': 0 // Fallback to DB 0 for compatibility
};
// Exponential backoff retry strategy with maximum attempts
const createRetryStrategy = (serviceName) => (times) => {
    const maxRetries = 5;
    if (times > maxRetries) {
        logger.warn(`[${serviceName}] Redis connection retry limit reached (${maxRetries}), stopping reconnection`);
        return null; // Stop retrying
    }
    // Exponential backoff with jitter (200ms to 5sec)
    const delay = Math.min(Math.floor(Math.random() * 200 + Math.pow(2, times) * 100), 5000);
    logger.info(`[${serviceName}] Redis connection retry in ${delay}ms (attempt ${times})`);
    return delay;
};
// Redis connection pool
const redisConnections = {};
const circuitStates = {};
/**
 * Create Redis client for a specific service
 *
 * @param serviceName - Name of the service
 * @param options - Additional Redis options
 * @returns Redis client instance
 */
function createServiceRedisClient(serviceName, options = {}) {
    var _a, _b, _c, _d;
    // Check if client already exists
    const cacheKey = `${serviceName}:${(_b = (_a = options.db) !== null && _a !== void 0 ? _a : exports.SERVICE_DB_MAPPING[serviceName]) !== null && _b !== void 0 ? _b : 0}`;
    if (redisConnections[cacheKey]) {
        return redisConnections[cacheKey];
    }
    // Get service-specific database number
    const dbNumber = (_d = (_c = options.db) !== null && _c !== void 0 ? _c : exports.SERVICE_DB_MAPPING[serviceName]) !== null && _d !== void 0 ? _d : exports.SERVICE_DB_MAPPING.default;
    // Create service-specific key prefix
    const servicePrefix = `${index_1.default.get('redis.keyPrefix', 'sap:')}${serviceName}:`;
    // Default Redis configuration
    const defaultConfig = {
        host: index_1.default.get('redis.host', 'localhost'),
        port: parseInt(index_1.default.get('redis.port', '6379')),
        password: index_1.default.get('redis.password', ''),
        db: dbNumber,
        keyPrefix: servicePrefix,
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        commandTimeout: 5000,
        enableReadyCheck: true,
        connectionName: `sap-${serviceName}`,
        retryStrategy: createRetryStrategy(serviceName)
    };
    // Merge default config with options
    const redisOptions = Object.assign(Object.assign({}, defaultConfig), options);
    // Initialize circuit breaker state
    if (!circuitStates[serviceName]) {
        circuitStates[serviceName] = {
            failures: 0,
            lastFailure: 0,
            isOpen: false
        };
    }
    // Create Redis client
    const client = new ioredis_1.default(redisOptions);
    // Handle connection events
    client.on('connect', () => {
        logger.info(`[${serviceName}] Redis client connected to DB ${dbNumber}`);
        // Reset circuit breaker on successful connection
        circuitStates[serviceName].failures = 0;
        circuitStates[serviceName].isOpen = false;
    });
    client.on('error', (err) => {
        logger.error(`[${serviceName}] Redis client error`, { error: err.message });
        // Update circuit breaker state
        const state = circuitStates[serviceName];
        state.failures++;
        state.lastFailure = Date.now();
        // Open circuit after 3 consecutive failures
        if (state.failures >= 3) {
            state.isOpen = true;
            logger.warn(`[${serviceName}] Redis circuit breaker opened after ${state.failures} failures`);
        }
    });
    client.on('reconnecting', () => {
        logger.info(`[${serviceName}] Redis client reconnecting`);
    });
    client.on('close', () => {
        logger.info(`[${serviceName}] Redis client connection closed`);
    });
    // Store for reuse
    redisConnections[cacheKey] = client;
    return client;
}
/**
 * Create a Redis cache utility
 * Provides a simple interface for cache operations
 */
class RedisCache {
    /**
     * Create a Redis cache instance
     *
     * @param serviceName - Name of the service
     * @param options - Redis connection options
     */
    constructor(serviceName, options = {}) {
        this.serviceName = serviceName;
        this.client = createServiceRedisClient(serviceName, options);
        this.logger = (0, logger_1.createServiceLogger)(`${serviceName}-cache`);
    }
    /**
     * Get a value from cache
     *
     * @param key - Cache key
     * @returns Cached value or null
     */
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Check circuit breaker
                const state = circuitStates[this.serviceName];
                if (state === null || state === void 0 ? void 0 : state.isOpen) {
                    const now = Date.now();
                    const cooldownPeriod = 30000; // 30 seconds
                    if (now - state.lastFailure < cooldownPeriod) {
                        this.logger.warn(`[${this.serviceName}] Circuit breaker open, skipping Redis call`);
                        return null;
                    }
                    // Try to reset after cooldown period
                    state.isOpen = false;
                }
                const value = yield this.client.get(key);
                if (!value)
                    return null;
                try {
                    return JSON.parse(value);
                }
                catch (_a) {
                    return value;
                }
            }
            catch (error) {
                this.logger.error(`Error getting cache key ${key}`, {
                    error: error.message,
                    service: this.serviceName
                });
                return null;
            }
        });
    }
    /**
     * Set a value in cache with optional expiration
     *
     * @param key - Cache key
     * @param value - Value to cache
     * @param ttlSeconds - Time to live in seconds
     * @returns Operation success
     */
    set(key, value, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Check circuit breaker
                if ((_a = circuitStates[this.serviceName]) === null || _a === void 0 ? void 0 : _a.isOpen) {
                    this.logger.warn(`[${this.serviceName}] Circuit breaker open, skipping Redis call`);
                    return false;
                }
                const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
                if (ttlSeconds) {
                    yield this.client.set(key, valueStr, 'EX', ttlSeconds);
                }
                else {
                    yield this.client.set(key, valueStr);
                }
                return true;
            }
            catch (error) {
                this.logger.error(`Error setting cache key ${key}`, {
                    error: error.message,
                    service: this.serviceName
                });
                return false;
            }
        });
    }
    /**
     * Delete a key from cache
     *
     * @param key - Cache key
     * @returns Operation success
     */
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.client.del(key);
                return true;
            }
            catch (error) {
                this.logger.error(`Error deleting cache key ${key}`, {
                    error: error.message,
                    service: this.serviceName
                });
                return false;
            }
        });
    }
    /**
     * Check if key exists in cache
     *
     * @param key - Cache key
     * @returns True if key exists
     */
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.client.exists(key);
                return result === 1;
            }
            catch (error) {
                this.logger.error(`Error checking if key ${key} exists`, {
                    error: error.message,
                    service: this.serviceName
                });
                return false;
            }
        });
    }
    /**
     * Find keys matching a pattern
     *
     * @param pattern - Key pattern (e.g., "user:*")
     * @returns Array of matching keys
     */
    keys(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.client.keys(pattern);
            }
            catch (error) {
                this.logger.error(`Error finding keys matching pattern ${pattern}`, {
                    error: error.message,
                    service: this.serviceName
                });
                return [];
            }
        });
    }
    /**
     * Delete keys matching a pattern
     *
     * @param pattern - Key pattern (e.g., "user:*")
     * @returns Number of keys deleted
     */
    deleteByPattern(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const keys = yield this.client.keys(pattern);
                if (keys.length === 0)
                    return 0;
                return yield this.client.del(...keys);
            }
            catch (error) {
                this.logger.error(`Error deleting keys by pattern ${pattern}`, {
                    error: error.message,
                    service: this.serviceName
                });
                return 0;
            }
        });
    }
    /**
     * Get the Redis client instance
     * @returns Redis client
     */
    getClient() {
        return this.client;
    }
}
exports.RedisCache = RedisCache;
/**
 * Create a PubSub utility for Redis
 * Handles subscription and publication of messages
 */
class RedisPubSub {
    /**
     * Create Redis PubSub instance
     *
     * @param serviceName - Name of the service
     * @param options - Redis connection options
     */
    constructor(serviceName, options = {}) {
        this.subscribers = {};
        this.serviceName = serviceName;
        this.publisher = createServiceRedisClient(`${serviceName}-pub`, options);
        this.logger = (0, logger_1.createServiceLogger)(`${serviceName}-pubsub`);
    }
    /**
     * Subscribe to a channel
     *
     * @param channel - Channel to subscribe to
     * @param callback - Callback for messages
     * @returns Redis subscriber instance
     */
    subscribe(channel, callback) {
        if (this.subscribers[channel]) {
            return this.subscribers[channel];
        }
        const subscriber = createServiceRedisClient(`${this.serviceName}-sub-${channel}`, { db: this.publisher.options.db });
        subscriber.on('message', (ch, message) => {
            if (ch === channel && callback) {
                try {
                    const parsedMessage = JSON.parse(message);
                    callback(parsedMessage);
                }
                catch (err) {
                    this.logger.error('Error parsing Redis message', {
                        error: err.message,
                        channel,
                        message
                    });
                    callback(message);
                }
            }
        });
        subscriber.subscribe(channel).then(() => {
            this.logger.info(`[${this.serviceName}] Subscribed to Redis channel: ${channel}`);
        }).catch((err) => {
            this.logger.error(`[${this.serviceName}] Error subscribing to channel: ${channel}`, {
                error: err.message
            });
        });
        this.subscribers[channel] = subscriber;
        return subscriber;
    }
    /**
     * Publish message to a channel
     *
     * @param channel - Channel to publish to
     * @param message - Message to publish
     * @returns Number of clients that received the message
     */
    publish(channel, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
                return yield this.publisher.publish(channel, messageStr);
            }
            catch (error) {
                this.logger.error(`Error publishing to channel ${channel}`, {
                    error: error.message,
                    service: this.serviceName
                });
                return 0;
            }
        });
    }
    /**
     * Close all subscribers
     */
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            const closeTasks = [];
            Object.values(this.subscribers).forEach((subscriber) => {
                closeTasks.push(subscriber.quit());
            });
            closeTasks.push(this.publisher.quit());
            try {
                yield Promise.all(closeTasks);
                this.logger.info(`[${this.serviceName}] All PubSub connections closed`);
            }
            catch (error) {
                this.logger.error(`[${this.serviceName}] Error closing PubSub connections`, {
                    error: error.message
                });
            }
        });
    }
}
exports.RedisPubSub = RedisPubSub;
/**
 * Close all Redis connections
 */
function closeAllRedisConnections() {
    return __awaiter(this, void 0, void 0, function* () {
        const closeTasks = [];
        Object.values(redisConnections).forEach((client) => {
            closeTasks.push(client.quit());
        });
        try {
            yield Promise.all(closeTasks);
            logger.info('All Redis connections closed');
        }
        catch (error) {
            logger.error('Error closing Redis connections', {
                error: error.message
            });
        }
    });
}
/**
 * Get Redis health metrics
 *
 * @param serviceName - Name of the service to check
 */
function getRedisHealthMetrics(serviceName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const client = createServiceRedisClient(`${serviceName}-health`);
            const info = yield client.info();
            // Parse important metrics
            const metrics = {
                uptime: parseRedisInfo(info, 'uptime_in_seconds'),
                connectedClients: parseRedisInfo(info, 'connected_clients'),
                usedMemory: parseRedisInfo(info, 'used_memory_human'),
                totalKeys: yield getTotalKeys(client),
                hitRate: calculateHitRate(info)
            };
            return metrics;
        }
        catch (error) {
            logger.error(`Error getting Redis health metrics for ${serviceName}`, {
                error: error.message
            });
            return null;
        }
    });
}
// Helper function to parse Redis info output
function parseRedisInfo(info, key) {
    const regex = new RegExp(`^${key}:(.*)$`, 'm');
    const match = info.match(regex);
    return match ? match[1].trim() : '';
}
// Helper function to calculate cache hit rate
function calculateHitRate(info) {
    const hits = parseInt(parseRedisInfo(info, 'keyspace_hits')) || 0;
    const misses = parseInt(parseRedisInfo(info, 'keyspace_misses')) || 0;
    const total = hits + misses;
    if (total === 0)
        return '0%';
    return `${((hits / total) * 100).toFixed(2)}%`;
}
// Helper function to get total keys in a Redis instance
function getTotalKeys(client) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const keys = yield client.keys('*');
            return keys.length;
        }
        catch (_a) {
            return 0;
        }
    });
}
// Export default functions for convenience
exports.default = {
    createServiceRedisClient,
    RedisCache,
    RedisPubSub,
    closeAllRedisConnections,
    getRedisHealthMetrics,
    SERVICE_DB_MAPPING: exports.SERVICE_DB_MAPPING
};
