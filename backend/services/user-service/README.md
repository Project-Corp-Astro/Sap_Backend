# User Service

## Overview

The User Service is a core component of the SAP platform that handles user management, authentication, and user-related operations. This service is built with TypeScript, Express.js, and MongoDB, providing a robust and type-safe implementation for managing user data.

## Features

- **User Management**: Create, read, update, and delete user accounts
- **Profile Management**: Update user profiles and preferences
- **User Activity Tracking**: Monitor user actions and engagement
- **Device Management**: Track and manage user devices
- **TypeScript Implementation**: Fully migrated to TypeScript for improved type safety and developer experience
- **Centralized Logging**: Consistent logging across all services with structured formats
- **Performance Monitoring**: Track response times and system performance

## API Endpoints

### User Endpoints

- `POST /api/users`: Create a new user
- `GET /api/users`: Get all users (with pagination and filtering)
- `GET /api/users/:userId`: Get user by ID
- `PUT /api/users/:userId`: Update user
- `DELETE /api/users/:userId`: Delete user
- `GET /api/users/profile`: Get current user profile
- `PUT /api/users/profile`: Update current user profile
- `GET /api/users/activity`: Get user activity history

## Technical Stack

- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express Validator

## Development Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Set up environment variables:
   ```
   PORT=3001
   MONGODB_URI=mongodb://localhost:27017/sap-users
   JWT_SECRET=your-secret-key
   JWT_EXPIRATION=1d
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Build for production:
   ```
   npm run build
   ```

5. Start production server:
   ```
   npm start
   ```

## TypeScript Migration

The User Service has been fully migrated from JavaScript to TypeScript. This migration includes:

- Type definitions for all models and interfaces
- Improved error handling with typed errors
- Enhanced code readability and maintainability
- Better IDE support and code completion
- Middleware compatibility with TypeScript
- Comprehensive test suite compatibility with TypeScript

### Key TypeScript Files

- `src/interfaces/user.interfaces.ts`: User-related interfaces and types
- `src/models/User.ts`: TypeScript User model with Mongoose
- `src/controllers/user.controller.ts`: Type-safe controller implementation
- `src/services/user.service.ts`: Business logic with proper typing
- `src/middlewares/auth.middleware.ts`: Authentication middleware with TypeScript
- `src/types/express.d.ts`: Express request augmentation for TypeScript compatibility

## Testing

The service includes a comprehensive test suite using Jest and Supertest. All tests have been updated to work with TypeScript.

Run tests with:

```
npm test
```

### Test Coverage

- **Model Tests**: Validate schema constraints, methods, and database operations
- **Controller Tests**: Verify request handling and response formatting
- **Route Tests**: Ensure proper middleware application and controller integration
- **Performance Tests**: Validate monitoring and metrics collection
- **TypeScript Compatibility**: All tests work with TypeScript types and interfaces

## Security Considerations

- JWT authentication for secure API access
- Password hashing using bcrypt
- Role-based access control
- Input validation using express-validator
- TypeScript type checking to prevent type-related bugs

## Performance Optimizations

- Efficient database queries with proper indexing
- Pagination for list endpoints
- Selective field projection to minimize response size
- TypeScript compilation optimizations
- Response time tracking for all API endpoints
- Performance metrics collection and analysis

## Centralized Logging

We've implemented a shared logging utility (`@sap/logger`) that provides:

- **Structured Logging**: Consistent log format across all services
- **Log Levels**: Different levels (debug, info, warn, error) for better filtering
- **Transport Options**: Console and file logging with rotation
- **Request Logging**: HTTP request logging with customizable format
- **Error Logging**: Detailed error logging with stack traces

## Error Handling

The service implements a standardized error handling approach:

- HTTP status codes for different error types
- Consistent error response format
- Detailed error messages for debugging
- TypeScript error interfaces for type safety

## Recent Improvements (May 2025)

- Fixed TypeScript compatibility issues in middleware and route handlers
- Improved type definitions for Express request objects
- Enhanced test suite compatibility with TypeScript
- Added proper mocking for external dependencies in tests
- Implemented performance monitoring for database operations
- Added centralized logging with TypeScript support
- Fixed unique constraint tests in model validation

## Maintainers

- SAP Platform Development Team
