/**
 * Elasticsearch Initialization Script
 * Sets up Elasticsearch indices and mappings for the application
 */

import { Client } from '@elastic/elasticsearch';
import { createServiceLogger } from '../../shared/utils/logger';
import { elasticsearchConfig } from '../config/database.config';

const logger = createServiceLogger('es-init');

// Create Elasticsearch client
const client = new Client({
  node: elasticsearchConfig.node,
  auth: elasticsearchConfig.auth.username ? {
    username: elasticsearchConfig.auth.username,
    password: elasticsearchConfig.auth.password
  } : undefined,
  ssl: elasticsearchConfig.ssl
});

// Define indices
const indices = [
  {
    name: 'users',
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
      analysis: {
        analyzer: {
          email_analyzer: {
            type: 'custom',
            tokenizer: 'uax_url_email',
            filter: ['lowercase', 'stop']
          },
          name_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: ['lowercase', 'asciifolding']
          }
        }
      }
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        email: { 
          type: 'text',
          analyzer: 'email_analyzer',
          fields: {
            keyword: { type: 'keyword' }
          }
        },
        firstName: { 
          type: 'text',
          analyzer: 'name_analyzer',
          fields: {
            keyword: { type: 'keyword' }
          }
        },
        lastName: { 
          type: 'text',
          analyzer: 'name_analyzer',
          fields: {
            keyword: { type: 'keyword' }
          }
        },
        fullName: { 
          type: 'text',
          analyzer: 'name_analyzer'
        },
        role: { 
          type: 'object',
          properties: {
            id: { type: 'keyword' },
            name: { type: 'keyword' }
          }
        },
        isActive: { type: 'boolean' },
        isVerified: { type: 'boolean' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        lastLogin: { type: 'date' }
      }
    }
  },
  {
    name: 'content',
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1,
      analysis: {
        analyzer: {
          html_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            char_filter: ['html_strip'],
            filter: ['lowercase', 'stop', 'snowball']
          }
        }
      }
    },
    mappings: {
      properties: {
        id: { type: 'keyword' },
        title: { 
          type: 'text',
          analyzer: 'standard',
          fields: {
            keyword: { type: 'keyword' }
          }
        },
        slug: { type: 'keyword' },
        description: { type: 'text' },
        content: { 
          type: 'text',
          analyzer: 'html_analyzer'
        },
        tags: { type: 'keyword' },
        categories: { type: 'keyword' },
        author: { 
          type: 'object',
          properties: {
            id: { type: 'keyword' },
            name: { type: 'text' }
          }
        },
        status: { type: 'keyword' },
        publishedAt: { type: 'date' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' }
      }
    }
  },
  {
    name: 'logs',
    settings: {
      number_of_shards: 1,
      number_of_replicas: 1
    },
    mappings: {
      properties: {
        timestamp: { type: 'date' },
        level: { type: 'keyword' },
        message: { type: 'text' },
        service: { type: 'keyword' },
        context: { type: 'object', enabled: true },
        user: { 
          type: 'object',
          properties: {
            id: { type: 'keyword' },
            email: { type: 'keyword' }
          }
        },
        request: {
          type: 'object',
          properties: {
            method: { type: 'keyword' },
            url: { type: 'keyword' },
            ip: { type: 'ip' },
            userAgent: { type: 'text' }
          }
        },
        error: {
          type: 'object',
          properties: {
            message: { type: 'text' },
            stack: { type: 'text' },
            code: { type: 'keyword' }
          }
        }
      }
    }
  }
];

/**
 * Check if index exists
 * @param indexName - Name of the index to check
 */
async function indexExists(indexName: string): Promise<boolean> {
  try {
    const { body } = await client.indices.exists({ index: indexName });
    return body;
  } catch (error) {
    logger.error(`Error checking if index ${indexName} exists`, { error: (error as Error).message });
    return false;
  }
}

/**
 * Create index
 * @param index - Index configuration
 */
async function createIndex(index: any): Promise<void> {
  try {
    const exists = await indexExists(index.name);
    
    if (exists) {
      logger.info(`Index ${index.name} already exists`);
      return;
    }
    
    await client.indices.create({
      index: index.name,
      body: {
        settings: index.settings,
        mappings: index.mappings
      }
    });
    
    logger.info(`Index ${index.name} created successfully`);
  } catch (error) {
    logger.error(`Error creating index ${index.name}`, { error: (error as Error).message });
    throw error;
  }
}

/**
 * Initialize Elasticsearch
 */
async function initializeElasticsearch(): Promise<void> {
  logger.info('Initializing Elasticsearch...');
  
  try {
    // Check connection
    await client.ping();
    logger.info('Connected to Elasticsearch');
    
    // Create indices
    for (const index of indices) {
      await createIndex(index);
    }
    
    logger.info('Elasticsearch initialization completed successfully');
  } catch (error) {
    logger.error('Error initializing Elasticsearch', { error: (error as Error).message });
    process.exit(1);
  }
}

// Run initialization
initializeElasticsearch();
