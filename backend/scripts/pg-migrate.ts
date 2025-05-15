/**
 * PostgreSQL Migration Script
 * Runs TypeORM migrations to set up and update the PostgreSQL database schema
 */

import 'reflect-metadata';
import typeORMManager from '../shared/utils/typeorm';
import { createServiceLogger } from '../shared/utils/logger';

const logger = createServiceLogger('pg-migrate');

async function runMigrations() {
  try {
    logger.info('Initializing TypeORM data source');
    await typeORMManager.initialize();
    
    logger.info('Running migrations');
    const migrations = await typeORMManager.runMigrations();
    
    if (migrations.length === 0) {
      logger.info('No migrations to run');
    } else {
      logger.info(`Successfully ran ${migrations.length} migrations`);
      migrations.forEach((migration) => {
        logger.info(`- ${migration.name}`);
      });
    }
    
    await typeORMManager.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error running migrations', { error: (error as Error).message });
    await typeORMManager.close();
    process.exit(1);
  }
}

// Run migrations
runMigrations();
