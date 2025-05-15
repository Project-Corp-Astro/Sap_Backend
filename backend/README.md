# SAP Project - Backend Services

## Latest Updates

### Performance Monitoring and Logging System

We've implemented a comprehensive performance monitoring and centralized logging system across all services to improve observability, debugging, and performance optimization.

#### Performance Monitoring Features

- **Response Time Tracking**: Measure and analyze API response times
- **Cache Effectiveness**: Monitor cache hit/miss rates
- **Database Performance**: Track query execution times
- **System Resource Usage**: Monitor CPU and memory utilization
- **Health Check Endpoints**: Verify service status and performance

#### Centralized Logging System

- **Shared Logger Package**: Common logging utility (`@sap/logger`) for all services
- **Structured Logging**: Consistent log format with metadata
- **Log Rotation**: Automatic file rotation and archiving
- **Request Logging**: HTTP request tracking with customizable formats
- **Error Logging**: Enhanced error tracking with stack traces

## TypeScript Migration Complete

All backend microservices have been successfully migrated to TypeScript, providing improved type safety, better developer experience, and enhanced code quality.

### Migrated Services

- **User Service**: Complete TypeScript implementation with models, controllers, routes, and middleware
  - Converted all models with proper interfaces and type definitions
  - Added TypeScript interfaces for request/response objects
  - Implemented strict type checking for controller methods
  - Enhanced middleware with proper typing

- **Auth Service**: Full TypeScript migration with proper interfaces and type definitions
  - Converted authentication flows with type-safe implementations
  - Added JWT token type definitions
  - Implemented typed error handling
  - Enhanced security with type-safe validation

- **Content Service**: TypeScript conversion with comprehensive test coverage
  - Migrated all models, controllers, services, and routes
  - Added proper interfaces for media and video content
  - Implemented typed mock services for testing
  - Created TypeScript declaration files for test utilities
  - Fixed all TypeScript errors while maintaining test coverage

### TypeScript Configuration

- **tsconfig.json**: Optimized for each service with appropriate settings
- **tsconfig.test.json**: Specialized configuration for testing environments
- **Module Resolution**: Configured for ES modules with proper extension handling
- **Type Declarations**: Added for external dependencies and shared utilities
- **Jest Configuration**: Updated for TypeScript compatibility

### Architecture Overview

This project implements a hybrid database architecture using PostgreSQL, MongoDB, Redis, and Elasticsearch to leverage the strengths of each database system for different aspects of the application.

## Architecture Overview

The hybrid database architecture combines multiple database technologies to optimize different aspects of the application:

- **PostgreSQL**: Relational data, transactions, user authentication, and permissions
- **MongoDB**: Content management, user profiles, flexible data storage
- **Redis**: Caching, session management, real-time features
- **Elasticsearch**: Full-text search, complex queries, analytics

## Directory Structure

```
backend/
├── shared/             # Shared utilities and configuration
│   └── utils/
│       ├── database.ts     # MongoDB connection utility
│       ├── postgres.ts     # PostgreSQL connection utility
│       ├── redis.ts        # Redis connection utility
│       ├── elasticsearch.ts # Elasticsearch connection utility
│       └── typeorm.ts      # TypeORM configuration utility
├── src/
│   ├── config/         # Configuration files
│   │   └── database.config.ts # Database configuration
│   ├── controllers/    # API controllers
│   │   └── HealthController.ts # Health check controller
│   ├── entities/       # TypeORM entity models
│   │   ├── User.entity.ts
│   │   ├── Role.entity.ts
│   │   ├── Permission.entity.ts
│   │   └── UserSession.entity.ts
│   ├── middlewares/    # Express middlewares
│   │   └── authMiddleware.ts # Authentication middleware
│   ├── migrations/     # Database migrations
│   │   └── 1620000000000-InitialSchema.ts # Initial schema migration
│   ├── repositories/   # Data access repositories
│   │   ├── BaseRepository.ts
│   │   ├── UserRepository.ts
│   │   └── RoleRepository.ts
│   ├── routes/         # API routes
│   │   └── health.routes.ts # Health check routes
│   ├── scripts/        # Utility scripts
│   │   ├── pg-seed.ts       # PostgreSQL seed script
│   │   ├── es-init.ts       # Elasticsearch initialization script
│   │   ├── es-reindex.ts    # Elasticsearch reindexing script
│   │   ├── sync-databases.ts # Database synchronization script
│   │   └── init-databases.ts # Database initialization script
│   ├── services/       # Business logic services
│   │   ├── AuthService.ts   # Authentication service
│   │   ├── CacheService.ts  # Cache service
│   │   ├── DataSyncService.ts # Data synchronization service
│   │   ├── SchemaService.ts # Schema management service
│   │   ├── SearchService.ts # Search service
│   │   └── TransactionService.ts # Transaction service
│   ├── utils/          # Utility functions
│   │   └── DatabaseManager.ts # Database connection manager
│   ├── app.ts          # Express application setup
│   └── server.ts       # Server entry point
└── ormconfig.ts        # TypeORM configuration
```

