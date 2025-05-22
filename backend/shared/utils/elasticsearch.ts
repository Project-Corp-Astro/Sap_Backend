/**
 * Elasticsearch Client Utility
 * Provides a centralized Elasticsearch client for search functionality with proper error handling,
 * index management, and query optimization
 */

import { Client } from '@elastic/elasticsearch';
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
  node: config.get('elasticsearch.node', 'http://localhost:9200'),
  auth: {
    username: config.get('elasticsearch.username', ''),
    password: config.get('elasticsearch.password', '')
  },
  ssl: {
    rejectUnauthorized: false
  },
  maxRetries: 3,
  requestTimeout: 3000, // Reduced timeout for faster failure
  sniffOnStart: false,  // Disable sniffing to avoid hanging
  sniffInterval: 60000
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
    // Remove empty auth if credentials not provided
    if (!config.auth?.username && !config.auth?.password) {
      delete config.auth;
    }

    // Create a more resilient configuration
    const resilientConfig = {
      ...config,
      requestTimeout: config.requestTimeout || 3000,
      maxRetries: config.maxRetries || 2
    };

    this.client = new Client(resilientConfig);
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
      // Set a shorter timeout for the ping request to avoid hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Elasticsearch connection timeout')), 2000);
      });
      
      // Try to ping Elasticsearch with a timeout
      const pingPromise = this.client.ping();
      
      try {
        const response = await Promise.race([pingPromise, timeoutPromise]) as any;
        
        this.status.isConnected = response.statusCode === 200;
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
}

// Create and export a singleton instance
const esClient = new ElasticsearchClient();

export default esClient;
