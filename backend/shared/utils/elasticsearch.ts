/**
 * Elasticsearch Client Utility
 * Provides a centralized Elasticsearch client for search functionality with proper error handling,
 * index management, and query optimization
 */

import { Client, ApiResponse } from '@elastic/elasticsearch';
import { createServiceLogger } from './logger';
import config from '../config/index';

// Determine if we should use mock databases - respect the .env setting
const USE_MOCK_DATABASES = process.env.USE_MOCK_DATABASES === 'true';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// Initialize logger
const logger = createServiceLogger('elasticsearch-client');

// Define interfaces for Elasticsearch configuration and status tracking
interface ElasticsearchConfig {
  node: string;
  auth?: {
    username: string;
    password: string;
  };
  ssl?: {
    rejectUnauthorized: boolean;
  };
  maxRetries?: number;
  requestTimeout?: number;
  sniffOnStart?: boolean;
  sniffInterval?: number;
  headers?: Record<string, string>;
}

interface IndexSettings {
  settings: {
    number_of_shards: number;
    number_of_replicas: number;
    analysis?: {
      analyzer?: Record<string, any>;
      tokenizer?: Record<string, any>;
      filter?: Record<string, any>;
    };
  };
  mappings: {
    properties: Record<string, any>;
  };
}

interface SearchStats {
  totalSearches: number;
  slowSearches: number;
  lastSlowSearch: SlowSearchInfo | null;
}

interface SlowSearchInfo {
  query: any;
  index: string;
  executionTime: number;
  timestamp: Date;
}

interface ElasticsearchStatus {
  isConnected: boolean;
  usingMock?: boolean;
  lastError: Error | null;
  lastConnectTime: Date | null;
  searchStats: SearchStats;
}

// Default Elasticsearch configuration
const defaultConfig: ElasticsearchConfig = {
  node: process.env.ELASTICSEARCH_NODE || config.get('elasticsearch.node', 'http://127.0.0.1:9200'),
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || config.get('elasticsearch.username', ''),
    password: process.env.ELASTICSEARCH_PASSWORD || config.get('elasticsearch.password', '')
  },
  ssl: {
    rejectUnauthorized: false
  },
  maxRetries: 5,
  requestTimeout: 10000, // Increased timeout to allow more time for connection
  sniffOnStart: false,  // Disable sniffing to avoid hanging
  sniffInterval: 60000,
  // Initialize empty headers object that will be populated later
  headers: {}
};

/**
 * Elasticsearch client singleton
 */
class ElasticsearchClient {
  private client: Client;
  private status: ElasticsearchStatus;
  private indices: Set<string>;

  constructor(config: ElasticsearchConfig = defaultConfig) {
    // Only use mock client when explicitly set
    if (process.env.USE_MOCK_DATABASES === 'true') {
      logger.info('Mock mode detected, using mock Elasticsearch client');
      
      // Create a dummy client that won't try to connect
      this.client = new Client({
        node: 'http://localhost:9200',
        maxRetries: 0,
        requestTimeout: 1,
        sniffOnStart: false
      });
      
      this.indices = new Set<string>();
      
      this.status = {
        isConnected: true, // Pretend we're connected
        usingMock: true,   // Flag that we're using a mock implementation
        lastError: null,
        lastConnectTime: new Date(),
        searchStats: {
          totalSearches: 0,
          slowSearches: 0,
          lastSlowSearch: null
        }
      };
      
      return; // Skip connection check
    }
    
    // For production mode, use real connection
    // Get credentials directly from environment variables
    const username = process.env.ELASTICSEARCH_USERNAME;
    const password = process.env.ELASTICSEARCH_PASSWORD;
    const node = process.env.ELASTICSEARCH_NODE || 'http://127.0.0.1:9200';
    
    // Log environment variables for debugging (without exposing sensitive data)
    logger.info('Elasticsearch environment variables', {
      node: process.env.ELASTICSEARCH_NODE || 'not set',
      username: username ? 'provided' : 'not set',
      password: password ? 'provided' : 'not set',
      useElasticsearch: process.env.USE_ELASTICSEARCH || 'not set'
    });
    
    // Create a direct client configuration
    let clientConfig: any;
    
    if (username && password) {
      // Create config with authentication
      clientConfig = {
        node,
        auth: {
          username,
          password
        },
        ssl: { rejectUnauthorized: false },
        maxRetries: 5,
        requestTimeout: 15000,
        sniffOnStart: false
      };
      logger.info('Using Elasticsearch with authentication');
    } else {
      // Create config without authentication
      clientConfig = {
        node,
        ssl: { rejectUnauthorized: false },
        maxRetries: 5,
        requestTimeout: 15000,
        sniffOnStart: false
      };
      logger.warn('Using Elasticsearch without authentication');
    }

    this.client = new Client(clientConfig);
    this.indices = new Set<string>();
    
    this.status = {
      isConnected: false,
      lastError: null,
      lastConnectTime: null,
      searchStats: {
        totalSearches: 0,
        slowSearches: 0,
        lastSlowSearch: null
      }
    };

    // Check connection
    this.checkConnection();
  }

