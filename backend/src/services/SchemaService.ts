/**
 * Schema Service
 * Provides functionality for managing database schemas and migrations
 * across the hybrid database architecture
 */

import { createServiceLogger } from '../../shared/utils/logger';
import { getConnection } from 'typeorm';
import mongoose from 'mongoose';
import esClient from '../../shared/utils/elasticsearch';
import { mongoConfig } from '../config/database.config';

const logger = createServiceLogger('schema-service');

export class SchemaService {
  /**
   * Run PostgreSQL migrations
   * @returns Migration results
   */
  async runPgMigrations(): Promise<any> {
    try {
      logger.info('Running PostgreSQL migrations...');
      
      const connection = getConnection();
      const migrations = await connection.runMigrations();
      
      logger.info(`Successfully ran ${migrations.length} PostgreSQL migrations`);
      
      return {
        success: true,
        count: migrations.length,
        migrations: migrations.map(m => m.name)
      };
    } catch (error) {
      logger.error('Error running PostgreSQL migrations', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Revert last PostgreSQL migration
   * @returns Revert result
   */
  async revertLastPgMigration(): Promise<any> {
    try {
      logger.info('Reverting last PostgreSQL migration...');
      
      const connection = getConnection();
      await connection.undoLastMigration();
      
      logger.info('Successfully reverted last PostgreSQL migration');
      
      return {
        success: true
      };
    } catch (error) {
      logger.error('Error reverting last PostgreSQL migration', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Synchronize MongoDB schemas
   * @returns Synchronization results
   */
  async syncMongoSchemas(): Promise<any> {
    try {
      logger.info('Synchronizing MongoDB schemas...');
      
      // Get all registered models
      const modelNames = mongoose.modelNames();
      const results: any[] = [];
      
      for (const modelName of modelNames) {
        const model = mongoose.model(modelName);
        
        // Create collection if it doesn't exist
        const db = mongoose.connection.db;
        const collections = await db.listCollections({ name: model.collection.name }).toArray();
        
        if (collections.length === 0) {
          await db.createCollection(model.collection.name);
          logger.info(`Created MongoDB collection: ${model.collection.name}`);
        }
        
        // Create indexes
        const indexes = model.schema.indexes();
        
        if (indexes.length > 0) {
          for (const [fields, options] of indexes) {
            await model.collection.createIndex(fields, options);
          }
          
          logger.info(`Created ${indexes.length} indexes for model: ${modelName}`);
        }
        
        results.push({
          model: modelName,
          collection: model.collection.name,
          indexes: indexes.length
        });
      }
      
      logger.info(`Successfully synchronized ${modelNames.length} MongoDB schemas`);
      
      return {
        success: true,
        count: modelNames.length,
        models: results
      };
    } catch (error) {
      logger.error('Error synchronizing MongoDB schemas', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Create Elasticsearch indices
   * @returns Creation results
   */
  async createEsIndices(): Promise<any> {
    try {
      logger.info('Creating Elasticsearch indices...');
      
      // Define indices to create
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
        }
      ];
      
      const results: any[] = [];
      
      // Create each index
      for (const index of indices) {
        const exists = await esClient.indexExists(index.name);
        
        if (!exists) {
          await esClient.createIndex(index.name, {
            settings: index.settings,
            mappings: index.mappings
          });
          
          logger.info(`Created Elasticsearch index: ${index.name}`);
          
          results.push({
            name: index.name,
            created: true
          });
        } else {
          logger.info(`Elasticsearch index already exists: ${index.name}`);
          
          results.push({
            name: index.name,
            created: false
          });
        }
      }
      
      logger.info(`Elasticsearch indices creation completed`);
      
      return {
        success: true,
        count: indices.length,
        indices: results
      };
    } catch (error) {
      logger.error('Error creating Elasticsearch indices', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Delete Elasticsearch indices
   * @param indices - Array of index names to delete
   * @returns Deletion results
   */
  async deleteEsIndices(indices: string[]): Promise<any> {
    try {
      logger.info(`Deleting Elasticsearch indices: ${indices.join(', ')}...`);
      
      const results: any[] = [];
      
      // Delete each index
      for (const indexName of indices) {
        const exists = await esClient.indexExists(indexName);
        
        if (exists) {
          await esClient.deleteIndex(indexName);
          
          logger.info(`Deleted Elasticsearch index: ${indexName}`);
          
          results.push({
            name: indexName,
            deleted: true
          });
        } else {
          logger.info(`Elasticsearch index does not exist: ${indexName}`);
          
          results.push({
            name: indexName,
            deleted: false
          });
        }
      }
      
      logger.info(`Elasticsearch indices deletion completed`);
      
      return {
        success: true,
        count: results.filter(r => r.deleted).length,
        indices: results
      };
    } catch (error) {
      logger.error('Error deleting Elasticsearch indices', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Initialize all database schemas
   * @returns Initialization results
   */
  async initializeAllSchemas(): Promise<any> {
    try {
      logger.info('Initializing all database schemas...');
      
      // Run PostgreSQL migrations
      const pgResult = await this.runPgMigrations();
      
      // Synchronize MongoDB schemas
      const mongoResult = await this.syncMongoSchemas();
      
      // Create Elasticsearch indices
      const esResult = await this.createEsIndices();
      
      logger.info('All database schemas initialized successfully');
      
      return {
        success: true,
        postgres: pgResult,
        mongodb: mongoResult,
        elasticsearch: esResult
      };
    } catch (error) {
      logger.error('Error initializing database schemas', { error: (error as Error).message });
      throw error;
    }
  }
}

// Create and export a singleton instance
const schemaService = new SchemaService();
export default schemaService;
