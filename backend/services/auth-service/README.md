# Auth Service

## Overview

The Auth Service is a critical component of the SAP platform responsible for authentication, authorization, and security-related operations. This service has been fully migrated to TypeScript to provide enhanced type safety and improved code quality.

## Features

- **Authentication**: User login and token generation
- **Authorization**: Role-based access control
- **Password Management**: Reset and change password functionality
- **Token Management**: JWT token generation, validation, and refresh
- **Security**: Protection against common security threats
- **TypeScript Implementation**: Fully migrated to TypeScript for improved type safety
- **Centralized Logging**: Consistent logging across all services with structured formats
- **Performance Monitoring**: Track response times and system performance

## API Endpoints

### Authentication Endpoints

- `POST /api/auth/login`: User login
- `POST /api/auth/logout`: User logout
- `POST /api/auth/refresh-token`: Refresh access token
- `POST /api/auth/forgot-password`: Initiate password reset
- `POST /api/auth/reset-password`: Complete password reset
- `POST /api/auth/change-password`: Change user password
- `GET /api/auth/verify-email/:token`: Verify user email

## Technical Stack

- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Express Validator
- **Security**: Helmet, CORS, Rate Limiting

## Development Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Set up environment variables:
   ```
   PORT=3003
   MONGODB_URI=mongodb://localhost:27017/sap-auth
   JWT_SECRET=your-secret-key
   JWT_REFRESH_SECRET=your-refresh-secret
   JWT_EXPIRATION=1h
   JWT_REFRESH_EXPIRATION=7d
   EMAIL_SERVICE=smtp.example.com
   EMAIL_USER=your-email@example.com
   EMAIL_PASSWORD=your-email-password
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

The Auth Service has been fully migrated from JavaScript to TypeScript. This migration includes:

- Type definitions for all models and interfaces
- Improved error handling with typed errors
- Enhanced code readability and maintainability
- Better IDE support and code completion

### Key TypeScript Files

- `src/interfaces/auth.interfaces.ts`: Auth-related interfaces and types
- `src/controllers/auth.controller.ts`: Type-safe controller implementation
- `src/services/auth.service.ts`: Business logic with proper typing
- `src/middlewares/auth.middleware.ts`: Authentication middleware with TypeScript

## Testing

Run tests with:

```
npm test
```

## Security Considerations

- JWT authentication with proper expiration
- Refresh token rotation
- Password hashing using bcrypt
- Protection against brute force attacks
- CSRF protection
- Rate limiting for sensitive endpoints
- Secure HTTP headers with Helmet
- Input validation using express-validator

## Performance Optimizations

- Efficient token validation
- Caching of frequently accessed data
- Optimized database queries
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

## Maintainers

- SAP Platform Development Team
