/**
 * TypeORM Configuration Utility
 * Provides a centralized TypeORM configuration for PostgreSQL with proper entity management,
 * migrations, and connection handling
 */

import { DataSource, EntityTarget, Repository, EntitySchema, ObjectLiteral } from 'typeorm';
import { createServiceLogger } from './logger';

// Initialize logger
const logger = createServiceLogger('typeorm');

// Define TypeORM configuration interface
interface TypeORMConfig {
  type: 'postgres';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  entities: string[];
  migrations: string[];
  synchronize: boolean;
  logging: boolean | 'all' | ('query' | 'schema' | 'error' | 'warn' | 'info' | 'log' | 'migration')[];
  maxQueryExecutionTime: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

// Default TypeORM configuration (updated for Supabase)
const defaultConfig: TypeORMConfig = {
  type: 'postgres',
  host: process.env.SUPABASE_DB_HOST || 'db.leaekgpafpvrvykeuvgk.supabase.co',
  port: parseInt(process.env.SUPABASE_DB_PORT || '5432'),
  username: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD || 'COLLoSSkT4atAoWZ',
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  entities: [
    process.env.NODE_ENV === 'production'
      ? 'dist/entities/**/*.entity.js'
      : 'src/entities/**/*.entity.ts'
  ],
  migrations: [], // Disabled migrations to avoid TypeORM errors
  synchronize: false, // Disable auto-synchronization to prevent conflicts with existing Supabase schema
  logging: process.env.NODE_ENV !== 'production' ? ['error', 'warn', 'schema', 'migration'] : ['error'],
  maxQueryExecutionTime: 1000, // Log queries taking longer than 1 second
  ssl: { rejectUnauthorized: false } // Supabase requires SSL connections
};

/**
 * TypeORM data source manager
 */
class TypeORMManager {
  private dataSource: DataSource | null = null;
  private repositories: Map<string, Repository<any>> = new Map();
  private isInitialized: boolean = false;

  /**
   * Initialize the TypeORM data source
   * @param config - TypeORM configuration
   * @returns TypeORM data source
   */
  async initialize(config: Partial<TypeORMConfig> = {}): Promise<DataSource> {
    if (this.isInitialized && this.dataSource) {
      logger.info('TypeORM data source already initialized');
      return this.dataSource;
    }

    try {
      const dataSourceConfig = { ...defaultConfig, ...config };
      
      this.dataSource = new DataSource(dataSourceConfig as any);
      await this.dataSource.initialize();
      
      this.isInitialized = true;
      logger.info('TypeORM data source initialized successfully');
      
      return this.dataSource;
    } catch (err) {
      logger.error('Error initializing TypeORM data source', { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Get the TypeORM data source
   * @returns TypeORM data source
   */
  getDataSource(): DataSource {
    if (!this.isInitialized || !this.dataSource) {
      throw new Error('TypeORM data source not initialized. Call initialize() first.');
    }
    
    return this.dataSource;
  }

  /**
   * Get a repository for an entity
   * @param entity - Entity class or name
   * @returns Repository for the entity
   */
  getRepository<T extends ObjectLiteral>(entity: EntityTarget<T>): Repository<T> {
    if (!this.isInitialized || !this.dataSource) {
      throw new Error('TypeORM data source not initialized. Call initialize() first.');
    }
    
    // Get a unique key for the entity
    let entityKey: string;
    if (typeof entity === 'string') {
      entityKey = entity;
    } else if (typeof entity === 'function') {
      // For class constructors
      entityKey = entity.name;
    } else if (entity instanceof EntitySchema) {
      // For EntitySchema instances
      entityKey = entity.options.name;
    } else if ('name' in entity) {
      // For objects with name property
      entityKey = entity.name;
    } else {
      // Fallback
      entityKey = JSON.stringify(entity);
    }
    
    if (!this.repositories.has(entityKey)) {
      const repository = this.dataSource.getRepository<T>(entity as any);
      this.repositories.set(entityKey, repository);
    }
    
    return this.repositories.get(entityKey) as Repository<T>;
  }

  /**
   * Run migrations
   * @returns Migration results
   */
  async runMigrations(): Promise<any> {
    if (!this.isInitialized || !this.dataSource) {
      throw new Error('TypeORM data source not initialized. Call initialize() first.');
    }
    
    try {
      const migrations = await this.dataSource.runMigrations();
      logger.info(`Successfully ran ${migrations.length} migrations`);
      return migrations;
    } catch (err) {
      logger.error('Error running migrations', { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Revert last migration
   * @returns Migration revert result
   */
  async revertLastMigration(): Promise<any> {
    if (!this.isInitialized || !this.dataSource) {
      throw new Error('TypeORM data source not initialized. Call initialize() first.');
    }
    
    try {
      const result = await this.dataSource.undoLastMigration();
      logger.info('Successfully reverted last migration');
      return result;
    } catch (err) {
      logger.error('Error reverting last migration', { error: (err as Error).message });
      throw err;
    }
  }

  /**
   * Close the TypeORM data source
   */
  async close(): Promise<void> {
    if (this.isInitialized && this.dataSource) {
      try {
        await this.dataSource.destroy();
        this.isInitialized = false;
        this.repositories.clear();
        logger.info('TypeORM data source closed');
      } catch (err) {
        logger.error('Error closing TypeORM data source', { error: (err as Error).message });
        throw err;
      }
    }
  }
}

// Create and export a singleton instance
const typeORMManager = new TypeORMManager();

export default typeORMManager;
