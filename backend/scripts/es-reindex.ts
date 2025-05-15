/**
 * Elasticsearch Reindexing Script
 * Reindexes data from MongoDB to Elasticsearch for search functionality
 */

import mongoose from 'mongoose';
import esClient from '../shared/utils/elasticsearch';
import { createServiceLogger } from '../shared/utils/logger';
import config from '../shared/config/index';

const logger = createServiceLogger('es-reindex');

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    const mongoUri = config.get('mongo.uri', 'mongodb://localhost:27017/sap-db');
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB');
  } catch (error) {
    logger.error('Error connecting to MongoDB', { error: (error as Error).message });
    throw error;
  }
}

// Reindex content from MongoDB to Elasticsearch
async function reindexContent() {
  try {
    logger.info('Reindexing content from MongoDB to Elasticsearch');
    
    // Load Content model
    const Content = mongoose.model('Content');
    
    // Get all content items
    const contents = await Content.find({})
      .populate('category')
      .populate('createdBy', 'username displayName')
      .lean();
    
    logger.info(`Found ${contents.length} content items to reindex`);
    
    if (contents.length === 0) {
      return;
    }
    
    // Prepare documents for bulk indexing
    const documents = contents.map(content => ({
      id: content._id.toString(),
      body: {
        id: content._id.toString(),
        title: content.title,
        slug: content.slug,
        content: content.content,
        summary: content.summary,
        categoryId: content.category?._id.toString(),
        categoryName: content.category?.name,
        tags: content.tags,
        author: {
          id: content.createdBy?._id.toString(),
          name: content.createdBy?.displayName || content.createdBy?.username
        },
        status: content.status,
        publishedAt: content.publishedAt,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt
      }
    }));
    
    // Bulk index to Elasticsearch
    const response = await esClient.bulkIndex('content', documents);
    
    logger.info(`Successfully reindexed ${documents.length} content items to Elasticsearch`);
    
    return response;
  } catch (error) {
    logger.error('Error reindexing content', { error: (error as Error).message });
    throw error;
  }
}

// Reindex users from MongoDB to Elasticsearch
async function reindexUsers() {
  try {
    logger.info('Reindexing users from MongoDB to Elasticsearch');
    
    // Load User model
    const User = mongoose.model('User');
    
    // Get all users
    const users = await User.find({}).lean();
    
    logger.info(`Found ${users.length} users to reindex`);
    
    if (users.length === 0) {
      return;
    }
    
    // Prepare documents for bulk indexing
    const documents = users.map(user => ({
      id: user._id.toString(),
      body: {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        bio: user.bio,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    }));
    
    // Bulk index to Elasticsearch
    const response = await esClient.bulkIndex('users', documents);
    
    logger.info(`Successfully reindexed ${documents.length} users to Elasticsearch`);
    
    return response;
  } catch (error) {
    logger.error('Error reindexing users', { error: (error as Error).message });
    throw error;
  }
}

// Main function to run reindexing
async function runReindexing() {
  try {
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Reindex content
    await reindexContent();
    
    // Reindex users
    await reindexUsers();
    
    logger.info('Reindexing completed successfully');
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during reindexing', { error: (error as Error).message });
    
    // Disconnect from MongoDB
    try {
      await mongoose.disconnect();
      logger.info('Disconnected from MongoDB');
    } catch (disconnectError) {
      logger.error('Error disconnecting from MongoDB', { error: (disconnectError as Error).message });
    }
    
    process.exit(1);
  }
}

// Run reindexing
runReindexing();
