/**
 * Supabase Client Utility
 * Provides a centralized Supabase client for relational data storage with proper error handling,
 * connection management, and query optimization
 */

import { createClient, SupabaseClient, PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js';
import { createServiceLogger } from './logger';
import config from '../config/index';

// Initialize logger
const logger = createServiceLogger('supabase-client');

// Define interfaces for Supabase configuration and status tracking
interface SupabaseConfig {
  url: string;
  key: string;
  options?: {
    auth?: {
      autoRefreshToken: boolean;
      persistSession: boolean;
      detectSessionInUrl: boolean;
    };
    db?: {
      schema: string;
    };
    global?: {
      headers: Record<string, string>;
    };
  };
}

interface QueryStats {
  totalQueries: number;
  slowQueries: number;
  lastSlowQuery: SlowQueryInfo | null;
}

interface SlowQueryInfo {
  query: string;
  params?: any;
  executionTime: number;
  timestamp: Date;
}

interface SupabaseStatus {
  isConnected: boolean;
  lastError: Error | null;
  lastConnectTime: Date | null;
  queryStats: QueryStats;
}

// Default Supabase configuration
const defaultConfig: SupabaseConfig = {
  url: config.get('supabase.url', 'https://leaekgpafpvrvykeuvgk.supabase.co'),
  key: config.get('supabase.key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlYWVrZ3BhZnB2cnZ5a2V1dmdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0MTY2NTYsImV4cCI6MjA2Mzk5MjY1Nn0.Nqu17MkDMwwXr4iodYBP0YGbKEp-FBg3Nr2xGtFT41Y'),
  options: {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: { 'x-application-name': 'sap-backend' },
    },
  }
};

/**
 * Supabase client singleton
 */
class SupabaseClientManager {
  private client: SupabaseClient<any, "public", any>;
  private status: SupabaseStatus;
  private statsInterval?: NodeJS.Timeout;
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor(config: SupabaseConfig = defaultConfig) {
    // Store the URL and key for logging
    this.supabaseUrl = config.url;
    this.supabaseKey = config.key;
    
    // Ensure we're creating the client with the proper auth options
    this.client = createClient(this.supabaseUrl, this.supabaseKey, {
      ...config.options,
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        ...(config.options?.auth || {})
      },
      db: {
        schema: 'public',
        ...(config.options?.db || {})
      }
    }) as SupabaseClient<any, "public", any>;
    
    this.status = {
      isConnected: false,
      lastError: null,
      lastConnectTime: null,
      queryStats: {
        totalQueries: 0,
        slowQueries: 0,
        lastSlowQuery: null
      }
    };

    // Start collecting stats
    this.startCollectingStats();
    
