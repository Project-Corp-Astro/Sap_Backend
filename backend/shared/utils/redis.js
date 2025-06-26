"use strict";
/**
 * Redis Client Utility
 * Provides a centralized Redis client for caching, session storage, and pub/sub
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
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("./logger");
const index_1 = __importDefault(require("../config/index"));
// Determine if we should use mock databases
const USE_MOCK_DATABASES = process.env.USE_MOCK_DATABASES === 'true' || process.env.NODE_ENV === 'development';
// Initialize logger
const logger = (0, logger_1.createServiceLogger)('redis-client');
// Default Redis configuration
const defaultConfig = {
    host: index_1.default.get('redis.host', 'localhost'),
    port: parseInt(index_1.default.get('redis.port', '6379')),
    password: index_1.default.get('redis.password', ''),
    db: parseInt(index_1.default.get('redis.db', '0')),
    keyPrefix: index_1.default.get('redis.keyPrefix', 'sap:'),
    maxRetriesPerRequest: 5, // Increased from 3 to 5
    connectTimeout: 10000, // Increased from 5s to 10s
    commandTimeout: 8000, // Increased from 3s to 8s
    retryStrategy: (times) => {
        // Limit retry attempts to 5
        if (times > 5) {
            logger.warn('Redis connection retry limit reached, stopping reconnection attempts');
            return null; // Stop retrying
        }
        const delay = Math.min(times * 200, 2000); // Increased delay
        logger.info(`Redis connection retry in ${delay}ms (attempt ${times})`);
        return delay;
    }
};
/**
 * Redis client singleton
 */
