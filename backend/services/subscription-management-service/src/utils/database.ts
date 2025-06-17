import { DataSource, DataSourceOptions } from 'typeorm';
import logger from './logger';
import dotenv from 'dotenv';
import {
  App,
  SubscriptionPlan,
  PlanFeature,
  Subscription,
  Payment,
  SubscriptionEvent
} from '../entities';

// Load environment variables
dotenv.config();

// Initialize TypeORM DataSource
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.SUPABASE_DB_HOST || 'localhost',
  port: parseInt(process.env.SUPABASE_DB_PORT || '5432'),
  username: process.env.SUPABASE_DB_USER || 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [
    App,
    SubscriptionPlan,
    PlanFeature,
    Subscription,
    Payment,
    SubscriptionEvent
  ],
  migrations: [__dirname + '/../models/migrations/*.{js,ts}'],
  subscribers: [__dirname + '/../models/subscribers/*.{js,ts}'],
} as DataSourceOptions);

// Function to initialize TypeORM connection
export const initializeDatabase = async (): Promise<DataSource> => {
  try {
    const dataSource = await AppDataSource.initialize();
    logger.info('PostgreSQL connection initialized successfully');
    
    // Apply migrations if in production
    if (process.env.NODE_ENV === 'production') {
      try {
        await dataSource.runMigrations();
        logger.info('Database migrations applied successfully');
      } catch (migrationError) {
        logger.error('Error applying migrations:', migrationError);
      }
    }
    
    return dataSource;
  } catch (error) {
    logger.error('Error initializing PostgreSQL connection:', error);
    // Don't throw the error, just log it and return null to avoid crashing the service
    return null as unknown as DataSource;
  }
};

export default AppDataSource;
