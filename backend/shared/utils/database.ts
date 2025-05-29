/**
 * Enhanced Database Connection Utility
 * Provides a centralized database connection manager with proper error handling,
 * connection pooling, query optimization, and index management
 */

import mongoose, { Connection, Model, Schema } from 'mongoose';
import { createServiceLogger } from './logger';
import config from '../config/index';
import { AppError, ErrorTypes } from './errorHandler';

// Initialize logger
const logger = createServiceLogger('database');

// Define interfaces for database status tracking
interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  availableConnections: number;
}

interface QueryStats {
  totalQueries: number;
  slowQueries: number;
  lastSlowQuery: SlowQueryInfo | null;
}

interface SlowQueryInfo {
  query: any;
  collection: string;
  executionTime: number;
  timestamp: Date;
}

interface DatabaseStatus {
  isConnected: boolean;
  lastError: Error | null;
  lastConnectTime: Date | null;
  reconnectAttempts: number;
  connectionStats: ConnectionStats;
  queryStats: QueryStats;
}

interface IndexInfo {
  name: string;
  fields: Record<string, any>;
  options: Record<string, any>;
}

// Default MongoDB connection options
interface ExtendedConnectOptions {
  useNewUrlParser?: boolean;
  useUnifiedTopology?: boolean;
  connectTimeoutMS?: number;
  socketTimeoutMS?: number;
  serverSelectionTimeoutMS?: number;
  heartbeatFrequencyMS?: number;
  retryWrites?: boolean;
  w?: string;
  maxPoolSize?: number;
  minPoolSize?: number;
  autoIndex?: boolean;
  serverApi?: { version: string; strict: boolean; deprecationErrors: boolean };
}

const defaultOptions: ExtendedConnectOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 10000, // 10 seconds
  socketTimeoutMS: 45000, // 45 seconds
  serverSelectionTimeoutMS: 5000, // 5 seconds
  heartbeatFrequencyMS: 10000, // 10 seconds
  retryWrites: true,
  w: 'majority',
  maxPoolSize: 20, // Increased pool size for better concurrency
  minPoolSize: 5,  // Increased min pool for faster response times
  autoIndex: process.env.NODE_ENV !== 'production', // Disable auto-indexing in production
  serverApi: { version: '1', strict: true, deprecationErrors: true } // Use latest MongoDB server API
};

/**
 * Database connection manager
 */
class DatabaseConnection {
  private connection: typeof mongoose | null;
  private models: Map<string, Model<any>>;
  private indexes: Map<string, IndexInfo[]>;
  private status: DatabaseStatus;
  private connectionStatsInterval?: NodeJS.Timeout;
  private connections: Map<string, Connection>;

  constructor() {
    this.connection = null;
    this.models = new Map();
    this.indexes = new Map();
    this.connections = new Map();
    this.status = {
      isConnected: false,
      lastError: null,
      lastConnectTime: null,
      reconnectAttempts: 0,
      connectionStats: {
        totalConnections: 0,
        activeConnections: 0,
        availableConnections: 0
      },
      queryStats: {
        totalQueries: 0,
        slowQueries: 0,
        lastSlowQuery: null
      }
    };
    
    // Set up query monitoring
    this.setupQueryMonitoring();
  }

  /**
   * Connect to MongoDB
   * @param uri - MongoDB connection URI
   * @param options - MongoDB connection options
   * @returns Mongoose connection
   */
  async connect(uri?: string, options: ExtendedConnectOptions = {}): Promise<typeof mongoose> {
    try {
      if (this.connection && mongoose.connection.readyState === 1) {
        logger.info('Using existing database connection');
        return this.connection;
      }

      const connectionOptions = { ...defaultOptions, ...options };
      const connectionUri = uri || config.get('mongo.uri', 'mongodb://localhost:27017/sap-db');

      // Set up global mongoose configuration
      mongoose.set('strictQuery', true);
      
      // Enable debug mode in development
      if (process.env.NODE_ENV === 'development') {
        mongoose.set('debug', (collectionName: string, method: string, query: any, doc: any) => {
          logger.debug(`Mongoose: ${collectionName}.${method}`, { query, doc });
        });
      }

      // Force IPv4 by setting the family option
      const ipv4Options = {
        ...connectionOptions,
        family: 4, // Force IPv4
        serverSelectionTimeoutMS: 5000 // Reduce timeout for faster failure
      };
      
      // Connect to MongoDB
      // Ensure we don't use serverApi to avoid serverStatus command issues
      const finalOptions = { ...ipv4Options };
      if (finalOptions.serverApi) {
        delete finalOptions.serverApi;
      }
      
      this.connection = await mongoose.connect(connectionUri, finalOptions as any);

      // Update status
      this.status.isConnected = true;
      this.status.lastError = null;
      this.status.lastConnectTime = new Date();
      this.status.reconnectAttempts = 0;

      // Update connection stats
      this.updateConnectionStats();

      logger.info('Connected to MongoDB', { 
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      });

      // Set up connection event handlers
      mongoose.connection.on('error', this.handleConnectionError.bind(this));
      mongoose.connection.on('disconnected', this.handleDisconnect.bind(this));
      mongoose.connection.on('reconnected', this.handleReconnect.bind(this));
      mongoose.connection.on('reconnectFailed', this.handleReconnectFailed.bind(this));
      mongoose.connection.on('close', this.handleClose.bind(this));

      // Set up periodic connection stats update
      this.connectionStatsInterval = setInterval(() => {
        this.updateConnectionStats();
      }, 60000); // Update every minute

      return this.connection;
    } catch (err: any) {
      this.status.isConnected = false;
      this.status.lastError = err;
      this.status.reconnectAttempts += 1;

      logger.error('MongoDB connection error', { error: err.message, stack: err.stack });
      throw new AppError(ErrorTypes.INTERNAL_ERROR, `Failed to connect to MongoDB: ${err.message}`);
    }
  }

