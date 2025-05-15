/**
 * PostgreSQL Client Utility
 * Provides a centralized PostgreSQL client for relational data storage with proper error handling,
 * connection pooling, query optimization, and transaction management
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { createServiceLogger } from './logger';
import config from '../config/index';
import { mockPgClient } from './mock-database';

// Determine if we should use mock databases
const USE_MOCK_DATABASES = process.env.USE_MOCK_DATABASES === 'true' || process.env.NODE_ENV === 'development';

// Initialize logger
const logger = createServiceLogger('postgres-client');

// Define interfaces for PostgreSQL configuration and status tracking
interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string; // Make password optional
  max: number; // max connections
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
  rejectUnauthorized?: boolean;
}

interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
}

interface QueryStats {
  totalQueries: number;
  slowQueries: number;
  lastSlowQuery: SlowQueryInfo | null;
}

interface SlowQueryInfo {
  query: string;
  params: any[];
  executionTime: number;
  timestamp: Date;
}

interface PostgresStatus {
  isConnected: boolean;
  lastError: Error | null;
  lastConnectTime: Date | null;
  connectionStats: ConnectionStats;
  queryStats: QueryStats;
}

// Default PostgreSQL configuration
const defaultConfig: PostgresConfig = {
  host: config.get('postgres.host', 'localhost'),
  port: parseInt(config.get('postgres.port', '5432')),
  database: config.get('postgres.database', 'sap_db'),
  user: config.get('postgres.user', 'postgres'),
  password: config.get('postgres.password', '12345'),
  max: parseInt(config.get('postgres.max_connections', '20')),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

/**
 * PostgreSQL client singleton
 */
class PostgresClient {
  private pool: Pool;
  private status: PostgresStatus;
  private statsInterval?: NodeJS.Timeout;

  constructor(config: PostgresConfig = defaultConfig) {
    // Create a more resilient configuration with retries
    const resilientConfig: PostgresConfig = {
      ...config,
      // Add connection error handler to prevent app crash
      connectionTimeoutMillis: config.connectionTimeoutMillis || 5000,
      // Add a reasonable retry strategy
      max: config.max || 20
    };
    
    // If password is empty or just whitespace, remove it to allow trust authentication
    if (!config.password || config.password.trim() === '') {
      delete resilientConfig.password;
    }
    
    this.pool = new Pool(resilientConfig as any);
    
    this.status = {
      isConnected: false,
      lastError: null,
      lastConnectTime: null,
      connectionStats: {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingConnections: 0
      },
      queryStats: {
        totalQueries: 0,
        slowQueries: 0,
        lastSlowQuery: null
      }
    };

    // Set up event handlers
    this.setupEventHandlers();
    
    // Start collecting stats
    this.startCollectingStats();
    
    // Test connection immediately but don't block constructor
    this.testConnection().catch(err => {
      logger.warn('Initial PostgreSQL connection test failed', { 
        error: err.message,
        host: config.host,
        database: config.database,
        user: config.user
      });
    });
  }
  
  /**
   * Test the PostgreSQL connection
   * @returns Promise that resolves if connection is successful
   */
  private async testConnection(): Promise<void> {
    try {
      // Get a client from the pool
      const client = await this.pool.connect();
      
      // Run a simple query
      await client.query('SELECT 1');
      
      // Release the client back to the pool
      client.release();
      
      // Update status
      this.status.isConnected = true;
      this.status.lastConnectTime = new Date();
      
      logger.info('PostgreSQL connection test successful', {
        host: this.pool.options.host,
        database: this.pool.options.database,
        user: this.pool.options.user
      });
    } catch (err) {
      this.status.isConnected = false;
      this.status.lastError = err as Error;
      
      // Log error but don't crash the application
      logger.error('PostgreSQL connection test failed', { 
        error: (err as Error).message,
        host: this.pool.options.host,
        database: this.pool.options.database,
        user: this.pool.options.user
      });
    }
  }

  /**
   * Set up event handlers for the pool
   */
  private setupEventHandlers(): void {
    this.pool.on('connect', () => {
      this.status.isConnected = true;
      this.status.lastConnectTime = new Date();
      this.status.connectionStats.totalConnections++;
      logger.info('PostgreSQL client connected');
    });

    this.pool.on('error', (err: Error) => {
      this.status.isConnected = false;
      this.status.lastError = err;
      
      // Log the error but don't crash the application
      logger.error('PostgreSQL client error', { 
        error: err.message,
        code: (err as any).code,
        host: this.pool.options.host,
        database: this.pool.options.database,
        user: this.pool.options.user
      });
      
      // For authentication errors, provide more helpful message
      if ((err as any).code === '28P01' || (err as any).code === '28000') {
        logger.error('PostgreSQL authentication failed. Please check your credentials in the configuration.');
      }
    });
    
    // Handle pool removal events
    this.pool.on('remove', () => {
      logger.debug('PostgreSQL client removed from pool');
    });
  }

