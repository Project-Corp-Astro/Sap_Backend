/**
 * Database Migration Management Script
 * 
 * This script helps manage migrations across all databases in our hybrid architecture.
 * It can:
 * - Generate migration files for PostgreSQL
 * - Run migrations for PostgreSQL
 * - Create indices for Elasticsearch
 * - Update MongoDB schemas
 */

import { createServiceLogger } from '../../shared/utils/logger';
import dbManager from '../utils/DatabaseManager';
import { SchemaService } from '../services/SchemaService';
import typeORMManager from '../../shared/utils/typeorm';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const logger = createServiceLogger('manage-migrations');
const execAsync = promisify(exec);

// Available commands
const COMMANDS = {
  GENERATE: 'generate',
  RUN: 'run',
  REVERT: 'revert',
  LIST: 'list',
  CREATE_ES_INDICES: 'create-es-indices',
  UPDATE_MONGO_SCHEMA: 'update-mongo-schema',
};

// Available database types
const DB_TYPES = {
  PG: 'pg',
  MONGO: 'mongo',
  ES: 'es',
  ALL: 'all',
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  const dbType = args[1] || DB_TYPES.ALL;
  const name = args[2] || '';

  return { command, dbType, name };
}

/**
 * Generate a migration file for PostgreSQL
 */
async function generatePgMigration(name: string): Promise<void> {
  if (!name) {
    logger.error('Migration name is required for generation');
    process.exit(1);
  }

  try {
    const timestamp = new Date().getTime();
    const fileName = `${timestamp}-${name}.ts`;
    const migrationDir = path.join(__dirname, '../migrations');
    
    // Create migrations directory if it doesn't exist
    if (!fs.existsSync(migrationDir)) {
      fs.mkdirSync(migrationDir, { recursive: true });
    }
    
    const migrationPath = path.join(migrationDir, fileName);
    const template = `import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, '')}${timestamp} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Migration up logic here
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Migration down logic here
  }
}
`;
    
    fs.writeFileSync(migrationPath, template);
    logger.info(`Generated PostgreSQL migration: ${fileName}`);
  } catch (error) {
    logger.error('Error generating PostgreSQL migration', { error: (error as Error).message });
    process.exit(1);
  }
}

/**
 * Run PostgreSQL migrations
 */
async function runPgMigrations(): Promise<void> {
  try {
    logger.info('Running PostgreSQL migrations...');
    
    // Initialize database connection
    await dbManager.connectPostgres();
    await dbManager.initializeTypeORM();
    
    // Get TypeORM data source
    const dataSource = typeORMManager.getDataSource();
    
    // Run migrations
    const migrations = await dataSource.runMigrations();
    
    logger.info(`PostgreSQL migrations completed successfully. Ran ${migrations.length} migrations.`);
  } catch (error) {
    logger.error('Error running PostgreSQL migrations', { error: (error as Error).message });
    process.exit(1);
  } finally {
    // Close database connection
    await dbManager.closeAll();
  }
}

/**
 * Revert the last PostgreSQL migration
 */
async function revertPgMigration(): Promise<void> {
  try {
    logger.info('Reverting last PostgreSQL migration...');
    
    // Initialize database connection
    await dbManager.connectPostgres();
    await dbManager.initializeTypeORM();
    
    // Get TypeORM data source
    const dataSource = typeORMManager.getDataSource();
    
    // Revert last migration
    await dataSource.undoLastMigration();
    
    logger.info('PostgreSQL migration reverted successfully');
  } catch (error) {
    logger.error('Error reverting PostgreSQL migration', { error: (error as Error).message });
    process.exit(1);
  } finally {
    // Close database connection
    await dbManager.closeAll();
  }
}

/**
 * List all PostgreSQL migrations and their status
 */
async function listPgMigrations(): Promise<void> {
  try {
    logger.info('Listing PostgreSQL migrations...');
    
    // Initialize database connection
    await dbManager.connectPostgres();
    await dbManager.initializeTypeORM();
    
    // Get TypeORM data source
    const dataSource = typeORMManager.getDataSource();
    
    // Get all migrations
    const pendingMigrations = await dataSource.showMigrations();
    const executedMigrations = await dataSource.query('SELECT * FROM migrations ORDER BY id DESC');
    
    console.log('\nPostgreSQL Migrations:');
    console.log('-----------------------');
    console.log('\nExecuted Migrations:');
    if (executedMigrations.length === 0) {
      console.log('No executed migrations found.');
    } else {
      executedMigrations.forEach((migration: any, index: number) => {
        console.log(`${index + 1}. ${migration.name} - Applied at ${new Date(migration.timestamp).toLocaleString()}`);
      });
    }
    
    console.log('\nPending Migrations:');
    if (!pendingMigrations) {
      console.log('No pending migrations found.');
    } else {
      console.log(`${pendingMigrations ? 'Yes, pending migrations exist.' : 'No pending migrations.'}`);
    }
    
    logger.info('PostgreSQL migrations listed successfully');
  } catch (error) {
    logger.error('Error listing PostgreSQL migrations', { error: (error as Error).message });
    process.exit(1);
  } finally {
    // Close database connection
    await dbManager.closeAll();
  }
}

