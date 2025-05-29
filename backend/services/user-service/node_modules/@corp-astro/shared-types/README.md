# Shared Types Package

This package provides shared TypeScript type definitions for the Corp-Astro Super Administration Panel (SAP) project. It ensures type consistency between frontend and backend components.

## Installation

The package is included in the project workspaces. To build the types:

```bash
# From the root directory
npm run build:types

# Or directly from the types directory
cd shared/types
npm run build
```

## Usage

### In Frontend Components

```typescript
// Import specific types
import { User, UserRole, Permission } from '@corp-astro/shared-types';

// Example usage in a component
const user: User = {
  id: '1',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  role: UserRole.ADMIN,
  // ...other properties
};
```

### In API Services

```typescript
import { 
  ApiResponse, 
  PaginatedResponse, 
  User, 
  CreateRequest, 
  UpdateRequest 
} from '@corp-astro/shared-types';

// Example API service
export const userApi = {
  getUsers: () => 
    apiService.get<ApiResponse<PaginatedResponse<User>>>('/users'),
    
  createUser: (data: CreateRequest<User>) => 
    apiService.post<ApiResponse<User>>('/users', data),
    
  updateUser: (id: string, data: UpdateRequest<User>) => 
    apiService.put<ApiResponse<User>>(`/users/${id}`, data),
};
```

### In Backend Services

```typescript
import { User, UserRole, Permission } from '@corp-astro/shared-types';

// Example controller method
async createUser(req: Request, res: Response) {
  const userData: CreateRequest<User> = req.body;
  // Process data...
  res.status(201).json({
    success: true,
    data: newUser
  });
}
```

## Available Types

### User Management

- `User`: Base user interface
- `AdminUser`: Extended user interface with admin properties
- `UserRole`: Enum of available user roles
- `Permission`: Interface for user permissions

### Authentication

- `LoginRequest`: Login credentials
- `RegisterRequest`: Registration data
- `AuthResponse`: Authentication response with tokens
- `MfaSetupResponse`: Multi-factor authentication setup data

### Content Management

- `Content`: Content item interface
- `ContentType`: Enum of content types
- `ContentStatus`: Enum of content statuses
- `ContentFilter`: Interface for content filtering

### Common Types

- `ApiResponse<T>`: Standard API response wrapper
- `PaginatedResponse<T>`: Paginated list response
- `ApiError`: Standard error response

### API Types

- `ApiClientConfig`: Configuration for API clients
- `CreateRequest<T>`: Generic create request
- `UpdateRequest<T>`: Generic update request
- `ListRequest`: Standard list request with pagination

## Benefits

- **Type Consistency**: Ensures frontend and backend use the same data structures
- **Better Developer Experience**: Improved autocomplete and type checking
- **Reduced Duplication**: No need to define the same types in multiple places
- **Safer Refactoring**: Changes to data models only need to be made in one place

## Maintenance

When adding new features or modifying existing ones:

1. Update the relevant type definitions in the shared package
2. Run `npm run build` in the shared/types directory
3. Use the updated types in your components

## Contributing

When adding new types:

1. Place them in the appropriate file based on their domain
2. Export them from the main index.ts file
3. Document them in this README
