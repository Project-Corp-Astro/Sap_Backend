import 'dotenv/config';

/**
 * MongoDB configuration interface
 */
interface MongoDBConfig {
  uri: string;
  options: {
    useNewUrlParser: boolean;
    useUnifiedTopology: boolean;
  };
}

/**
 * JWT configuration interface
 */
interface JWTConfig {
  secret: string;
  expiresIn: string;
  refreshExpiresIn: string;
}

/**
 * Redis configuration interface
 */
interface RedisConfig {
  host: string;
  port: number;
  password: string;
}

/**
 * Service configuration interface
 */
interface ServiceConfig {
  env: string;
  port: number;
  mongodb: MongoDBConfig;
  jwt: JWTConfig;
  redis: RedisConfig;
}

/**
 * Content service configuration
 */
const config: ServiceConfig = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.CONTENT_SERVICE_PORT || '3003', 10),
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/content-service',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },
};

export default config;