class RedisClient {
    constructor() {
        this.client = null;
        this.subscribers = {};
        this.publisher = null;
    }
    /**
     * Initialize Redis client
     * @param options - Redis connection options
     * @returns Redis client instance
     */
    initialize(options = {}) {
        if (this.client) {
            return this.client;
        }
        const redisOptions = Object.assign(Object.assign({}, defaultConfig), options);
        // Create Redis client
        this.client = new ioredis_1.default(redisOptions);
        // Handle connection events
        this.client.on('connect', () => {
            logger.info('Redis client connected');
        });
        this.client.on('error', (err) => {
            logger.error('Redis client error', { error: err.message });
        });
        this.client.on('close', () => {
            logger.info('Redis client connection closed');
        });
        return this.client;
    }
    /**
     * Get Redis client instance
     * @returns Redis client instance
     */
    getClient() {
        if (!this.client) {
            return this.initialize();
        }
        return this.client;
    }
    /**
     * Create a dedicated subscriber client for a channel
     * @param channel - Channel to subscribe to
     * @param callback - Callback function for messages
     * @returns Redis subscriber instance
     */
    createSubscriber(channel, callback) {
        if (this.subscribers[channel]) {
            return this.subscribers[channel];
        }
        const subscriber = new ioredis_1.default(defaultConfig);
        subscriber.on('message', (ch, message) => {
            if (ch === channel && callback) {
                try {
                    const parsedMessage = JSON.parse(message);
                    callback(parsedMessage);
                }
                catch (err) {
                    logger.error('Error parsing Redis message', {
                        error: err.message,
                        channel,
                        message
                    });
                    callback(message);
                }
            }
        });
        // Fix the subscribe method to match the expected signature
        subscriber.subscribe(channel).then(() => {
            logger.info(`Subscribed to Redis channel: ${channel}`);
        }).catch((err) => {
            logger.error(`Error subscribing to channel ${channel}`, { error: err.message });
        });
        this.subscribers[channel] = subscriber;
        return subscriber;
    }
    /**
     * Get publisher client
     * @returns Redis publisher instance
     */
    getPublisher() {
        if (!this.publisher) {
            this.publisher = new ioredis_1.default(defaultConfig);
        }
        return this.publisher;
    }
    /**
     * Publish message to a channel
     * @param channel - Channel to publish to
     * @param message - Message to publish
     * @returns Number of clients that received the message
     */
    publish(channel, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const publisher = this.getPublisher();
            const messageStr = typeof message === 'object' ? JSON.stringify(message) : message;
            try {
                const result = yield publisher.publish(channel, messageStr);
                logger.debug(`Published message to channel ${channel}`, { recipients: result });
                return result;
            }
            catch (err) {
                logger.error(`Error publishing to channel ${channel}`, { error: err.message });
                throw err;
            }
        });
    }
    /**
     * Set cache value with expiration
     * @param key - Cache key
     * @param value - Value to cache
     * @param ttlSeconds - Time to live in seconds
     * @returns Redis response
     */
    set(key_1, value_1) {
        var arguments_1 = arguments;
        return __awaiter(this, arguments, void 0, function* (key, value, ttlSeconds = 3600) {
            const client = this.getClient();
            const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
            try {
                if (ttlSeconds) {
                    if (typeof ttlSeconds === 'string' && ttlSeconds.toUpperCase() === 'EX') {
                        // Handle the case where ttlSeconds is 'EX' and the next argument is the actual TTL
                        const args = Array.from(arguments_1).slice(3);
                        return yield client.set(key, valueStr, 'EX', args[0]);
                    }
                    else if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
                        return yield client.set(key, valueStr, 'EX', ttlSeconds);
                    }
                }
                return yield client.set(key, valueStr);
            }
            catch (err) {
                logger.error(`Error setting cache key ${key}`, { error: err.message });
                throw err;
            }
        });
    }
    /**
     * Get cache value
     * @param key - Cache key
     * @returns Cached value or null
     */
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.getClient();
            try {
                const value = yield client.get(key);
                if (!value) {
                    return null;
                }
                // Try to parse as JSON, return as string if not valid JSON
                try {
                    return JSON.parse(value);
                }
                catch (e) {
                    return value;
                }
            }
            catch (err) {
                logger.error(`Error getting cache key ${key}`, { error: err.message });
                throw err;
            }
        });
    }
    /**
     * Delete cache key
     * @param key - Cache key
     * @returns Number of keys removed
     */
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.getClient();
            try {
                return yield client.del(key);
            }
            catch (err) {
                logger.error(`Error deleting cache key ${key}`, { error: err.message });
                throw err;
            }
        });
    }
    /**
     * Check if key exists
     * @param key - Cache key
     * @returns True if key exists
     */
    exists(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.getClient();
            try {
                const result = yield client.exists(key);
                return result === 1;
            }
            catch (err) {
                logger.error(`Error checking if key ${key} exists`, { error: err.message });
                throw err;
            }
        });
    }
    /**
     * Set key expiration
     * @param key - Cache key
     * @param ttlSeconds - Time to live in seconds
     * @returns 1 if successful, 0 if key doesn't exist
     */
    expire(key, ttlSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.getClient();
            try {
                return yield client.expire(key, ttlSeconds);
            }
            catch (err) {
                logger.error(`Error setting expiration for key ${key}`, { error: err.message });
                throw err;
            }
        });
    }
    /**
     * Get time to live for key
     * @param key - Cache key
     * @returns TTL in seconds, -2 if key doesn't exist, -1 if no expiration
     */
    ttl(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.getClient();
            try {
                return yield client.ttl(key);
            }
            catch (err) {
                logger.error(`Error getting TTL for key ${key}`, { error: err.message });
                throw err;
            }
        });
    }
    /**
     * Find keys matching a pattern
     * @param pattern - Key pattern (e.g., "user:*")
     * @returns Array of matching keys
     */
    keys(pattern) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.getClient();
            try {
                return yield client.keys(pattern);
            }
            catch (err) {
                logger.error(`Error finding keys matching pattern ${pattern}`, { error: err.message });
                throw err;
            }
        });
    }
    /**
     * Close all Redis connections
     */
    closeAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const closeTasks = [];
            if (this.client) {
                closeTasks.push(this.client.quit());
            }
            if (this.publisher) {
                closeTasks.push(this.publisher.quit());
            }
            Object.values(this.subscribers).forEach((subscriber) => {
                closeTasks.push(subscriber.quit());
            });
            try {
                yield Promise.all(closeTasks);
                logger.info('All Redis connections closed');
                this.client = null;
                this.publisher = null;
                this.subscribers = {};
            }
            catch (err) {
                logger.error('Error closing Redis connections', { error: err.message });
                throw err;
            }
        });
    }
}
// Export singleton instance
const redisClient = new RedisClient();
exports.default = redisClient;
