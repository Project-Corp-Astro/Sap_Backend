/**
 * Mock Database Utilities
 * Provides mock implementations for database connections when real databases are not available
 */

import { EventEmitter } from 'events';
import { createServiceLogger } from './logger';

// Initialize logger
const logger = createServiceLogger('mock-database');

/**
 * Mock MongoDB Client
 */
export class MockMongoClient extends EventEmitter {
  private connected: boolean = false;
  private db: any = {};
  private collections: Map<string, any> = new Map();

  constructor() {
    super();
    logger.info('Initializing Mock MongoDB Client');
  }

  async connect(): Promise<any> {
    this.connected = true;
    logger.info('Mock MongoDB connected');
    this.emit('connected');
    return this;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    logger.info('Mock MongoDB disconnected');
    this.emit('disconnected');
  }

  collection(name: string): any {
    if (!this.collections.has(name)) {
      this.collections.set(name, {
        name,
        documents: [],
        findOne: async () => null,
        find: () => ({ toArray: async () => [] }),
        insertOne: async (doc: any) => ({ insertedId: 'mock-id', acknowledged: true }),
        updateOne: async () => ({ modifiedCount: 1, acknowledged: true }),
        deleteOne: async () => ({ deletedCount: 1, acknowledged: true }),
        countDocuments: async () => 0
      });
    }
    return this.collections.get(name);
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Mock PostgreSQL Client
 */
export class MockPgClient extends EventEmitter {
  private connected: boolean = false;
  private tables: Map<string, any[]> = new Map();

  constructor() {
    super();
    logger.info('Initializing Mock PostgreSQL Client');
  }

  async connect(): Promise<void> {
    this.connected = true;
    logger.info('Mock PostgreSQL connected');
    this.emit('connect');
  }

  async end(): Promise<void> {
    this.connected = false;
    logger.info('Mock PostgreSQL disconnected');
    this.emit('end');
  }

  async query(text: string, params: any[] = []): Promise<any> {
    logger.debug(`Mock PostgreSQL query: ${text}`, { params });
    
    // Handle different query types
    if (text.toUpperCase().startsWith('SELECT')) {
      return {
        rows: [],
        rowCount: 0,
        command: 'SELECT',
        fields: []
      };
    } else if (text.toUpperCase().startsWith('INSERT')) {
      return {
        rows: [{ id: 'mock-id' }],
        rowCount: 1,
        command: 'INSERT',
        fields: []
      };
    } else if (text.toUpperCase().startsWith('UPDATE')) {
      return {
        rows: [],
        rowCount: 1,
        command: 'UPDATE',
        fields: []
      };
    } else if (text.toUpperCase().startsWith('DELETE')) {
      return {
        rows: [],
        rowCount: 1,
        command: 'DELETE',
        fields: []
      };
    } else {
      return {
        rows: [],
        rowCount: 0,
        command: text.split(' ')[0],
        fields: []
      };
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Mock Redis Client
 */
export class MockRedisClient extends EventEmitter {
  private connected: boolean = false;
  private store: Map<string, any> = new Map();
  private subscribers: Map<string, Function[]> = new Map();

  constructor() {
    super();
    logger.info('Initializing Mock Redis Client');
    
    // Connect automatically
    setTimeout(() => {
      this.connected = true;
      this.emit('connect');
      logger.info('Mock Redis connected');
    }, 100);
  }

  async connect(): Promise<void> {
    this.connected = true;
    logger.info('Mock Redis connected');
    this.emit('connect');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    logger.info('Mock Redis disconnected');
    this.emit('end');
  }

  async set(key: string, value: any, expiry?: string, duration?: number): Promise<string> {
    this.store.set(key, value);
    logger.debug(`Mock Redis SET ${key}`);
    return 'OK';
  }

  async get(key: string): Promise<any> {
    const value = this.store.get(key);
    logger.debug(`Mock Redis GET ${key}`);
    return value;
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key);
    this.store.delete(key);
    logger.debug(`Mock Redis DEL ${key}`);
    return existed ? 1 : 0;
  }

  async publish(channel: string, message: string): Promise<number> {
    const subscribers = this.subscribers.get(channel) || [];
    logger.debug(`Mock Redis PUBLISH ${channel}`);
    
    subscribers.forEach(callback => {
      callback(message);
    });
    
    return subscribers.length;
  }

  async subscribe(channel: string, callback: Function): Promise<void> {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, []);
    }
    
    this.subscribers.get(channel)?.push(callback);
    logger.debug(`Mock Redis SUBSCRIBE ${channel}`);
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Mock Elasticsearch Client
 */
export class MockElasticsearchClient extends EventEmitter {
  private connected: boolean = false;
  private indices: Map<string, any[]> = new Map();

  constructor() {
    super();
    logger.info('Initializing Mock Elasticsearch Client');
  }

  async ping(): Promise<any> {
    this.connected = true;
    logger.info('Mock Elasticsearch connected');
    return { statusCode: 200 };
  }

  async search(params: any): Promise<any> {
    const { index, body } = params;
    logger.debug(`Mock Elasticsearch search on index ${index}`);
    
    return {
      hits: {
        total: { value: 0 },
        hits: []
      }
    };
  }

  async index(params: any): Promise<any> {
    const { index, id, document } = params;
    logger.debug(`Mock Elasticsearch index document in ${index}`);
    
    if (!this.indices.has(index)) {
      this.indices.set(index, []);
    }
    
    this.indices.get(index)?.push({ id, ...document });
    
    return {
      result: 'created',
      _id: id
    };
  }

  async close(): Promise<void> {
    this.connected = false;
    logger.info('Mock Elasticsearch disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// Export mock clients
export const mockMongoClient = new MockMongoClient();
export const mockPgClient = new MockPgClient();
export const mockRedisClient = new MockRedisClient();
export const mockElasticsearchClient = new MockElasticsearchClient();
