/**
 * Direct MongoDB Connection Utility for Seeding
 * 
 * This utility provides a direct connection to MongoDB without the query monitoring
 * that's causing the "queryStats" error in the main database connection.
 */

import mongoose from 'mongoose';
import { createServiceLogger } from '../../shared/utils/logger';

const logger = createServiceLogger('direct-mongo');

/**
 * Connect directly to MongoDB without the problematic query monitoring
 */
export async function connectDirectMongo(uri?: string): Promise<typeof mongoose> {
  // Use the same connection string that works with the DatabaseManager
  const mongoUri = uri || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sap-db';
  try {
    // Use basic connection options without the problematic monitoring
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverApi: { 
        version: "1" as "1", // Type assertion to match the required type
        strict: false, // Set to false to avoid API strict mode errors
        deprecationErrors: false 
      }
    };

    // Connect to MongoDB
    await mongoose.connect(mongoUri, options);
    
    logger.info('Connected directly to MongoDB for seeding');
    return mongoose;
  } catch (error) {
    logger.error('Error connecting directly to MongoDB', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectDirectMongo(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB', { error: (error as Error).message });
  }
}
