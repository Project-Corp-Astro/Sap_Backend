/**
 * Database Initialization Script
 * Initializes all databases in the hybrid architecture
 */

import { createServiceLogger } from '../../shared/utils/logger';
import dbManager from '../utils/DatabaseManager';
import schemaService from '../services/SchemaService';
import dataSyncService from '../services/DataSyncService';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const logger = createServiceLogger('init-databases');

/**
 * Main initialization function
 */
async function initDatabases(): Promise<void> {
  logger.info('Starting database initialization...');
  
  try {
    // Initialize database connections
    await dbManager.initializeAll();
    logger.info('Database connections initialized');
    
    // Initialize database schemas
    logger.info('Initializing database schemas...');
    const schemaResult = await schemaService.initializeAllSchemas();
    logger.info('Database schemas initialized', { result: schemaResult });
    
    // Synchronize data between databases
    logger.info('Synchronizing data between databases...');
    
    // Sync users
    const userSyncCount = await dataSyncService.syncAllUsers();
    logger.info(`Synchronized ${userSyncCount} users`);
    
    // Sync content
    const contentSyncCount = await dataSyncService.syncAllContent();
    logger.info(`Synchronized ${contentSyncCount} content items`);
    
    logger.info('Database initialization completed successfully');
  } catch (error) {
    logger.error('Error during database initialization', { error: (error as Error).message });
    process.exit(1);
  } finally {
    // Close database connections
    await dbManager.closeAll();
    logger.info('Database connections closed');
  }
}

// Run initialization
initDatabases();