/**
 * Create Elasticsearch indices
 */
async function createEsIndices(): Promise<void> {
  try {
    logger.info('Creating Elasticsearch indices...');
    
    // Initialize database connection
    await dbManager.connectElasticsearch();
    
    // Create indices
    const schemaService = new SchemaService();
    await schemaService.createEsIndices();
    
    logger.info('Elasticsearch indices created successfully');
  } catch (error) {
    logger.error('Error creating Elasticsearch indices', { error: (error as Error).message });
    logger.warn('Skipping Elasticsearch indices creation as Elasticsearch is disabled');
    // Don't exit, just continue
  } finally {
    // Close database connection
    await dbManager.closeAll();
  }
}

/**
 * Update MongoDB schema
 */
async function updateMongoSchema(): Promise<void> {
  try {
    logger.info('Updating MongoDB schema...');
    
    // Initialize database connection
    await dbManager.connectMongo();
    
    // Update schema
    const schemaService = new SchemaService();
    await schemaService.syncMongoSchemas();
    
    logger.info('MongoDB schema updated successfully');
  } catch (error) {
    logger.error('Error updating MongoDB schema', { error: (error as Error).message });
    process.exit(1);
  } finally {
    // Close database connection
    await dbManager.closeAll();
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const { command, dbType, name } = parseArgs();
  
  logger.info('Starting migration management', { command, dbType, name });
  
  try {
    switch (command) {
      case COMMANDS.GENERATE:
        if (dbType === DB_TYPES.PG || dbType === DB_TYPES.ALL) {
          await generatePgMigration(name);
        } else {
          logger.error(`Migration generation not supported for ${dbType}`);
        }
        break;
        
      case COMMANDS.RUN:
        if (dbType === DB_TYPES.PG || dbType === DB_TYPES.ALL) {
          await runPgMigrations();
        }
        if (dbType === DB_TYPES.ES || dbType === DB_TYPES.ALL) {
          await createEsIndices();
        }
        if (dbType === DB_TYPES.MONGO || dbType === DB_TYPES.ALL) {
          await updateMongoSchema();
        }
        break;
        
      case COMMANDS.REVERT:
        if (dbType === DB_TYPES.PG || dbType === DB_TYPES.ALL) {
          await revertPgMigration();
        } else {
          logger.error(`Migration reversion not supported for ${dbType}`);
        }
        break;
        
      case COMMANDS.LIST:
        if (dbType === DB_TYPES.PG || dbType === DB_TYPES.ALL) {
          await listPgMigrations();
        } else {
          logger.error(`Migration listing not supported for ${dbType}`);
        }
        break;
        
      case COMMANDS.CREATE_ES_INDICES:
        await createEsIndices();
        break;
        
      case COMMANDS.UPDATE_MONGO_SCHEMA:
        await updateMongoSchema();
        break;
        
      default:
        logger.error(`Unknown command: ${command}`);
        console.log(`
Available commands:
  ${COMMANDS.GENERATE} [pg] [name]     - Generate a new migration
  ${COMMANDS.RUN} [db-type]            - Run migrations
  ${COMMANDS.REVERT} [pg]              - Revert the last migration
  ${COMMANDS.LIST} [pg]                - List all migrations
  ${COMMANDS.CREATE_ES_INDICES}        - Create Elasticsearch indices
  ${COMMANDS.UPDATE_MONGO_SCHEMA}      - Update MongoDB schema

Available database types:
  ${DB_TYPES.PG}    - PostgreSQL
  ${DB_TYPES.MONGO} - MongoDB
  ${DB_TYPES.ES}    - Elasticsearch
  ${DB_TYPES.ALL}   - All databases (default)
        `);
        process.exit(1);
    }
    
    logger.info('Migration management completed successfully');
  } catch (error) {
    logger.error('Error during migration management', { error: (error as Error).message });
    process.exit(1);
  }
}

// Run main function
main();
