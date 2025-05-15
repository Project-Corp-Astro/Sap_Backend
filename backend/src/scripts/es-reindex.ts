/**
 * Elasticsearch Reindex Script
 * Reindexes data from MongoDB to Elasticsearch
 */

import mongoose from 'mongoose';
import { createServiceLogger } from '../../shared/utils/logger';
import mongoDbConnection from '../../shared/utils/database';
import esClient from '../../shared/utils/elasticsearch';
import { mongoConfig } from '../config/database.config';
import searchService from '../services/SearchService';

const logger = createServiceLogger('es-reindex');

// Define models to reindex
const modelsToReindex = [
  {
    name: 'User',
    mongoCollection: 'users',
    esIndex: 'users',
    transform: (doc: any) => ({
      id: doc._id.toString(),
      email: doc.email,
      firstName: doc.firstName || '',
      lastName: doc.lastName || '',
      fullName: `${doc.firstName || ''} ${doc.lastName || ''}`.trim(),
      username: doc.username,
      role: {
        id: doc.role?._id?.toString() || '',
        name: doc.role?.name || 'user'
      },
      isActive: doc.isActive !== false,
      isVerified: doc.isVerified === true,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      lastLogin: doc.lastLogin
    })
  },
  {
    name: 'Content',
    mongoCollection: 'contents',
    esIndex: 'content',
    transform: (doc: any) => ({
      id: doc._id.toString(),
      title: doc.title,
      slug: doc.slug,
      description: doc.description || '',
      content: doc.content || '',
      tags: doc.tags || [],
      categories: doc.categories?.map((cat: any) => 
        typeof cat === 'string' ? cat : cat._id?.toString()
      ) || [],
      author: {
        id: typeof doc.author === 'string' 
          ? doc.author 
          : doc.author?._id?.toString() || '',
        name: typeof doc.author === 'string' 
          ? '' 
          : `${doc.author?.firstName || ''} ${doc.author?.lastName || ''}`.trim()
      },
      status: doc.status || 'draft',
      publishedAt: doc.publishedAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    })
  }
];

/**
 * Reindex a single model
 * @param model - Model configuration
 */
async function reindexModel(model: any): Promise<void> {
  logger.info(`Reindexing ${model.name} documents...`);
  
  try {
    // Get all documents from MongoDB
    const db = mongoose.connection.db;
    const collection = db.collection(model.mongoCollection);
    const documents = await collection.find({}).toArray();
    
    logger.info(`Found ${documents.length} ${model.name} documents in MongoDB`);
    
    if (documents.length === 0) {
      logger.info(`No ${model.name} documents to reindex`);
      return;
    }
    
    // Check if index exists
    const indexExists = await esClient.indexExists(model.esIndex);
    
    if (!indexExists) {
      logger.error(`Index ${model.esIndex} does not exist`);
      return;
    }
    
    // Prepare bulk operations
    const operations = [];
    
    for (const doc of documents) {
      const transformed = model.transform(doc);
      
      operations.push({
        index: {
          _index: model.esIndex,
          _id: transformed.id
        }
      });
      
      operations.push(transformed);
    }
    
    // Execute bulk operation
    if (operations.length > 0) {
      const response = await esClient.bulk(operations);
      
      logger.info(`Reindexed ${response.items.length / 2} ${model.name} documents to Elasticsearch`);
      
      // Log errors if any
      const errors = response.items
        .filter((item: any) => item.index && item.index.error)
        .map((item: any) => ({
          id: item.index._id,
          error: item.index.error
        }));
      
      if (errors.length > 0) {
        logger.error(`Errors reindexing ${errors.length} ${model.name} documents`, { errors });
      }
    }
  } catch (error) {
    logger.error(`Error reindexing ${model.name} documents`, { error: (error as Error).message });
    throw error;
  }
}

/**
 * Main reindex function
 */
async function reindex(): Promise<void> {
  logger.info('Starting reindexing process...');
  
  try {
    // Connect to MongoDB
    await mongoDbConnection.connect(mongoConfig.uri);
    logger.info('Connected to MongoDB');
    
    // Check Elasticsearch connection
    const esStatus = esClient.getStatus();
    
    if (!esStatus.isConnected) {
      throw new Error('Elasticsearch is not connected');
    }
    
    logger.info('Connected to Elasticsearch');
    
    // Reindex each model
    for (const model of modelsToReindex) {
      await reindexModel(model);
    }
    
    logger.info('Reindexing completed successfully');
  } catch (error) {
    logger.error('Error during reindexing process', { error: (error as Error).message });
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    logger.info('MongoDB connection closed');
  }
}

// Run reindex function
reindex();
