/**
 * Schema Service
 * Provides functionality for managing database schemas and migrations
 * across the hybrid database architecture
 */

import { createServiceLogger } from '../../shared/utils/logger';
import mongoose, { IndexDefinition } from 'mongoose';
import esClient from '../../shared/utils/elasticsearch';
import { mongoConfig } from '../config/database.config';
import { Client } from '@elastic/elasticsearch';
import typeORMManager from '../../shared/utils/typeorm';

const logger = createServiceLogger('schema-service');

export class SchemaService {
  /**
   * Check if an Elasticsearch index exists
   * @param indexName - Name of the index to check
   * @returns Whether the index exists
   */
  async indexExists(indexName: string): Promise<boolean> {
    try {
      if (process.env.USE_MOCK_DATABASES === 'true') {
        logger.info(`[MOCK] Checking if Elasticsearch index exists: ${indexName}`);
        return false;
      }
      
      const response = await (esClient as any).client.indices.exists({
        index: indexName
      });
      
      return response.body === true;
    } catch (error) {
      logger.error(`Error checking if Elasticsearch index exists: ${indexName}`, { error: (error as Error).message });
      return false;
    }
  }
  
  /**
   * Create an Elasticsearch index
   * @param indexName - Name of the index to create
   * @param options - Index settings and mappings
   * @returns Creation result
   */
  async createIndex(indexName: string, options: any): Promise<any> {
    try {
      if (process.env.USE_MOCK_DATABASES === 'true') {
        logger.info(`[MOCK] Creating Elasticsearch index: ${indexName}`);
        return { acknowledged: true };
      }
      
      return await (esClient as any).client.indices.create({
        index: indexName,
        body: options
      });
    } catch (error) {
      logger.error(`Error creating Elasticsearch index: ${indexName}`, { error: (error as Error).message });
      throw error;
    }
  }
  
  /**
   * Delete an Elasticsearch index
   * @param indexName - Name of the index to delete
   * @returns Deletion result
   */
  async deleteIndex(indexName: string): Promise<any> {
    try {
      if (process.env.USE_MOCK_DATABASES === 'true') {
        logger.info(`[MOCK] Deleting Elasticsearch index: ${indexName}`);
        return { acknowledged: true };
      }
      
      return await (esClient as any).client.indices.delete({
        index: indexName
      });
    } catch (error) {
      logger.error(`Error deleting Elasticsearch index: ${indexName}`, { error: (error as Error).message });
      throw error;
    }
  }
  /**
   * Run PostgreSQL migrations
   * @returns Migration results
   */
  async runPgMigrations(): Promise<any> {
    try {
      logger.info('Running PostgreSQL migrations...');
      
      // Get the TypeORM data source from the manager
      const dataSource = typeORMManager.getDataSource();
      const migrations = await dataSource.runMigrations();
      
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
      
      // Get the TypeORM data source from the manager
      const dataSource = typeORMManager.getDataSource();
      await dataSource.undoLastMigration();
      
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
        
        if (!db) {
          logger.warn(`MongoDB connection not established for model: ${modelName}`);
          continue;
        }
        
        const collections = await db.listCollections({ name: model.collection.name }).toArray();
        
        if (collections.length === 0) {
          await db.createCollection(model.collection.name);
          logger.info(`Created MongoDB collection: ${model.collection.name}`);
        }
        
        // Create indexes
        const indexes = model.schema.indexes();
        
        if (indexes.length > 0) {
          for (const [fields, options] of indexes) {
            // Cast both fields and options to the correct types for createIndex
            await model.collection.createIndex(fields as any, options as any);
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
      logger.info('Skipping Elasticsearch indices creation as Elasticsearch is disabled');
      
      // Return mock success result
      return {
        success: true,
        count: 0,
        indices: [],
        skipped: true
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
        const exists = await this.indexExists(indexName);
        
        if (exists) {
          await this.deleteIndex(indexName);
          
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