  /**
   * Check connection to Elasticsearch
   */
  async checkConnection(): Promise<void> {
    // If we're explicitly using mock databases, skip the real connection check
    if (process.env.USE_MOCK_DATABASES === 'true') {
      // Just pretend we're connected
      this.status.isConnected = true;
      this.status.lastConnectTime = new Date();
      logger.info('Mock Elasticsearch connection active');
      return;
    }
    
    try {
      // Set a longer timeout for the ping request to avoid timeout issues
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Elasticsearch connection timeout')), 15000);
      });
      
      // Log connection attempt with credentials info (but not the actual credentials)
      logger.info('Attempting to connect to Elasticsearch', { 
        node: process.env.ELASTICSEARCH_NODE || 'http://127.0.0.1:9200',
        auth: process.env.ELASTICSEARCH_USERNAME && process.env.ELASTICSEARCH_PASSWORD ? 'provided' : 'not provided'
      });
      
      // Try to ping Elasticsearch with a timeout
      const pingPromise = this.client.ping();
      
      try {
        const response = await Promise.race([pingPromise, timeoutPromise]) as any;
        
        this.status.isConnected = true; // If we get here without error, we're connected
        this.status.lastConnectTime = new Date();
        logger.info('Elasticsearch connection check successful');
      } catch (timeoutErr) {
        // Handle timeout specifically
        this.status.isConnected = false;
        this.status.lastError = timeoutErr as Error;
        logger.error('Elasticsearch connection timed out', { error: (timeoutErr as Error).message });
        
        // Attempt to abort the ping request to prevent hanging connections
        try {
          // @ts-ignore - TypeScript doesn't know about the abort method
          if (pingPromise.abort) pingPromise.abort();
        } catch (abortErr) {
          // Ignore abort errors
        }
        
        // Try alternate connection check if ping times out
        try {
          logger.info('Attempting alternate connection check with info API');
          const infoResponse = await this.client.info();
          if (infoResponse) {
            this.status.isConnected = true;
            this.status.lastConnectTime = new Date();
            logger.info('Elasticsearch connection successful via info API');
          }
        } catch (infoErr) {
          const errorMessage = (infoErr as Error).message;
          logger.error('Alternate connection check also failed', { error: errorMessage });
          
          // Check for authentication issues
          if (errorMessage.includes('security_exception') || errorMessage.includes('authentication')) {
            logger.error('Elasticsearch authentication failed. Check your credentials in .env file');
            logger.info('Expected credentials format: ELASTICSEARCH_USERNAME=username, ELASTICSEARCH_PASSWORD=password');
          }
        }
      }
    } catch (err) {
      this.status.isConnected = false;
      this.status.lastError = err as Error;
      logger.error('Elasticsearch connection error', { error: (err as Error).message });
      // Don't throw the error - allow the application to continue without Elasticsearch
    }
  }

  /**
   * Get Elasticsearch client status
   * @returns Elasticsearch client status
   */
  getStatus(): ElasticsearchStatus {
    return this.status;
  }

  /**
   * Close the client
   */
  async close(): Promise<void> {
    try {
      await this.client.close();
      logger.info('Elasticsearch client closed');
    } catch (err) {
      logger.error('Error closing Elasticsearch client', { error: (err as Error).message });
    }
  }
  
  /**
   * Search documents in an index
   * @param index - Index name
   * @param query - Elasticsearch query
   * @param from - Starting position
   * @param size - Number of results to return
   * @returns Search results
   */
  async search(index: string, query: any, from: number = 0, size: number = 10): Promise<any> {
    try {
      // Handle mock mode
      if (process.env.USE_MOCK_DATABASES === 'true') {
        logger.info(`[MOCK] Searching in index: ${index}`);
        return {
          hits: [],
          total: { value: 0 },
          aggregations: {}
        };
      }
      
      const startTime = Date.now();
      
      const response = await this.client.search({
        index,
        body: query,
        from,
        size
      });
      
      const executionTime = Date.now() - startTime;
      
      // Track search stats
      this.status.searchStats.totalSearches++;
      
      if (executionTime > 1000) { // Slow search threshold: 1 second
        this.status.searchStats.slowSearches++;
        this.status.searchStats.lastSlowSearch = {
          query,
          index,
          executionTime,
          timestamp: new Date()
        };
        
        logger.warn(`Slow search detected (${executionTime}ms)`, {
          index,
          query: JSON.stringify(query).substring(0, 200) + '...'
        });
      }
      
      // Handle response based on Elasticsearch client version
      // For Elasticsearch client v7+, the response structure is different
      const responseBody = (response as any).body || response;
      
      return {
        hits: (responseBody as any).hits?.hits || [],
        total: (responseBody as any).hits?.total || { value: 0 },
        aggregations: (responseBody as any).aggregations || {}
      };
    } catch (error) {
      logger.error(`Error searching in index: ${index}`, { error: (error as Error).message });
      throw error;
    }
  }
  
  /**
   * Index a document
   * @param index - Index name
   * @param id - Document ID
   * @param document - Document body
   * @returns Indexing result
   */
  async indexDocument(index: string, id: string, document: any): Promise<any> {
    try {
      // Handle mock mode
      if (process.env.USE_MOCK_DATABASES === 'true') {
        logger.info(`[MOCK] Indexing document in ${index}: ${id}`);
        return { result: 'created' };
      }
      
      // Add the index to our tracked indices set
      this.indices.add(index);
      
      const response = await this.client.index({
        index,
        id,
        body: document,
        refresh: true // Make the document immediately searchable
      });
      
      logger.debug(`Indexed document in ${index}: ${id}`);
      
      return response;
    } catch (error) {
      logger.error(`Error indexing document in ${index}: ${id}`, { error: (error as Error).message });
      throw error;
    }
  }
  
  /**
   * Delete a document
   * @param index - Index name
   * @param id - Document ID
   * @returns Deletion result
   */
  async deleteDocument(index: string, id: string): Promise<any> {
    try {
      // Handle mock mode
      if (process.env.USE_MOCK_DATABASES === 'true') {
        logger.info(`[MOCK] Deleting document from ${index}: ${id}`);
        return { result: 'deleted' };
      }
      
      const response = await this.client.delete({
        index,
        id,
        refresh: true // Make the deletion immediately visible
      });
      
      logger.debug(`Deleted document from ${index}: ${id}`);
      
      return response;
    } catch (error) {
      logger.error(`Error deleting document from ${index}: ${id}`, { error: (error as Error).message });
      throw error;
    }
  }
}

// Create and export a singleton instance
const esClient = new ElasticsearchClient();

export default esClient;