    // Test connection immediately but don't block constructor
    this.testConnection().catch(err => {
      logger.warn('Initial Supabase connection test failed', { 
        error: err.message,
        url: this.supabaseUrl
      });
    });
  }
  
  /**
   * Test the Supabase connection
   * @returns Promise that resolves if connection is successful
   */
  private async testConnection(): Promise<void> {
    try {
      // Run a simple query to test connection
      const { error } = await this.client.from('connection_test').select('*').limit(1);
      
      if (error) {
        // Check if this is just a "relation does not exist" error, which is expected
        // during migration when the table hasn't been created yet
        if (error.code === '42P01') {
          // This is fine - the table doesn't exist but the connection works
          logger.info('Supabase connection successful (connection_test table does not exist yet)', {
            url: this.supabaseUrl
          });
          
          // Update status to connected since the connection itself works
          this.status.isConnected = true;
          this.status.lastConnectTime = new Date();
          return;
        }
        
        // For any other error, throw it
        throw error;
      }
      
      // Update status
      this.status.isConnected = true;
      this.status.lastConnectTime = new Date();
      
      logger.info('Supabase connection test successful', {
        url: this.supabaseUrl
      });
    } catch (err) {
      this.status.isConnected = false;
      this.status.lastError = err as Error;
      
      // Log error but don't crash the application
      logger.error('Supabase connection test failed', { 
        error: (err as Error).message,
        url: this.supabaseUrl
      });
    }
  }

  /**
   * Start collecting database statistics
   */
  private startCollectingStats(): void {
    // Collect stats every 30 seconds
    this.statsInterval = setInterval(() => {
      // Nothing to do here as Supabase doesn't provide connection statistics directly
      // We'll update the stats through our query methods
    }, 30000);
  }

  /**
   * Execute a query with timing
   * @param queryFn Function that executes the query
   * @param queryDescription Description of the query
   * @param params Query parameters
   * @returns Query result
   */
  private async executeWithTiming<T>(
    queryFn: () => Promise<PostgrestResponse<T> | PostgrestSingleResponse<T>>,
    queryDescription: string,
    params?: any
  ): Promise<PostgrestResponse<T> | PostgrestSingleResponse<T>> {
    const startTime = Date.now();
    
    try {
      // Execute the query
      const result = await queryFn();
      
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      // Update stats
      this.status.queryStats.totalQueries++;
      
      // Check if it's a slow query (>1000ms)
      if (executionTime > 1000) {
        this.status.queryStats.slowQueries++;
        this.status.queryStats.lastSlowQuery = {
          query: queryDescription,
          params,
          executionTime,
          timestamp: new Date()
        };
        
        logger.warn('Slow Supabase query detected', {
          query: queryDescription,
          params,
          executionTime: `${executionTime}ms`
        });
      }
      
      // If there's an error, update status
      if (result.error) {
        this.status.lastError = new Error(result.error.message);
        logger.error('Supabase query error', {
          query: queryDescription,
          error: result.error.message,
          params
        });
      }
      
      return result;
    } catch (err) {
      // Calculate execution time
      const executionTime = Date.now() - startTime;
      
      // Update stats
      this.status.queryStats.totalQueries++;
      this.status.lastError = err as Error;
      
      logger.error('Supabase query error', {
        query: queryDescription,
        error: (err as Error).message,
        params,
        executionTime: `${executionTime}ms`
      });
      
      throw err;
    }
  }

  /**
   * Get the Supabase client
   * @returns Supabase client
   */
  getClient(): SupabaseClient<any, "public", any> {
    return this.client;
  }

  /**
   * Get Supabase connection status
   * @returns Connection status
   */
  getStatus(): SupabaseStatus {
    return { ...this.status };
  }

  /**
   * Execute a query on a table
   * @param table Table name
   * @param columns Columns to select
   * @param filters Filters to apply
   * @returns Query result
   */
  async query<T = any>(
    table: string,
    columns: string = '*',
    filters?: Record<string, any>
  ): Promise<PostgrestResponse<T>> {
    let query = this.client.from(table).select(columns);
    
    // Apply filters if provided
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }
    
    return this.executeWithTiming<T>(
      async () => query as unknown as Promise<PostgrestResponse<T>>,
      `SELECT ${columns} FROM ${table}`,
      filters
    ) as Promise<PostgrestResponse<T>>;
  }

  /**
   * Insert data into a table
   * @param table Table name
   * @param data Data to insert
   * @returns Insert result
   */
  async insert<T = any>(
    table: string,
    data: Record<string, any> | Record<string, any>[]
  ): Promise<PostgrestResponse<T>> {
    return this.executeWithTiming<T>(
      async () => this.client.from(table).insert(data) as unknown as Promise<PostgrestResponse<T>>,
      `INSERT INTO ${table}`,
      data
    ) as Promise<PostgrestResponse<T>>;
  }

  /**
   * Update data in a table
   * @param table Table name
   * @param data Data to update
   * @param filters Filters to apply
   * @returns Update result
   */
  async update<T = any>(
    table: string,
    data: Record<string, any>,
    filters: Record<string, any>
  ): Promise<PostgrestResponse<T>> {
    let query = this.client.from(table).update(data);
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    return this.executeWithTiming<T>(
      async () => query as unknown as Promise<PostgrestResponse<T>>,
      `UPDATE ${table}`,
      { data, filters }
    ) as Promise<PostgrestResponse<T>>;
  }

  /**
   * Delete data from a table
   * @param table Table name
   * @param filters Filters to apply
   * @returns Delete result
   */
  async delete<T = any>(
    table: string,
    filters: Record<string, any>
  ): Promise<PostgrestResponse<T>> {
    let query = this.client.from(table).delete();
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    return this.executeWithTiming<T>(
      async () => query as unknown as Promise<PostgrestResponse<T>>,
      `DELETE FROM ${table}`,
      filters
    ) as Promise<PostgrestResponse<T>>;
  }

  /**
   * Close the Supabase client
   */
  async close(): Promise<void> {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    
    // Supabase client doesn't have a close method, but we can clean up resources
    logger.info('Supabase client resources cleaned up');
  }
}

// Create and export a singleton instance
const supabaseClient = new SupabaseClientManager();

export default supabaseClient;
