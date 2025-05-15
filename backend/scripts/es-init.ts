/**
 * Elasticsearch Initialization Script
 * Sets up Elasticsearch indices with proper mappings and settings
 */

import esClient from '../shared/utils/elasticsearch';
import { createServiceLogger } from '../shared/utils/logger';

const logger = createServiceLogger('es-init');

// Define index mappings and settings
const contentIndexSettings = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        content_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding', 'stop', 'snowball']
        }
      }
    }
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      title: { 
        type: 'text',
        analyzer: 'content_analyzer',
        fields: {
          keyword: { type: 'keyword' }
        }
      },
      slug: { type: 'keyword' },
      content: { 
        type: 'text',
        analyzer: 'content_analyzer' 
      },
      summary: { type: 'text' },
      categoryId: { type: 'keyword' },
      categoryName: { type: 'keyword' },
      tags: { type: 'keyword' },
      author: {
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
};

const userIndexSettings = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1
  },
  mappings: {
    properties: {
      id: { type: 'keyword' },
      email: { type: 'keyword' },
      username: { type: 'keyword' },
      displayName: { type: 'text' },
      firstName: { type: 'text' },
      lastName: { type: 'text' },
      role: { type: 'keyword' },
      bio: { type: 'text' },
      createdAt: { type: 'date' },
      lastLogin: { type: 'date' }
    }
  }
};

async function initializeElasticsearch() {
  try {
    logger.info('Initializing Elasticsearch indices');
    
    // Create content index
    const contentIndexCreated = await esClient.createIndex('content', contentIndexSettings);
    if (contentIndexCreated) {
      logger.info('Content index created successfully');
    } else {
      logger.info('Content index already exists');
    }
    
    // Create user index
    const userIndexCreated = await esClient.createIndex('users', userIndexSettings);
    if (userIndexCreated) {
      logger.info('Users index created successfully');
    } else {
      logger.info('Users index already exists');
    }
    
    logger.info('Elasticsearch initialization completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error initializing Elasticsearch', { error: (error as Error).message });
    process.exit(1);
  }
}

// Run initialization
initializeElasticsearch();
