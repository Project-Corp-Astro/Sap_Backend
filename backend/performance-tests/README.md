# SAP Project Performance Tests

This directory contains performance tests for the SAP Project TypeScript-migrated microservices. These tests help ensure that the TypeScript migration hasn't affected service performance.

## Test Coverage

The performance tests cover the following services:

1. **Auth Service**
   - User registration
   - User login
   - Profile retrieval
   - Token refresh
   - Logout

2. **User Service**
   - User retrieval
   - User profile updates
   - User activity tracking
   - User device management

3. **Content Service**
   - Content creation
   - Content retrieval
   - Content updates
   - Content analytics
   - Content search

## Prerequisites

Before running the performance tests, make sure you have:

1. Node.js (v14 or higher) installed
2. k6 load testing tool installed (https://k6.io/docs/getting-started/installation/)
3. All three services (Auth, User, Content) running locally

## Setup

1. Install dependencies:

```bash
cd backend/performance-tests
npm install
```

2. Build the TypeScript tests:

```bash
npm run build
```

## Running the Tests

To run all performance tests:

```bash
npm run test:all
```

To run tests for a specific service:

```bash
# Auth Service
npm run test:auth

# User Service
npm run test:user

# Content Service
npm run test:content
```

## Test Configuration

The performance tests are configured with the following parameters:

- **Virtual Users (VUs)**: Ramps up to 20 concurrent users
- **Duration**: 2 minutes total (30s ramp-up, 1m steady, 30s ramp-down)
- **Thresholds**:
  - 95% of requests should complete in under 500ms
  - Error rate should be less than 10%

You can adjust these parameters in the individual test files if needed.

## Test Results

The test results are saved in the `results` directory in JSON format. You can use these results to:

1. Compare performance before and after the TypeScript migration
2. Identify performance bottlenecks
3. Track performance improvements over time

## Notes

- The tests create temporary test users and content that are cleaned up after the tests complete
- Each test includes proper setup and teardown phases
- The tests are written in TypeScript and compiled to JavaScript using webpack
- The tests use k6's built-in metrics for tracking performance

## Troubleshooting

If you encounter issues running the tests:

1. Make sure all services are running and accessible at their expected URLs
2. Check that k6 is installed correctly
3. Verify that the webpack build completed successfully
4. Check for any TypeScript errors in the test files