  /**
   * Start collecting pool stats
   */
  private startCollectingStats(): void {
    this.statsInterval = setInterval(() => {
      this.updateStats();
    }, 60000); // Update stats every minute
  }

  /**
   * Update pool stats
   */
  private async updateStats(): Promise<void> {
    try {
      const poolStats = await this.getPoolStats();
      this.status.connectionStats = {
        totalConnections: poolStats.totalCount,
        activeConnections: poolStats.activeCount,
        idleConnections: poolStats.idleCount,
        waitingConnections: poolStats.waitingCount
      };

      if (poolStats.activeCount > poolStats.totalCount * 0.8) {
        logger.warn('PostgreSQL connection pool nearing capacity', {
          active: poolStats.activeCount,
          total: poolStats.totalCount
        });
      }
    } catch (err) {
      logger.error('Error updating PostgreSQL stats', { error: (err as Error).message });
    }
  }

  /**
   * Get pool stats
   */
  private async getPoolStats(): Promise<{ totalCount: number; activeCount: number; idleCount: number; waitingCount: number }> {
    // pg-pool doesn't expose these properties directly in its type definitions
    // Using any to access internal properties or returning estimated values
    const poolAny = this.pool as any;
    return {
      totalCount: poolAny.totalCount || 0,
      activeCount: poolAny._clients?.filter((c: any) => c._connected)?.length || 0,
      idleCount: poolAny._idle?.length || 0,
      waitingCount: poolAny._pendingQueue?.length || 0
    };
  }

  /**
   * Execute a query with parameters
   * @param text - SQL query text
   * @param params - Query parameters
   * @returns Query result
   */
  async query<T = any>(text: string, params: any[] = []): Promise<T[]> {
    // Check if pool is connected before attempting query
    if (!this.status.isConnected) {
      logger.warn('Attempting to query PostgreSQL while disconnected', { query: text });
      // Try to reconnect
      try {
        await this.testConnection();
      } catch (err) {
        // If reconnection fails, log warning and continue with query attempt
        logger.warn('Failed to reconnect to PostgreSQL', { error: (err as Error).message });
      }
    }
    
    try {
      const start = Date.now();
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      this.status.queryStats.totalQueries++;
      
      // Log slow queries (over 200ms)
      if (duration > 200) {
        this.status.queryStats.slowQueries++;
        this.status.queryStats.lastSlowQuery = {
          query: text,
          params,
          executionTime: duration,
          timestamp: new Date()
        };
        
        logger.warn('Slow PostgreSQL query', { query: text, duration });
      } else {
        logger.debug('PostgreSQL query executed', { query: text, duration });
      }
      
      return result.rows;
    } catch (err) {
      // Enhance error logging with more context
      logger.error('Query error', { 
        query: text, 
        error: (err as Error).message,
        code: (err as any).code,
        detail: (err as any).detail,
        hint: (err as any).hint
      });
      
      // For authentication errors, provide more helpful message
      if ((err as any).code === '28P01' || (err as any).code === '28000') {
        logger.error('PostgreSQL authentication failed. Please check your credentials in the configuration.');
      }
      
      throw err;
    }
  }

  /**
   * Execute a single query and return the first row
   * @param text - SQL query text
   * @param params - Query parameters
   * @returns First row of query result or null if no rows
   */
  async queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get a client from the pool for transaction
   * @returns PostgreSQL client
   */
  async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      return client;
    } catch (err) {
      logger.error('Error getting PostgreSQL client', { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Execute a transaction with callback
   * @param callback - Transaction callback
   * @returns Transaction result
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('Transaction error, rolled back', { error: (err as Error).message });
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Execute multiple queries in a transaction
   * @param queries - Array of query objects with text and params
   * @returns Array of query results
   */
  async transactionQueries<T = any>(queries: { text: string; params: any[] }[]): Promise<T[][]> {
    return this.transaction(async (client) => {
      const results: T[][] = [];
      
      for (const query of queries) {
        const result = await client.query(query.text, query.params);
        results.push(result.rows as T[]);
      }
      
      return results;
    });
  }

  /**
   * Check if a table exists
   * @param tableName - Table name
   * @returns True if table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    const query = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `;
    
    const result = await this.queryOne<{ exists: boolean }>(query, [tableName]);
    return result ? result.exists : false;
  }

  /**
   * Get PostgreSQL client status
   * @returns PostgreSQL client status
   */
  getStatus(): PostgresStatus {
    return this.status;
  }

  /**
   * Close the pool
   */
  async end(): Promise<void> {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    
    try {
      await this.pool.end();
      logger.info('PostgreSQL connection pool closed');
    } catch (err) {
      logger.error('Error closing PostgreSQL connection pool', { error: (err as Error).message });
      throw err;
    }
  }
}

// Create and export a singleton instance
const pgClient = new PostgresClient();

export default pgClient;
