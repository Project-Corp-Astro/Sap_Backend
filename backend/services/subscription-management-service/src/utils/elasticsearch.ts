import { Client } from 'elasticsearch';
import config from '../config';
import logger from './logger';

// Create Elasticsearch client instance
const elasticsearchClient = new Client({
  host: config.elasticsearch.node,
  httpAuth: `${config.elasticsearch.auth.username}:${config.elasticsearch.auth.password}`,
  ssl: {
    rejectUnauthorized: config.elasticsearch.ssl.rejectUnauthorized,
  },
});

// Check Elasticsearch connection
const checkElasticsearchConnection = async (): Promise<boolean> => {
  try {
    // Add an empty params object as required by the Elasticsearch client API
    const response: any = await elasticsearchClient.info({});
    if (response && typeof response === 'object' && response.version && response.version.number) {
      logger.info(`Elasticsearch connection successful - version ${response.version.number}`);
      return true;
    }
    logger.info('Elasticsearch connection successful - version unknown');
    return true;
  } catch (error) {
    logger.error('Elasticsearch connection failed:', error);
    return false;
  }
};

// Helper functions for common Elasticsearch operations
const elasticsearchUtils = {
  /**
   * Create or update an index with mapping
   */
  async createIndex(indexName: string, mapping: any): Promise<boolean> {
    try {
      const indexExists = await elasticsearchClient.indices.exists({ index: indexName });
      
      if (!indexExists) {
        await elasticsearchClient.indices.create({
          index: indexName,
          body: mapping,
        });
        logger.info(`Index ${indexName} created successfully`);
      } else {
        logger.info(`Index ${indexName} already exists`);
      }
      
      return true;
    } catch (error) {
      logger.error(`Error creating index ${indexName}:`, error);
      return false;
    }
  },

  /**
   * Index a document
   */
  async indexDocument(indexName: string, id: string, document: any): Promise<any> {
    try {
      return await elasticsearchClient.index({
        index: indexName,
        type: '_doc', // Default type for ES 6.x and 7.x
        id,
        body: document,
        refresh: true, // Make this document immediately available for search
      });
    } catch (error) {
      logger.error(`Error indexing document to ${indexName}:`, error);
      throw error;
    }
  },

  /**
   * Update a document
   */
  async updateDocument(indexName: string, id: string, document: any): Promise<any> {
    try {
      return await elasticsearchClient.update({
        index: indexName,
        type: '_doc', // Default type for ES 6.x and 7.x
        id,
        body: {
          doc: document,
        },
        refresh: true,
      });
    } catch (error) {
      logger.error(`Error updating document in ${indexName}:`, error);
      throw error;
    }
  },

  /**
   * Search documents
   */
  async searchDocuments(indexName: string, query: any): Promise<any> {
    try {
      return await elasticsearchClient.search({
        index: indexName,
        body: query,
      });
    } catch (error) {
      logger.error(`Error searching documents in ${indexName}:`, error);
      throw error;
    }
  },

  /**
   * Delete a document
   */
  async deleteDocument(indexName: string, id: string): Promise<any> {
    try {
      return await elasticsearchClient.delete({
        index: indexName,
        type: '_doc', // Default type for ES 6.x and 7.x
        id,
        refresh: true,
      });
    } catch (error) {
      logger.error(`Error deleting document from ${indexName}:`, error);
      throw error;
    }
  },

  /**
   * Delete an index
   */
  async deleteIndex(indexName: string): Promise<any> {
    try {
      return await elasticsearchClient.indices.delete({
        index: indexName,
      });
    } catch (error) {
      logger.error(`Error deleting index ${indexName}:`, error);
      throw error;
    }
  },

  /**
   * Bulk operations
   */
  async bulkOperation(operations: any[]): Promise<any> {
    try {
      return await elasticsearchClient.bulk({
        refresh: true,
        body: operations,
      });
    } catch (error) {
      logger.error('Error performing bulk operation:', error);
      throw error;
    }
  },
  
  /**
   * Close Elasticsearch connection
   */
  async close(): Promise<void> {
    try {
      await elasticsearchClient.close();
      logger.info('Elasticsearch connection closed');
    } catch (error) {
      logger.error('Error closing Elasticsearch connection:', error);
    }
  },
};

export { elasticsearchClient, elasticsearchUtils, checkElasticsearchConnection };
export default elasticsearchUtils;
