# Development Environment Setup

This guide will help you set up your local development environment for the Corp Astro Super Admin Panel (SAP) backend.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Git**: Latest version
- **Docker**: Latest version (optional, but recommended)
- **MongoDB**: v5.0 or higher (can be run in Docker)
- **Redis**: v6.0 or higher (can be run in Docker)
- **Elasticsearch**: v7.0 or higher (optional, can be run in Docker)
- **PostgreSQL**: v14.0 or higher (optional, can be run in Docker)

## Setting Up the Development Environment

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/Project-Corp-Astro/Sap_Backend.git

# Navigate to the project directory
cd Sap_Backend
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install --legacy-peer-deps

# Install shared types
cd shared/types
npm install
cd ../..

# Install API Gateway dependencies
cd api-gateway
npm install
cd ..

# Install service dependencies
cd services/auth-service
npm install
cd ../user-service
npm install
cd ../content-service
npm install
cd ../..
```

### 3. Set Up Environment Variables

Create `.env` files for each service based on the provided examples:

```bash
# Copy example environment files
cp .env.example .env
cp api-gateway/.env.example api-gateway/.env
cp services/auth-service/.env.example services/auth-service/.env
cp services/user-service/.env.example services/user-service/.env
cp services/content-service/.env.example services/content-service/.env
```

Edit the `.env` files to configure your local environment settings.

### 4. Set Up Databases

#### Option 1: Using Docker Compose (Recommended)

The project includes a Docker Compose configuration for setting up all required databases:

```bash
# Start all databases
docker-compose up -d mongodb redis elasticsearch postgres

# Verify containers are running
docker-compose ps
```

#### Option 2: Manual Database Setup

If you prefer to run databases directly on your machine:

**MongoDB**:
- Install MongoDB Community Edition
- Create a database named `sap-db`
- Update the MongoDB connection string in your `.env` files

**Redis**:
- Install Redis Server
- Update Redis connection details in your `.env` files

**Elasticsearch** (optional):
- Install Elasticsearch
- Update Elasticsearch connection details in your `.env` files

**PostgreSQL** (optional):
- Install PostgreSQL
- Create a database named `sap_db`
- Update PostgreSQL connection details in your `.env` files

### 5. Initialize Databases

```bash
# Initialize all databases
npm run db:init

# Run migrations
npm run db:migrate:run

# Seed the database with initial data
npm run db:seed

# Initialize Elasticsearch indices (if using Elasticsearch)
npm run db:es:indices
```

## Running the Application

### Development Mode

You can run individual services or all services together:

```bash
# Run all services in development mode
npm run dev

# Run specific services
npm run dev:gateway    # API Gateway
npm run dev:auth       # Auth Service
npm run dev:user       # User Service
npm run dev:content    # Content Service
```

The services will be available at:
- API Gateway: http://localhost:5000
- Auth Service: http://localhost:5001
- User Service: http://localhost:5002
- Content Service: http://localhost:5003

### Running with Docker

You can also run the entire application stack using Docker Compose:

```bash
# Build and start all services
docker-compose up --build

# Build and start specific services
docker-compose up --build api-gateway auth-service
```

## Verifying Installation

### Health Check Endpoints

Each service provides a health check endpoint:

```bash
# API Gateway health check
curl http://localhost:5000/health

# Auth Service health check
curl http://localhost:5001/health

# User Service health check
curl http://localhost:5002/health

# Content Service health check
curl http://localhost:5003/health
```

### API Documentation

API documentation is available at:

- Swagger UI: http://localhost:5000/api-docs
- GraphQL Playground: http://localhost:5000/graphql

## IDE Setup

### Visual Studio Code

We recommend using Visual Studio Code with the following extensions:

- **ESLint**: JavaScript linting
- **Prettier**: Code formatting
- **TypeScript**: TypeScript language support
- **MongoDB for VS Code**: MongoDB integration
- **Redis**: Redis integration
- **Docker**: Docker integration
- **REST Client**: API testing
- **GitLens**: Git integration

#### Recommended VS Code Settings

Create or update `.vscode/settings.json` with:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["javascript", "typescript"],
  "typescript.tsdk": "node_modules/typescript/lib",
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true
}
```

## Debugging

### Debugging in VS Code

Create a `.vscode/launch.json` file:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API Gateway",
      "program": "${workspaceFolder}/api-gateway/src/server.ts",
      "preLaunchTask": "tsc: build - api-gateway/tsconfig.json",
      "outFiles": ["${workspaceFolder}/api-gateway/dist/**/*.js"],
      "envFile": "${workspaceFolder}/api-gateway/.env",
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Auth Service",
      "program": "${workspaceFolder}/services/auth-service/src/server.ts",
      "preLaunchTask": "tsc: build - services/auth-service/tsconfig.json",
      "outFiles": ["${workspaceFolder}/services/auth-service/dist/**/*.js"],
      "envFile": "${workspaceFolder}/services/auth-service/.env",
      "console": "integratedTerminal"
    }
    // Add similar configurations for other services
  ]
}
```

### Debugging with Node.js Inspector

You can also debug using the Node.js inspector:

```bash
# Debug API Gateway
NODE_OPTIONS=--inspect npm run dev:gateway

# Debug Auth Service
NODE_OPTIONS=--inspect=9229 npm run dev:auth
```

Then connect to the debugger using Chrome DevTools or VS Code.

## Troubleshooting

### Common Issues

#### MongoDB Connection Issues

If you encounter MongoDB connection issues:
- Verify MongoDB is running: `docker ps | grep mongo` or `systemctl status mongodb`
- Check MongoDB connection string in `.env` files
- Ensure network connectivity to MongoDB

#### Redis Connection Issues

If you encounter Redis connection issues:
- Verify Redis is running: `docker ps | grep redis` or `systemctl status redis`
- Check Redis connection details in `.env` files
- Ensure network connectivity to Redis

#### TypeScript Compilation Errors

If you encounter TypeScript compilation errors:
- Run `npm run build` to see detailed errors
- Check `tsconfig.json` settings
- Ensure all dependencies are installed

#### Port Already in Use

If you encounter "port already in use" errors:
- Check if another process is using the port: `lsof -i :<port>`
- Kill the process: `kill -9 <pid>`
- Or change the port in the `.env` file

## Next Steps

After setting up your development environment, you can:
- Read the [Coding Standards](./coding-standards.md) guide
- Learn about [Testing](./testing.md) the application
- Explore the [Architecture](../architecture/README.md) documentation
- Start [Adding New Features](./adding-features.md)

If you encounter any issues not covered in this guide, please refer to the [Troubleshooting](../README.md#troubleshooting) section in the main documentation or open an issue on GitHub.
