/**
 * Database Manager
 * Provides a centralized manager for connecting to and managing multiple databases
 * in a hybrid database architecture (MongoDB, PostgreSQL, Redis, Elasticsearch)
 */

import mongoose from 'mongoose';
import { createServiceLogger } from '../../shared/utils/logger';
import mongoDbConnection from '../../shared/utils/database';
import supabaseClient from '../../shared/utils/supabase';
import redisClient from '../../shared/utils/redis';
import esClient from '../../shared/utils/elasticsearch';
import typeORMManager from '../../shared/utils/typeorm';
import config from '../../shared/config/index';
import { mockMongoClient, mockRedisClient, mockElasticsearchClient } from '../../shared/utils/mock-database';
import { registerModels } from '../../models/mongodb';

// Determine if we should use mock databases - respect the .env setting
const USE_MOCK_DATABASES = process.env.USE_MOCK_DATABASES === 'true';
const USE_MOCK_AS_FALLBACK = process.env.USE_MOCK_AS_FALLBACK === 'true'; // Use mock databases as fallback when real ones fail

const logger = createServiceLogger('database-manager');

export class DatabaseManager {
  private mongoConnected: boolean = false;
  private supabaseConnected: boolean = false;
  private redisConnected: boolean = false;
  private esConnected: boolean = false;
  private typeORMInitialized: boolean = false;
  private useMockDatabases: boolean = USE_MOCK_DATABASES;
  
  // Track which databases are using mock implementations
  private mongoUsingMock: boolean = false;
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
    
    // Supabase connection (optional in development)
    try {
      // Connect to Supabase
      await this.connectSupabase();
    } catch (error) {
      // Supabase errors are already handled in connectSupabase method
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
    
    // Elasticsearch connection (optional) - Commented out as requested
    
    try {
      // Connect to Elasticsearch with a timeout
      const esPromise = this.connectElasticsearch();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Elasticsearch connection timeout')), 5000);
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
    
    // Skip Elasticsearch connection
    logger.info('Skipping Elasticsearch connection as requested');
    
    // TypeORM initialization (depends on Supabase)
    if (this.supabaseConnected) {
      try {
        // Initialize TypeORM
        await this.initializeTypeORM();
      } catch (error) {
        logger.error('Error initializing TypeORM', { error: (error as Error).message });
        hasErrors = true;
      }
    } else {
      logger.warn('Skipping TypeORM initialization as Supabase is not connected');
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
   * Connect to Supabase
   */
  async connectSupabase(): Promise<void> {
    try {
      if (this.supabaseConnected) {
        logger.info('Supabase already connected');
        return;
      }
      
      logger.info('Connecting to Supabase');
      
      // Test connection to Supabase
      const client = supabaseClient.getClient();
      const { error } = await client.from('connection_test').select('*').limit(1);
      
      if (error) {
        // This might be a "relation does not exist" error, which is fine
        // We're just testing if the connection works
        if (error.code === '42P01') {
          // Table doesn't exist but connection is working
          logger.info('Supabase connection_test table does not exist, but connection succeeded');
          this.supabaseConnected = true;
          return;
        }
        
        // For other errors, throw them
        throw error;
      }
      
      this.supabaseConnected = true;
      logger.info('Connected to Supabase successfully');
    } catch (error) {
      // Log the error but don't throw it - allow the application to continue
      logger.error('Error connecting to Supabase', { 
        error: (error as Error).message,
        code: (error as any).code,
        detail: (error as any).detail
      });
      
      // Set connection status to false but don't throw the error
      this.supabaseConnected = false;
      
      // Log warning that application will continue without Supabase
      logger.warn('Application will continue without Supabase connection');
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
    return {
      isConnected: this.mongoConnected,
      usingMock: this.mongoUsingMock,
      connectionState: mongoose.connection.readyState,
      details: mongoDbConnection.getStatus()
    };
  }

  /**
   * Get Supabase connection status
   */
  getSupabaseStatus(): any {
    return {
      isConnected: this.supabaseConnected,
      details: supabaseClient.getStatus()
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
      supabase: this.getSupabaseStatus(),
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
        try {
          if (this.mongoUsingMock) {
            // await mockMongoClient.close();
            logger.info('Skipping close for mock MongoDB client');
          } else {
            await mongoose.disconnect();
          }
          logger.info('MongoDB connection closed');
        } catch (error) {
          logger.error('Error closing MongoDB connection', { error: (error as Error).message });
        }
      }
      
      // Close Supabase (cleanup resources)
      if (this.supabaseConnected) {
        try {
          await supabaseClient.close();
          logger.info('Supabase resources cleaned up');
        } catch (error) {
          logger.error('Error cleaning up Supabase resources', { error: (error as Error).message });
        }
      }
      
      // Close Redis
      if (this.redisConnected) {
        try {
          if (this.redisUsingMock) {
            // await mockRedisClient.quit();
            logger.info('Skipping close for mock Redis client');
          } else {
            await redisClient.closeAll();
          }
          logger.info('Redis connection closed');
        } catch (error) {
          logger.error('Error closing Redis connection', { error: (error as Error).message });
        }
      }
      
      // Close Elasticsearch
      if (this.esConnected) {
        try {
          if (this.esUsingMock) {
            await mockElasticsearchClient.close();
          } else {
            await esClient.close();
          }
          logger.info('Elasticsearch connection closed');
        } catch (error) {
          logger.error('Error closing Elasticsearch connection', { error: (error as Error).message });
        }
      }
      
      // Close TypeORM
      if (this.typeORMInitialized) {
        try {
          await typeORMManager.close();
          logger.info('TypeORM connection closed');
        } catch (error) {
          logger.error('Error closing TypeORM connection', { error: (error as Error).message });
        }
      }
      
      logger.info('All database connections closed');
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
    logger.info(`Received ${signal} signal, closing database connections gracefully`);
    try {
      await this.closeAll();
    } catch (error) {
      logger.error('Error during graceful shutdown', { error: (error as Error).message });
      throw error;
    }
  }
}

// Create and export a singleton instance
const dbManager = new DatabaseManager();
export default dbManager;
