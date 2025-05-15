# Database Setup Guide for SAP Project Backend

Based on the error logs, your backend application is trying to connect to several databases that are either not running or have incorrect credentials. Here's how to fix each issue:

## 1. PostgreSQL Setup

The error shows: `password authentication failed for user "postgres"`. This means the password in your configuration doesn't match what PostgreSQL is expecting.

### Option 1: Install PostgreSQL locally
1. Download and install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/)
2. During installation, set the password for the 'postgres' user to 'postgres' (or whatever you prefer)
3. Create a database named 'sap_db':
   ```sql
   CREATE DATABASE sap_db;
   ```

### Option 2: Update your configuration
If PostgreSQL is already installed but with a different password:
1. Create a `.env` file in the backend directory with:
   ```
   POSTGRES_PASSWORD=your_actual_password
   ```

## 2. MongoDB Setup

The error shows: `connect ECONNREFUSED ::1:27017`. This means MongoDB is not running.

### Install and run MongoDB:
1. Download and install MongoDB Community Edition from [mongodb.com](https://www.mongodb.com/try/download/community)
2. Start the MongoDB service
3. Alternatively, add to your `.env` file:
   ```
   MONGO_URI=mongodb://127.0.0.1:27017/sap-db
   ```
   (Using 127.0.0.1 instead of ::1 which is IPv6)

## 3. Redis Setup

The error shows: `connect ECONNREFUSED 127.0.0.1:6379`. This means Redis is not running.

### Install and run Redis:
1. For Windows, download and install Redis from [github.com/microsoftarchive/redis/releases](https://github.com/microsoftarchive/redis/releases)
2. Start the Redis service

## 4. Elasticsearch Setup

The error shows: `connect ECONNREFUSED ::1:9200`. This means Elasticsearch is not running.

### Install and run Elasticsearch:
1. Download and install Elasticsearch from [elastic.co](https://www.elastic.co/downloads/elasticsearch)
2. Start the Elasticsearch service

## Temporary Solution

If you want to run the application without setting up all these databases, you can modify the DatabaseManager.ts file to make the connections optional and prevent continuous reconnection attempts.

## Creating a .env file

Create a `.env` file in the backend directory with the following content:

```
# MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/sap-db

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=sap_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_postgres_password

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

Replace `your_postgres_password` with your actual PostgreSQL password.
