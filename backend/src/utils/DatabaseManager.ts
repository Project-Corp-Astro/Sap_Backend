/**
 * Database Manager
 * Provides a centralized manager for connecting to and managing multiple databases
 * in a hybrid database architecture (MongoDB, PostgreSQL, Redis, Elasticsearch)
 */

import mongoose from 'mongoose';
import { createServiceLogger } from '../../shared/utils/logger';
import mongoDbConnection from '../../shared/utils/database';
import pgClient from '../../shared/utils/postgres';
import redisClient from '../../shared/utils/redis';
import esClient from '../../shared/utils/elasticsearch';
import typeORMManager from '../../shared/utils/typeorm';
import config from '../../shared/config/index';
import { mockMongoClient, mockPgClient, mockRedisClient, mockElasticsearchClient } from '../../shared/utils/mock-database';
import { registerModels } from '../../models/mongodb';

// Determine if we should use mock databases - respect the .env setting
const USE_MOCK_DATABASES = process.env.USE_MOCK_DATABASES === 'true';
const USE_MOCK_AS_FALLBACK = process.env.USE_MOCK_AS_FALLBACK === 'true'; // Use mock databases as fallback when real ones fail

const logger = createServiceLogger('database-manager');

export class DatabaseManager {
  private mongoConnected: boolean = false;
  private pgConnected: boolean = false;
  private redisConnected: boolean = false;
  private esConnected: boolean = false;
  private typeORMInitialized: boolean = false;
  private useMockDatabases: boolean = USE_MOCK_DATABASES;
  
  // Track which databases are using mock implementations
  private mongoUsingMock: boolean = false;
  private pgUsingMock: boolean = false;
  private redisUsingMock: boolean = false;
  private esUsingMock: boolean = false;

  /**
   * Initialize all database connections
   */
  async initializeAll(): Promise<void> {
    let hasErrors = false;
    logger.info('Initializing all database connections');
    
    // MongoDB connection (required)
    try {
      // Connect to MongoDB
      await this.connectMongo();
    } catch (error) {
      logger.error('Error connecting to MongoDB', { error: (error as Error).message });
      hasErrors = true;
      // In development, we'll continue without MongoDB
      logger.warn('Application will continue without MongoDB connection');
    }
    
    // PostgreSQL connection (optional in development)
    try {
      // Connect to PostgreSQL
      await this.connectPostgres();
    } catch (error) {
      // PostgreSQL errors are already handled in connectPostgres method
      hasErrors = true;
      // Continue with other connections
    }
    
    // Redis connection (optional)
    try {
      // Connect to Redis with a timeout to prevent hanging
      const redisPromise = this.connectRedis();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
      });
      