  /**
   * Set up query monitoring
   */
  private setupQueryMonitoring(): void {
    // Monitor query execution time
    mongoose.plugin((schema: Schema) => {
      // Add pre-find hook
      schema.pre(/^find/, function(this: any) {
        this._startTime = Date.now();
        this.status.queryStats.totalQueries++;
      });

      // Add post-find hook
      schema.post(/^find/, function(this: any) {
        const executionTime = Date.now() - this._startTime;
        
        // Log slow queries (> 100ms)
        if (executionTime > 100) {
          this.status.queryStats.slowQueries++;
          this.status.queryStats.lastSlowQuery = {
            query: this.getQuery(),
            collection: this.model.collection.name,
            executionTime,
            timestamp: new Date()
          };
          
          logger.warn('Slow query detected', {
            query: this.getQuery(),
            collection: this.model.collection.name,
            executionTime,
            options: this.getOptions()
          });
        }
      });
    });
  }

  /**
   * Update connection stats
   */
  private updateConnectionStats(): void {
    if (!mongoose.connection.db) return;

    // Use a promise-based approach for server status
    mongoose.connection.db.admin().serverStatus().then((status: any) => {
      if (status && status.connections) {
        this.status.connectionStats = {
          totalConnections: status.connections.totalCreated || 0,
          activeConnections: status.connections.current || 0,
          availableConnections: status.connections.available || 0
        };
      }
    }).catch((err: Error) => {
      logger.error('Error getting server status', { error: err.message });
    });

  }

  /**
   * Handle connection error
   * @param err - Connection error
   */
  private handleConnectionError(err: Error): void {
    this.status.isConnected = false;
    this.status.lastError = err;

    logger.error('MongoDB connection error', { error: err.message });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.status.isConnected = false;
    logger.warn('MongoDB disconnected');
  }

  /**
   * Handle reconnection
   */
  private handleReconnect(): void {
    this.status.isConnected = true;
    this.status.lastError = null;
    this.status.lastConnectTime = new Date();
    this.status.reconnectAttempts = 0;

    logger.info('MongoDB reconnected');
  }

  /**
   * Handle reconnection failure
   */
  private handleReconnectFailed(): void {
    logger.error('MongoDB reconnect failed after multiple attempts');
  }

  /**
   * Handle connection close
   */
  private handleClose(): void {
    this.status.isConnected = false;
    
    // Clear connection stats interval
    if (this.connectionStatsInterval) {
      clearInterval(this.connectionStatsInterval);
    }
    
    logger.info('MongoDB connection closed');
  }

  /**
   * Register a model
   * @param name - Model name
   * @param schema - Mongoose schema
   * @returns Mongoose model
   */
  registerModel<T>(name: string, schema: Schema): Model<T> {
    try {
      // Check if model already exists
      if (this.models.has(name)) {
        return this.models.get(name) as Model<T>;
      }
      
      // Add timestamps to schema
      schema.set('timestamps', true);
      
      // Add optimistic concurrency control
      schema.add({ __v: { type: Number, default: 0 } });
      
      // Create model
      const model = mongoose.model<T>(name, schema);
      
      // Store model
      this.models.set(name, model);
      
      logger.info(`Registered model: ${name}`);
      return model;
    } catch (err: any) {
      logger.error(`Error registering model: ${name}`, { error: err.message });
      throw new AppError(ErrorTypes.INTERNAL_ERROR, `Failed to register model: ${err.message}`);
    }
  }

