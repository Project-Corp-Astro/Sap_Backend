/**
 * Database Synchronization Script
 * Synchronizes data between different databases in the hybrid architecture
 */

import { createServiceLogger } from '../../shared/utils/logger';
import dbManager from '../utils/DatabaseManager';
import dataSyncService from '../services/DataSyncService';
import config from '../../shared/config/index';

const logger = createServiceLogger('sync-databases');

/**
 * Main synchronization function
 */
async function syncDatabases(): Promise<void> {
  logger.info('Starting database synchronization...');
  
  try {
    // Initialize database connections
    await dbManager.initializeAll();
    logger.info('Database connections initialized');
    
    // Synchronize users
    logger.info('Synchronizing users...');
    const userSyncCount = await dataSyncService.syncAllUsers();
    logger.info(`Synchronized ${userSyncCount} users`);
    
    // Synchronize content
    logger.info('Synchronizing content...');
    const contentSyncCount = await dataSyncService.syncAllContent();
    logger.info(`Synchronized ${contentSyncCount} content items`);
    
    logger.info('Database synchronization completed successfully');
  } catch (error) {
    logger.error('Error during database synchronization', { error: (error as Error).message });
    process.exit(1);
  } finally {
    // Close database connections
    await dbManager.closeAll();
    logger.info('Database connections closed');
  }
}

// Run synchronization
syncDatabases();
