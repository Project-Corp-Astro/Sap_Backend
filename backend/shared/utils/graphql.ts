/**
 * GraphQL Utility
 * Provides GraphQL schema and resolvers for the API
 */

import { ApolloServer, gql } from 'apollo-server-express';
import { Express, Request } from 'express';
import { createServiceLogger } from './logger';
import { AppError, ErrorTypes } from './errorHandler';

// Initialize logger
const logger = createServiceLogger('graphql');

/**
 * Base type definitions
 */
const baseTypeDefs = gql`
  # Base scalar types
  scalar Date
  scalar JSON

  # Pagination input
  input PaginationInput {
    page: Int = 1
    limit: Int = 10
    sortBy: String
    sortOrder: SortOrder = DESC
  }

  # Sort order enum
  enum SortOrder {
    ASC
    DESC
  }

  # Base pagination response
  interface PaginatedResponse {
    totalItems: Int!
    totalPages: Int!
    currentPage: Int!
    hasNextPage: Boolean!
    hasPrevPage: Boolean!
  }

  # Base error type
  type Error {
    message: String!
    code: String
    field: String
  }

  # Base response interface
  interface BaseResponse {
    success: Boolean!
    errors: [Error!]
  }

  # Query and Mutation types must be extended by service schemas
  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }

  type Subscription {
    _empty: String
  }
`;

// Define interfaces
interface ApolloServerOptions {
  typeDefs?: any | any[];
  resolvers?: any;
  context?: any;
  path?: string;
  playground?: boolean;
  introspection?: boolean;
  [key: string]: any;
}

interface ContextParams {
  req?: Request;
  connection?: any;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

interface PaginatedResponse<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ErrorResponse {
  success: boolean;
  errors: Array<{
    message: string;
    code?: string;
    field?: string | null;
  }>;
}

interface SuccessResponse {
  success: boolean;
  errors: any[];
  [key: string]: any;
}

interface AuthDirective {
  typeDef: string;
  resolver: (next: any, source: any, args: any, context: any) => any;
}

interface UserContext {
  user?: {
    id: string;
    roles?: string[];
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Initialize Apollo Server
 * @param app - Express app
 * @param options - Apollo Server options
 * @returns Apollo Server instance
 */
export const initializeGraphQL = (app: Express, options: ApolloServerOptions = {}): ApolloServer => {
  try {
    const {
      typeDefs = [],
      resolvers = {},
      context = {},
      path = '/graphql',
      playground = process.env.NODE_ENV !== 'production',
      introspection = process.env.NODE_ENV !== 'production',
    } = options;

    // Combine base type definitions with service type definitions
    const allTypeDefs = [baseTypeDefs, ...(Array.isArray(typeDefs) ? typeDefs : [typeDefs])];

    // Create Apollo Server
    const server = new ApolloServer({
      typeDefs: allTypeDefs,
      resolvers,
      context: async ({ req, connection }: ContextParams) => {
        // For subscriptions
        if (connection) {
          return connection.context;
        }

        // For queries and mutations
        const contextValue = typeof context === 'function' ? await context({ req }) : context;

        return {
          ...contextValue,
          req,
        };
      },
      formatError: (err: any) => {
        // Log GraphQL errors
        logger.error('GraphQL error', {
          message: err.message,
          path: err.path,
          extensions: err.extensions,
        });

        // Return formatted error
        return {
          message: err.message,
          code: err.extensions?.code || 'INTERNAL_SERVER_ERROR',
          path: err.path,
          locations: err.locations,
        };
      },
      playground,
      introspection,
    });

    // Apply middleware
    server.applyMiddleware({ app, path });

    logger.info(`GraphQL server initialized at ${path}`);

    return server;
  } catch (err) {
    logger.error('Error initializing GraphQL server', { error: (err as Error).message });
    throw new AppError(ErrorTypes.INTERNAL_ERROR, 'Failed to initialize GraphQL server');
  }
};

/**
 * Create paginated response
 * @param items - Items to paginate
 * @param pagination - Pagination options
 * @param totalItems - Total number of items
 * @returns Paginated response
 */
export const createPaginatedResponse = <T>(
  items: T[],
  pagination: PaginationOptions,
  totalItems: number
): PaginatedResponse<T> => {
  const { page = 1, limit = 10 } = pagination;
  const totalPages = Math.ceil(totalItems / limit);

  return {
    items,
    totalItems,
    totalPages,
    currentPage: page,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

/**
 * Create error response
 * @param message - Error message
 * @param code - Error code
 * @param field - Field with error
 * @returns Error response
 */
export const createErrorResponse = (
  message: string,
  code: string = 'ERROR',
  field: string | null = null
): ErrorResponse => {
  return {
    success: false,
    errors: [
      {
        message,
        code,
        field,
      },
    ],
  };
};

/**
 * Create success response
 * @param data - Response data
 * @returns Success response
 */
export const createSuccessResponse = (data: Record<string, any> = {}): SuccessResponse => {
  return {
    success: true,
    errors: [],
    ...data,
  };
};

/**
 * Authentication directive
 * @returns Authentication directive
 */
export const createAuthDirective = (): AuthDirective => {
  return {
    typeDef: `
      directive @auth(
        requires: [Role!] = []
      ) on OBJECT | FIELD_DEFINITION

      enum Role {
        ADMIN
        USER
        EDITOR
        VIEWER
      }
    `,
    resolver: (next: any, source: any, args: { requires?: string[] }, context: UserContext) => {
      const { requires } = args;
      const { user } = context;

      // Check if user is authenticated
      if (!user) {
        throw new Error('Authentication required');
      }

      // Check if user has required roles
      if (requires && requires.length > 0) {
        const userRoles = user.roles || [];
        const hasRequiredRole = requires.some(role => 
          userRoles.includes(role.toLowerCase())
        );

        if (!hasRequiredRole) {
          throw new Error('Insufficient permissions');
        }
      }

      return next();
    },
  };
};

// Export the base type definitions
export { baseTypeDefs };