  /**
   * Get a registered model
   * @param name - Model name
   * @returns Mongoose model
   */
  getModel<T>(name: string): Model<T> {
    if (!this.models.has(name)) {
      throw new AppError(ErrorTypes.NOT_FOUND_ERROR, `Model not found: ${name}`);
    }
    
    return this.models.get(name) as Model<T>;
  }

  /**
   * Create index
   * @param modelName - Model name
   * @param fields - Index fields
   * @param options - Index options
   * @returns Index name
   */
  async createIndex(
    modelName: string, 
    fields: Record<string, any>, 
    options: Record<string, any> = {}
  ): Promise<string> {
    try {
      // Get model
      const model = this.getModel(modelName);
      
      // Create index
      const indexName = await model.collection.createIndex(fields, options);
      
      // Store index
      if (!this.indexes.has(modelName)) {
        this.indexes.set(modelName, []);
      }
      
      const indexList = this.indexes.get(modelName) || [];
      indexList.push({
        name: indexName,
        fields,
        options
      });
      
      logger.info(`Created index ${indexName} on ${modelName}`, { fields, options });
      return indexName;
    } catch (err: any) {
      logger.error(`Error creating index on ${modelName}`, { error: err.message, fields });
      throw new AppError(ErrorTypes.INTERNAL_ERROR, `Failed to create index: ${err.message}`);
    }
  }

  /**
   * Drop index
   * @param modelName - Model name
   * @param indexName - Index name
   * @returns True if successful
   */
  async dropIndex(modelName: string, indexName: string): Promise<boolean> {
    try {
      // Get model
      const model = this.getModel(modelName);
      
      // Drop index
      await model.collection.dropIndex(indexName);
      
      // Remove from indexes map
      if (this.indexes.has(modelName)) {
        const indexes = this.indexes.get(modelName) || [];
        const indexIndex = indexes.findIndex(index => index.name === indexName);
        
        if (indexIndex !== -1) {
          indexes.splice(indexIndex, 1);
        }
      }
      
      logger.info(`Dropped index ${indexName} from ${modelName}`);
      return true;
    } catch (err: any) {
      logger.error(`Error dropping index: ${indexName}`, { error: err.message });
      return false;
    }
  }

  /**
   * Disconnect from a specific database
   * @param connectionName - Name of the connection to disconnect
   * @returns True if successfully disconnected
   */
  async disconnect(connectionName: string = 'default'): Promise<boolean> {
    try {
      const connection = this.connections.get(connectionName);
      if (!connection) {
        logger.warn(`No connection found with name: ${connectionName}`);
        return false;
      }
      
      await connection.close();
      this.connections.delete(connectionName);
      
      logger.info(`Disconnected from MongoDB: ${connectionName}`);
      return true;
    } catch (err: any) {
      logger.error(`Error disconnecting from MongoDB: ${connectionName}`, { error: err.message });
      return false;
    }
  }

  /**
   * Gracefully shutdown all database connections
   * @param signal - Signal that triggered the shutdown
   */
  async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`${signal} signal received: closing MongoDB connections`);
    
    // Close all connections
    const promises: Promise<boolean>[] = [];
    for (const connectionName of this.connections.keys()) {
      promises.push(this.disconnect(connectionName));
    }
    
    try {
      await Promise.all(promises);
      logger.info('All MongoDB connections closed successfully');
    } catch (err: any) {
      logger.error('Error closing MongoDB connections', { error: err.message });
    }
    
    // If this was called as part of a process termination, exit after cleanup
    if (['SIGINT', 'SIGTERM'].includes(signal)) {
      process.exit(0);
    }
  }

  /**
   * Get a database connection
   * @param connectionName - Connection name
   * @returns Mongoose connection or null if not connected
   */
  getConnection(connectionName: string = 'default'): Connection | null {
    return this.connections.get(connectionName) || null;
  }

  /**
   * Check if connected to database
   * @param connectionName - Connection name
   * @returns True if connected
   */
  isConnectedTo(connectionName: string = 'default'): boolean {
    const connection = this.getConnection(connectionName);
    return connection ? connection.readyState === 1 : false;
  }

  /**
   * Get connection status
   * @returns Connection status for all connections
   */
  getStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    try {
      // Avoid using serverStatus command which requires API Version 1
      for (const [name, connection] of this.connections.entries()) {
        status[name] = {
          readyState: connection.readyState,
          connected: connection.readyState === 1,
          host: connection.host,
          port: connection.port,
          name: connection.name,
        };
      }
    } catch (error) {
      logger.error('Error getting server status', { error });
    }
    
    return status;
  }
}

// Create and export a singleton instance
const dbConnection = new DatabaseConnection();

export default dbConnection;
