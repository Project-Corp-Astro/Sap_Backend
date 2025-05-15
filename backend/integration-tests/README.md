# SAP Project Integration Tests

This directory contains integration tests for the SAP Project microservices. These tests verify that the TypeScript-migrated services work together correctly and maintain their expected functionality.

## Test Coverage

The integration tests cover the following scenarios:

1. **Auth and User Service Integration**
   - User registration and authentication flow
   - User data management
   - Authentication requirements and token handling

2. **End-to-End Integration**
   - Complete user journey across all three services (Auth, User, Content)
   - Content creation, retrieval, update, and deletion
   - Content analytics and search functionality
   - Cross-service interactions and data consistency

## Prerequisites

Before running the integration tests, make sure you have:

1. Node.js (v14 or higher) installed
2. MongoDB running locally or accessible via connection string
3. All three services (Auth, User, Content) running locally

## Setup

1. Install dependencies:

```bash
cd backend/integration-tests
npm install
```

2. Create a `.env` file in the `integration-tests` directory with the following variables:

```env
# Service URLs
AUTH_SERVICE_URL=http://localhost:3001/api/auth
USER_SERVICE_URL=http://localhost:3002/api/users
CONTENT_SERVICE_URL=http://localhost:3003/api/content

# Test configuration
TEST_TIMEOUT=30000
```

## Running the Tests

To run all integration tests:

```bash
npm test
```

To run a specific test file:

```bash
npm test -- -t "Auth and User Service Integration"
```

To run tests with coverage:

```bash
npm run test:coverage
```

## Test Structure

The tests are organized as follows:

- `src/utils/` - Utility functions and service clients
- `src/tests/` - Test files
  - `auth-user-integration.test.ts` - Tests for Auth and User service integration
  - `end-to-end.test.ts` - End-to-end tests across all services

## Notes

- The tests use an in-memory MongoDB server for testing, so they don't affect your actual database.
- All tests are isolated and clean up after themselves.
- The tests assume that all services have been successfully migrated to TypeScript.
- If a test fails, check the error message for details on what went wrong.

## Troubleshooting

If you encounter issues running the tests:

1. Make sure all services are running and accessible at their expected URLs
2. Check that MongoDB is running and accessible
3. Verify that all TypeScript migrations have been completed successfully
4. Check for any TypeScript errors in the services
5. Ensure all dependencies are installed correctly
