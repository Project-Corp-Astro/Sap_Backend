import { DataSource, DataSourceOptions, LoggerOptions } from 'typeorm';
import { Subscription } from '../entities/Subscription.entity';
import { SubscriptionPlan } from '../entities/SubscriptionPlan.entity';
import { PlanFeature } from '../entities/PlanFeature.entity';
import { Payment } from '../entities/Payment.entity';
import { PromoCode } from '../entities/PromoCode.entity';
import { SubscriptionEvent } from '../entities/SubscriptionEvent.entity';
import { SubscriptionPromoCode } from '../entities/SubscriptionPromoCode.entity';
import { PromoCodeApplicablePlan } from '../entities/PromoCodeApplicablePlan.entity';
import { PromoCodeApplicableUser } from '../entities/PromoCodeApplicableUser.entity';
import { App } from '../entities/App.entity';
import { SubscriptionAnalytics } from '../entities/SubscriptionAnalytics.entity';
import { supabaseClient } from '../utils/supabase';
import logger from '../utils/logger';

// Load environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';

// Use Supabase DB configuration from main .env file
const SUPABASE_DB_HOST = process.env.SUPABASE_DB_HOST || 'db.leaekgpafpvrvykeuvgk.supabase.co';
const SUPABASE_DB_PORT = parseInt(process.env.SUPABASE_DB_PORT || '5432', 10);
const SUPABASE_DB_USER = process.env.SUPABASE_DB_USER || 'postgres';
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || 'COLLoSSkT4atAoWZ';
const SUPABASE_DB_NAME = process.env.SUPABASE_DB_NAME || 'postgres';

// Fallback PostgreSQL config (should not be used now)
const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
const POSTGRES_PORT = parseInt(process.env.POSTGRES_PORT || '5432', 10);
const POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
const POSTGRES_DB = process.env.POSTGRES_DB || 'subscription_db';

// Common TypeORM config settings
const commonConfig = {
  name: 'default', // Important: this makes it the default connection
  type: 'postgres' as const,
  entities: [
    Subscription,
    SubscriptionPlan,
    PlanFeature,
    Payment,
    PromoCode,
    SubscriptionEvent,
    SubscriptionPromoCode,
    PromoCodeApplicablePlan,
    PromoCodeApplicableUser,
    App,
    SubscriptionAnalytics
  ],
  // Set to false initially to prevent automatic enum creation
  synchronize: false,
  logging: NODE_ENV === 'development',
  ssl: {
    rejectUnauthorized: false // This allows self-signed certificates
  }, // Required for Supabase connection
};

// Create TypeORM config based on available connection details
let dataSourceOptions: DataSourceOptions;

// Always use Supabase configuration from main .env file
logger.info('Using Supabase database configuration');
dataSourceOptions = {
  ...commonConfig,
  host: SUPABASE_DB_HOST,
  port: SUPABASE_DB_PORT,
  username: SUPABASE_DB_USER,
  password: SUPABASE_DB_PASSWORD,
  database: SUPABASE_DB_NAME,
  ssl: {
    rejectUnauthorized: false // This allows self-signed certificates
  }, // Required for Supabase connection
  synchronize: false // Disable auto synchronize to prevent enum conflicts
};

// Create and export DataSource
export const AppDataSource = new DataSource(dataSourceOptions);

// Initialize database connection with priority on Supabase
export const initializeDatabase = async (): Promise<DataSource> => {
  try {
    // First verify Supabase connection (primary connection method)
    try {
      // Check if Supabase client is available
      if (!supabaseClient) {
        logger.warn('Supabase client not available - skipping connection check');
      } else {
        logger.info('Verifying Supabase connection...');
        const { data, error } = await supabaseClient.from('subscriptions').select('count').limit(1);
        
        if (error) {
          logger.warn(`Supabase connection warning: ${error.message}`);
        } else {
          logger.info('✅ Supabase connection verified successfully');
        }
      }
    } catch (supaError) {
      logger.warn(`Supabase connection check failed: ${supaError instanceof Error ? supaError.message : String(supaError)}`);
      logger.warn('Continuing with TypeORM initialization, but Supabase functionality may be limited');
    }
    
    // Initialize TypeORM with connection details
    if (!AppDataSource.isInitialized) {
      logger.info(`Initializing TypeORM with ${process.env.SUPABASE_POSTGRES_CONNECTION_STRING ? 'Supabase connection string' : 'direct PostgreSQL connection'}...`);
      await AppDataSource.initialize();
      logger.info('✅ TypeORM database connection established successfully');
      
      // After connection is established, attempt to create tables manually if needed
      try {
        logger.info('Checking if schema needs to be created...');
        const queryRunner = AppDataSource.createQueryRunner();
        
        // Check if tables exist instead of using synchronize
        const tablesExist = await queryRunner.hasTable('subscription');
        
        if (!tablesExist) {
          logger.info('Creating schema manually to avoid enum conflicts...');
          // Create tables manually but don't recreate enums
          await AppDataSource.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
          
          // Generate schema but skip creating types that might already exist
          const sqlInMemory = await AppDataSource.driver.createSchemaBuilder().log();
          
          // Apply schema without enum recreation
          for (const query of sqlInMemory.upQueries) {
            // Skip queries that might recreate enums
            if (!query.query.includes('CREATE TYPE')) {
              try {
                await queryRunner.query(query.query);
              } catch (err: any) {
                // Log error but continue with other queries
                logger.warn(`Error executing query: ${err?.message || String(err)}`);
              }
            }
          }
          
          logger.info('Schema created successfully');
        } else {
          logger.info('Tables already exist, skipping schema creation');
        }
        
        await queryRunner.release();
      } catch (schemaError: any) {
        logger.warn(`Schema creation error: ${schemaError?.message || String(schemaError)}`);
        logger.warn('Continuing with limited functionality');
      }
    }

    return AppDataSource;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Database initialization failed: ${errorMessage}`);
    throw new Error(`Database initialization failed: ${errorMessage}`);
  }
};

// Helper to get repositories in a type-safe way
export const getAppRepository = <T extends object>(entity: new () => T) => {
  if (!AppDataSource.isInitialized) {
    throw new Error('Database connection not initialized. Call initializeDatabase() first.');
  }
  return AppDataSource.getRepository(entity);
};
