"use strict";
/**
 * Mock Database Utilities
 * Provides mock implementations for database connections when real databases are not available
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockElasticsearchClient = exports.mockRedisClient = exports.mockPgClient = exports.mockMongoClient = exports.MockElasticsearchClient = exports.MockRedisClient = exports.MockPgClient = exports.MockMongoClient = void 0;
const events_1 = require("events");
const logger_1 = require("./logger");
// Initialize logger
const logger = (0, logger_1.createServiceLogger)('mock-database');
/**
 * Mock MongoDB Client
 */
class MockMongoClient extends events_1.EventEmitter {
    constructor() {
        super();
        this.connected = false;
        this.db = {};
        this.collections = new Map();
        logger.info('Initializing Mock MongoDB Client');
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connected = true;
            logger.info('Mock MongoDB connected');
            this.emit('connected');
            return this;
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connected = false;
            logger.info('Mock MongoDB disconnected');
            this.emit('disconnected');
        });
    }
    collection(name) {
        if (!this.collections.has(name)) {
            this.collections.set(name, {
                name,
                documents: [],
                findOne: () => __awaiter(this, void 0, void 0, function* () { return null; }),
                find: () => ({ toArray: () => __awaiter(this, void 0, void 0, function* () { return []; }) }),
                insertOne: (doc) => __awaiter(this, void 0, void 0, function* () { return ({ insertedId: 'mock-id', acknowledged: true }); }),
                updateOne: () => __awaiter(this, void 0, void 0, function* () { return ({ modifiedCount: 1, acknowledged: true }); }),
                deleteOne: () => __awaiter(this, void 0, void 0, function* () { return ({ deletedCount: 1, acknowledged: true }); }),
                countDocuments: () => __awaiter(this, void 0, void 0, function* () { return 0; })
            });
        }
        return this.collections.get(name);
    }
    isConnected() {
        return this.connected;
    }
}
exports.MockMongoClient = MockMongoClient;
/**
 * Mock PostgreSQL Client
 */
class MockPgClient extends events_1.EventEmitter {
    constructor() {
        super();
        this.connected = false;
        this.tables = new Map();
        logger.info('Initializing Mock PostgreSQL Client');
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connected = true;
            logger.info('Mock PostgreSQL connected');
            this.emit('connect');
        });
    }
    end() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connected = false;
            logger.info('Mock PostgreSQL disconnected');
            this.emit('end');
        });
    }
    query(text_1) {
        return __awaiter(this, arguments, void 0, function* (text, params = []) {
            logger.debug(`Mock PostgreSQL query: ${text}`, { params });
            // Handle different query types
            if (text.toUpperCase().startsWith('SELECT')) {
                return {
                    rows: [],
                    rowCount: 0,
                    command: 'SELECT',
                    fields: []
                };
            }
            else if (text.toUpperCase().startsWith('INSERT')) {
                return {
                    rows: [{ id: 'mock-id' }],
                    rowCount: 1,
                    command: 'INSERT',
                    fields: []
                };
            }
            else if (text.toUpperCase().startsWith('UPDATE')) {
                return {
                    rows: [],
                    rowCount: 1,
                    command: 'UPDATE',
                    fields: []
                };
            }
            else if (text.toUpperCase().startsWith('DELETE')) {
                return {
                    rows: [],
                    rowCount: 1,
                    command: 'DELETE',
                    fields: []
                };
            }
            else {
                return {
                    rows: [],
                    rowCount: 0,
                    command: text.split(' ')[0],
                    fields: []
                };
            }
        });
    }
    isConnected() {
        return this.connected;
    }
}
exports.MockPgClient = MockPgClient;
/**
 * Mock Redis Client
 */
class MockRedisClient extends events_1.EventEmitter {
    constructor() {
        super();
        this.connected = false;
        this.store = new Map();
        this.subscribers = new Map();
        logger.info('Initializing Mock Redis Client');
        // Connect automatically
        setTimeout(() => {
            this.connected = true;
            this.emit('connect');
            logger.info('Mock Redis connected');
        }, 100);
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connected = true;
            logger.info('Mock Redis connected');
            this.emit('connect');
        });
    }
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connected = false;
            logger.info('Mock Redis disconnected');
            this.emit('end');
        });
    }
    set(key, value, expiry, duration) {
        return __awaiter(this, void 0, void 0, function* () {
            this.store.set(key, value);
            logger.debug(`Mock Redis SET ${key}`);
            return 'OK';
        });
    }
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const value = this.store.get(key);
            logger.debug(`Mock Redis GET ${key}`);
            return value;
        });
    }
    del(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const existed = this.store.has(key);
            this.store.delete(key);
            logger.debug(`Mock Redis DEL ${key}`);
            return existed ? 1 : 0;
        });
    }
    publish(channel, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const subscribers = this.subscribers.get(channel) || [];
            logger.debug(`Mock Redis PUBLISH ${channel}`);
            subscribers.forEach(callback => {
                callback(message);
            });
            return subscribers.length;
        });
    }
    subscribe(channel, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!this.subscribers.has(channel)) {
                this.subscribers.set(channel, []);
            }
            (_a = this.subscribers.get(channel)) === null || _a === void 0 ? void 0 : _a.push(callback);
            logger.debug(`Mock Redis SUBSCRIBE ${channel}`);
        });
    }
    ping() {
        return __awaiter(this, void 0, void 0, function* () {
            return 'PONG';
        });
    }
    isConnected() {
        return this.connected;
    }
}
exports.MockRedisClient = MockRedisClient;
/**
 * Mock Elasticsearch Client
 */
class MockElasticsearchClient extends events_1.EventEmitter {
    constructor() {
        super();
        this.connected = false;
        this.indices = new Map();
        logger.info('Initializing Mock Elasticsearch Client');
    }
    ping() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connected = true;
            logger.info('Mock Elasticsearch connected');
            return { statusCode: 200 };
        });
    }
    search(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { index, body } = params;
            logger.debug(`Mock Elasticsearch search on index ${index}`);
            return {
                hits: {
                    total: { value: 0 },
                    hits: []
                }
            };
        });
    }
    index(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { index, id, document } = params;
            logger.debug(`Mock Elasticsearch index document in ${index}`);
            if (!this.indices.has(index)) {
                this.indices.set(index, []);
            }
            (_a = this.indices.get(index)) === null || _a === void 0 ? void 0 : _a.push(Object.assign({ id }, document));
            return {
                result: 'created',
                _id: id
            };
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.connected = false;
            logger.info('Mock Elasticsearch disconnected');
        });
    }
    isConnected() {
        return this.connected;
    }
}
exports.MockElasticsearchClient = MockElasticsearchClient;
// Export mock clients
exports.mockMongoClient = new MockMongoClient();
exports.mockPgClient = new MockPgClient();
exports.mockRedisClient = new MockRedisClient();
exports.mockElasticsearchClient = new MockElasticsearchClient();