## Key Components

### Database Connection Manager

The `DatabaseManager` class provides a centralized point for connecting to and managing multiple databases. It handles connection pooling, error handling, and graceful shutdown.

### Authentication Middleware

The authentication middleware uses PostgreSQL for user data and Redis for session management. It provides JWT-based authentication, role-based access control, and permission-based authorization.

### Data Synchronization Service

The `DataSyncService` keeps data synchronized between different databases. It handles user synchronization between MongoDB and PostgreSQL, and content synchronization between MongoDB and Elasticsearch.

### Transaction Service

The `TransactionService` provides functionality for handling transactions across multiple databases. It supports PostgreSQL transactions, MongoDB transactions, and hybrid transactions that span both databases.

### Schema Service

The `SchemaService` manages database schemas and migrations across the hybrid architecture. It handles PostgreSQL migrations, MongoDB schema synchronization, and Elasticsearch index creation.

### Cache Service

The `CacheService` provides caching functionality using Redis. It supports key-value caching, set operations, hash operations, and distributed locks.

### Search Service

The `SearchService` provides search functionality using Elasticsearch. It supports content search, user search, and autocomplete suggestions.

## Setup and Configuration

### Environment Variables

The application uses the following environment variables for database connections:

```
# MongoDB
MONGO_URI=mongodb://localhost:27017/sap-db

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=sap_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=
```

### Installation

1. Install dependencies:

```bash
npm install --legacy-peer-deps
```

2. Initialize databases:

```bash
npm run init-databases
```

3. Run database migrations:

```bash
npm run migrate
```

4. Seed the database:

```bash
npm run seed
```

### Running the Application

```bash
npm run dev
```

## API Endpoints

### Health Check

- `GET /health`: Simple health check
- `GET /health/detailed`: Detailed health check with database status
- `GET /health/database/:type`: Database-specific health check

## Scripts

- `npm run migrate`: Run PostgreSQL migrations
- `npm run seed`: Seed the PostgreSQL database
- `npm run es-init`: Initialize Elasticsearch indices
- `npm run es-reindex`: Reindex data from MongoDB to Elasticsearch
- `npm run sync-databases`: Synchronize data between databases
- `npm run init-databases`: Initialize all databases

## Development

### Adding a New Entity

1. Create a new entity file in `src/entities/`
2. Create a new repository in `src/repositories/`
3. Add the entity to the TypeORM configuration in `ormconfig.ts`
4. Create a migration to add the entity to the database:

```bash
npm run migration:create -- -n AddNewEntity
```

### Adding a New Index to Elasticsearch

1. Update the index configuration in `src/scripts/es-init.ts`
2. Run the Elasticsearch initialization script:

```bash
npm run es-init
```

## Troubleshooting

### Database Connection Issues

If you encounter database connection issues, check the following:

1. Ensure all database services are running
2. Verify environment variables are correctly set
3. Check database logs for errors
4. Run the health check endpoint to diagnose connection issues:

```bash
curl http://localhost:3000/health/detailed
```

### Data Synchronization Issues

If data is not properly synchronized between databases:

1. Run the database synchronization script:

```bash
npm run sync-databases
```

2. Check the logs for synchronization errors
3. Verify that the data exists in the source database

## License

This project is licensed under the MIT License - see the LICENSE file for details.
