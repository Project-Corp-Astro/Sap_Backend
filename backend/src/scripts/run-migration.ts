import typeORMManager from '../../shared/utils/typeorm';
import { createServiceLogger } from '../../shared/utils/logger';

const logger = createServiceLogger('migration');

async function runMigration() {
  try {
    logger.info('Initializing TypeORM...');
    await typeORMManager.initialize();
    
    logger.info('Running migrations...');
    await typeORMManager.runMigrations();
    
    logger.info('Migrations completed successfully');
  } catch (error) {
    logger.error('Error running migrations:', { error: (error as Error).message });
    process.exit(1);
  }
}

runMigration();