      await Promise.race([redisPromise, timeoutPromise]).catch(error => {
        logger.error('Error connecting to Redis', { error: error.message });
        logger.warn('Application will continue without Redis connection');
        hasErrors = true;
      });
    } catch (error) {
      logger.error('Error connecting to Redis', { error: (error as Error).message });
      logger.warn('Application will continue without Redis connection');
      hasErrors = true;
    }
    
    // Elasticsearch connection (optional)
    try {
      // Connect to Elasticsearch with a timeout
      const esPromise = this.connectElasticsearch();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Elasticsearch connection timeout')), 10000);
      });
      
      await Promise.race([esPromise, timeoutPromise]).catch(error => {
        logger.error('Error connecting to Elasticsearch', { error: error.message });
        logger.warn('Continuing without Elasticsearch');
        hasErrors = true;
      });
    } catch (error) {
      logger.error('Error connecting to Elasticsearch', { error: (error as Error).message });
      logger.warn('Continuing without Elasticsearch');
      hasErrors = true;
    }
    
    // TypeORM initialization (depends on PostgreSQL)
    if (this.pgConnected) {
      try {
        // Initialize TypeORM
        await this.initializeTypeORM();
      } catch (error) {
        logger.error('Error initializing TypeORM', { error: (error as Error).message });
        hasErrors = true;
      }
    } else {
      logger.warn('Skipping TypeORM initialization as PostgreSQL is not connected');
      hasErrors = true;
    }
    
    if (hasErrors) {
      logger.warn('Some database connections failed to initialize. Application will continue with limited functionality.');
    } else {
      logger.info('All database connections initialized successfully');
    }
  }

  /**
   * Connect to MongoDB
   */
  async connectMongo(): Promise<void> {
    try {
      if (this.mongoConnected) {
        logger.info('MongoDB already connected');
        return;
      }
      
      logger.info('Connecting to MongoDB');
      await mongoDbConnection.connect();
      
      // Register MongoDB models
      try {
        registerModels();
        logger.info('MongoDB models registered successfully');
      } catch (modelError) {
        logger.error('Error registering MongoDB models', { error: (modelError as Error).message });
        // Continue even if model registration fails - this allows the app to start
        // and we can fix model issues later
      }
      
      this.mongoConnected = true;
      logger.info('Connected to MongoDB successfully');
    } catch (error) {
      logger.error('Error connecting to MongoDB', { error: (error as Error).message });
      
      if (this.useMockDatabases) {
        logger.warn('Using mock MongoDB implementation');
        try {
          await mockMongoClient.connect();
          this.mongoConnected = true;
          this.mongoUsingMock = true;
          return;
        } catch (mockError) {
          logger.error('Error connecting to mock MongoDB', { error: (mockError as Error).message });
        }
      }
      
      logger.warn('Application will continue without MongoDB connection');
      throw error;
    }
  }

  /**
   * Connect to PostgreSQL
   */
  async connectPostgres(): Promise<void> {
    try {
      if (this.pgConnected) {
        logger.info('PostgreSQL already connected');
        return;
      }
      
      logger.info('Connecting to PostgreSQL');
      
      // Test connection by executing a simple query
      await pgClient.query('SELECT NOW()');
      this.pgConnected = true;
      
      logger.info('Connected to PostgreSQL successfully');
    } catch (error) {
      // Log the error but don't throw it - allow the application to continue
      logger.error('Error connecting to PostgreSQL', { 
        error: (error as Error).message,
        code: (error as any).code,
        detail: (error as any).detail
      });
      
      // For authentication errors, provide more helpful message
      if ((error as any).code === '28P01' || (error as any).code === '28000') {
        logger.error('PostgreSQL authentication failed. Please check your credentials in the configuration.');
      }
      
      if (this.useMockDatabases) {
        logger.warn('Using mock PostgreSQL implementation');
        try {
          await mockPgClient.connect();
          this.pgConnected = true;
          this.pgUsingMock = true;
          return;
        } catch (mockError) {
          logger.error('Error connecting to mock PostgreSQL', { error: (mockError as Error).message });
        }
      }
      
      // Set connection status to false but don't throw the error
      this.pgConnected = false;
      
      // Log warning that application will continue without PostgreSQL
      logger.warn('Application will continue without PostgreSQL connection');
    }
  }

  /**
   * Connect to Redis
   */
  async connectRedis(): Promise<void> {
    try {
      if (this.redisConnected) {
        logger.info('Redis already connected');
        return;
      }
      
      logger.info('Connecting to Redis');
      
      // Initialize Redis client
      redisClient.initialize();
      
      // Test connection
      const client = redisClient.getClient();
      await client.ping();
      
      this.redisConnected = true;
      logger.info('Connected to Redis successfully');
    } catch (error) {
      logger.error('Error connecting to Redis', { error: (error as Error).message });
      
      if (this.useMockDatabases) {
        logger.warn('Using mock Redis implementation');
        try {
          await mockRedisClient.connect();
          this.redisConnected = true;
          this.redisUsingMock = true;
          return;
        } catch (mockError) {
          logger.error('Error connecting to mock Redis', { error: (mockError as Error).message });
        }
      }
      
      throw error;
    }
  }

  /**
   * Connect to Elasticsearch
   */
  async connectElasticsearch(): Promise<void> {
    try {
      if (this.esConnected) {
        logger.info('Elasticsearch already connected');
        return;
      }
      
      logger.info('Connecting to Elasticsearch');
      
      // Get credentials directly from environment variables
      const username = process.env.ELASTICSEARCH_USERNAME;
      const password = process.env.ELASTICSEARCH_PASSWORD;
      const node = process.env.ELASTICSEARCH_NODE || 'http://127.0.0.1:9200';
      
      // Log connection attempt (without exposing credentials)
      logger.info('Elasticsearch connection details', {
        node,
        auth: username && password ? 'provided' : 'not provided'
      });
      
      // Force a connection check to make sure we're connected to the real instance
      await esClient.checkConnection();
      
      // Check connection status after the check
      const status = esClient.getStatus();
      
      if (!status.isConnected) {
        throw new Error('Elasticsearch connection failed');
      }
      
      this.esConnected = true;
      logger.info('Connected to Elasticsearch successfully');
    } catch (error) {
      logger.error('Error connecting to Elasticsearch', { error: (error as Error).message });
      
      if (this.useMockDatabases) {
        logger.warn('Using mock Elasticsearch implementation');
        try {
          await mockElasticsearchClient.ping();
          this.esConnected = true;
          this.esUsingMock = true;
          return;
        } catch (mockError) {
          logger.error('Error connecting to mock Elasticsearch', { error: (mockError as Error).message });
        }
      }
      
      // Don't throw error for Elasticsearch, as it's optional
      logger.warn('Continuing without Elasticsearch');
    }
  }

  /**
   * Initialize TypeORM
   */
  async initializeTypeORM(): Promise<void> {
    try {
      if (this.typeORMInitialized) {
        logger.info('TypeORM already initialized');
        return;
      }
      
      logger.info('Initializing TypeORM');
      
      await typeORMManager.initialize();
      this.typeORMInitialized = true;
      
      logger.info('TypeORM initialized successfully');
    } catch (error) {
      logger.error('Error initializing TypeORM', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get MongoDB connection status
   */
  getMongoStatus(): any {
    try {
      return {
        isConnected: this.mongoConnected,
        usingMock: this.mongoUsingMock,
        connectionState: mongoose.connection.readyState,
        // Avoid using detailed status that might trigger serverStatus command
        details: {
          readyState: mongoose.connection.readyState,
          connected: mongoose.connection.readyState === 1,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name
        }
      };
    } catch (error) {
      logger.error('Error getting MongoDB status', { error: (error as Error).message });
      return {
        isConnected: this.mongoConnected,
        usingMock: this.mongoUsingMock,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get PostgreSQL connection status
   */
  getPgStatus(): any {
    return {
      isConnected: this.pgConnected,
      usingMock: this.pgUsingMock,
      details: pgClient.getStatus()
    };
  }

  /**
   * Get Redis connection status
   */
  getRedisStatus(): any {
    return {
      isConnected: this.redisConnected,
      usingMock: this.redisUsingMock
    };
  }

  /**
   * Get Elasticsearch connection status
   */
  getEsStatus(): any {
    return {
      isConnected: this.esConnected,
      usingMock: this.esUsingMock,
      details: esClient.getStatus()
    };
  }

  /**
   * Get TypeORM status
   */
  getTypeORMStatus(): boolean {
    return this.typeORMInitialized;
  }

  /**
   * Get all database statuses
   */
  getAllStatuses(): any {
    return {
      mongo: this.getMongoStatus(),
      postgres: this.getPgStatus(),
      redis: this.getRedisStatus(),
      elasticsearch: this.getEsStatus(),
      typeorm: this.getTypeORMStatus()
    };
  }

  /**
   * Close all database connections
   */
  async closeAll(): Promise<void> {
    try {
      logger.info('Closing all database connections');
      
      // Close MongoDB
      if (this.mongoConnected) {
        await mongoose.disconnect();
        this.mongoConnected = false;
        logger.info('MongoDB connection closed');
      }
      
      // Close PostgreSQL
      if (this.pgConnected) {
        await pgClient.end();
        this.pgConnected = false;
        logger.info('PostgreSQL connection closed');
      }
      
      // Close Redis
      if (this.redisConnected) {
        await redisClient.closeAll();
        this.redisConnected = false;
        logger.info('Redis connection closed');
      }
      
      // Close Elasticsearch
      if (this.esConnected) {
        await esClient.close();
        this.esConnected = false;
        logger.info('Elasticsearch connection closed');
      }
      
      // Close TypeORM
      if (this.typeORMInitialized) {
        await typeORMManager.close();
        this.typeORMInitialized = false;
        logger.info('TypeORM connection closed');
      }
      
      logger.info('All database connections closed successfully');
    } catch (error) {
      logger.error('Error closing database connections', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Handle graceful shutdown
   * @param signal - Signal that triggered the shutdown
   */
  async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`${signal} signal received: closing database connections`);
    
    try {
      await this.closeAll();
      logger.info('Database connections closed gracefully');
    } catch (error) {
      logger.error('Error during graceful shutdown', { error: (error as Error).message });
    }
  }
}

// Create and export a singleton instance
const dbManager = new DatabaseManager();
export default dbManager;
