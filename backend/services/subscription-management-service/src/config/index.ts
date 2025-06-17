import 'dotenv/config';
import { DataSourceOptions } from 'typeorm';

/**
 * TypeORM configuration interface
 */
interface TypeORMConfig {
  type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  entities: string[];
  migrations: string[];
  subscribers: string[];
  synchronize: boolean;
  logging: boolean;
}

/**
 * MongoDB configuration interface
 */
interface MongoDBConfig {
  uri: string;
  options: {
    useNewUrlParser: boolean;
    useUnifiedTopology: boolean;
    family?: number;
  };
}

/**
 * Redis configuration interface
 */
interface RedisConfig {
  host: string;
  port: number;
  password: string;
  username?: string;
  db?: number;
}

/**
 * Elasticsearch configuration interface
 */
interface ElasticsearchConfig {
  node: string;
  auth: {
    username: string;
    password: string;
  };
  ssl: {
    rejectUnauthorized: boolean;
  };
}

/**
 * Supabase configuration interface
 */
interface SupabaseConfig {
  url: string;
  key: string;
  serviceRoleKey?: string;
}

/**
 * Service configuration interface
 */
interface ServiceConfig {
  env: string;
  port: number;
  serviceName: string;
  mongodb: MongoDBConfig;
  postgres: TypeORMConfig;
  redis: RedisConfig;
  elasticsearch: ElasticsearchConfig;
  supabase: SupabaseConfig;
}

/**
 * Subscription service configuration
 */
const config: ServiceConfig = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.SUBSCRIPTION_SERVICE_PORT || '3003', 10),
  serviceName: 'subscription-service',
  mongodb: {
    uri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sap-subscriptions',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      family: 4 // Force IPv4 to avoid connection issues
    },
  },
  postgres: {
    type: 'postgres',
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    username: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: process.env.PG_DATABASE || 'subscriptions',
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
    entities: ['src/models/entities/**/*.entity.{ts,js}'],
    migrations: ['src/models/migrations/**/*.{ts,js}'],
    subscribers: ['src/models/subscribers/**/*.subscriber.{ts,js}'],
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    username: process.env.REDIS_USERNAME || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  elasticsearch: {
    node: process.env.ES_NODE || 'http://localhost:9200',
    auth: {
      username: process.env.ES_USERNAME || 'elastic',
      password: process.env.ES_PASSWORD || 'changeme',
    },
    ssl: {
      rejectUnauthorized: false,
    },
  },
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
};

export default config;
