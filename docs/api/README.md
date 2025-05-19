# API Documentation

This section provides comprehensive documentation for the APIs exposed by the Corp Astro Super Admin Panel (SAP) backend services.

## Contents

- [API Overview](./overview.md) - Introduction to the API architecture
- [Authentication](./authentication.md) - Authentication endpoints and mechanisms
- [User Management](./user-management.md) - User-related API endpoints
- [Content Management](./content-management.md) - Content-related API endpoints

## API Structure

The Corp Astro SAP exposes APIs through multiple interfaces:

1. **REST APIs**: Traditional HTTP-based APIs for most operations
2. **GraphQL API**: Flexible data fetching for complex UI needs
3. **WebSocket API**: Real-time communication for notifications and updates

All APIs are accessible through the API Gateway at `https://api.corpastro.com` or locally at `http://localhost:5000`.

## API Versioning

APIs are versioned to ensure backward compatibility:

- REST APIs: `/api/v1/resource`
- GraphQL API: Schema versioning through directives

When a breaking change is necessary, a new version is created while maintaining the old version for a deprecation period.

## Common API Patterns

### REST API Structure

REST APIs follow a consistent structure:

```
/api/v{version}/{resource}
```

Examples:
- `GET /api/v1/users` - List users
- `GET /api/v1/users/{id}` - Get a specific user
- `POST /api/v1/users` - Create a user
- `PUT /api/v1/users/{id}` - Update a user
- `DELETE /api/v1/users/{id}` - Delete a user

### Request Format

REST API requests typically use:

- **GET/DELETE**: Query parameters for filtering and pagination
- **POST/PUT/PATCH**: JSON body for data

Example POST request:

```json
POST /api/v1/users
Content-Type: application/json
Authorization: Bearer {token}

{
  "email": "user@example.com",
  "password": "securePassword123",
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "birthDate": "1990-01-01"
  },
  "roles": ["user"]
}
```

### Response Format

REST API responses follow a consistent format:

```json
{
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2025-05-20T00:26:52+05:30",
    "requestId": "req_123456789",
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```

Error responses:

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with ID 123 not found",
    "details": {
      "userId": "123"
    },
    "timestamp": "2025-05-20T00:26:52+05:30",
    "requestId": "req_123456789"
  }
}
```

### GraphQL API

The GraphQL API is available at `/graphql` and provides a flexible way to query and mutate data.

Example query:

```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    email
    profile {
      firstName
      lastName
      birthDate
      profilePicture
    }
    roles
    createdAt
  }
}
```

Variables:

```json
{
  "id": "usr_123456789"
}
```

### WebSocket API

The WebSocket API is available at `/socket.io` and uses Socket.IO for real-time communication.

Events:

- `notification`: Receive notifications
- `status-update`: Receive status updates
- `read-notification`: Mark a notification as read

## Authentication

All APIs (except public endpoints) require authentication using JWT tokens:

```
Authorization: Bearer {token}
```

For detailed information about authentication, see the [Authentication](./authentication.md) documentation.

## Rate Limiting

APIs are protected by rate limiting to prevent abuse:

- Unauthenticated requests: 60 requests per minute
- Authenticated requests: 300 requests per minute
- Admin requests: 1000 requests per minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 299
X-RateLimit-Reset: 1621506412
```

## CORS

Cross-Origin Resource Sharing (CORS) is configured to allow requests from:

- `https://admin.corpastro.com`
- `https://app.corpastro.com`
- `http://localhost:3000` (development)

## API Documentation Tools

The API documentation is available through:

- **Swagger UI**: `/api-docs` - Interactive REST API documentation
- **GraphQL Playground**: `/graphql` - Interactive GraphQL API explorer
- **Postman Collection**: Available in the `/docs/api/postman` directory

## API Testing

You can test the APIs using:

- **Postman**: Import the Postman collection
- **cURL**: Command-line examples are provided in the documentation
- **GraphQL Playground**: Test GraphQL queries directly

Example cURL request:

```bash
curl -X POST \
  https://api.corpastro.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

## Error Codes

Common error codes:

| Code | Description |
|------|-------------|
| `AUTHENTICATION_REQUIRED` | Authentication is required |
| `INVALID_CREDENTIALS` | Invalid email or password |
| `TOKEN_EXPIRED` | JWT token has expired |
| `PERMISSION_DENIED` | User lacks permission for this action |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `VALIDATION_ERROR` | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| `INTERNAL_SERVER_ERROR` | Server encountered an error |

For more detailed information about specific API endpoints, please refer to the individual documentation pages linked above.
