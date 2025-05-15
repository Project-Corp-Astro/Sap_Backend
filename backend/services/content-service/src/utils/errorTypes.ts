/**
 * Custom error types for the Content Service
 * This helps standardize error handling across the service
 */

// Base error class for all Content Service errors
export class ContentServiceError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: any;

  constructor(message: string, statusCode: number, errorCode: string, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    
    // This is needed because we're extending a built-in class
    Object.setPrototypeOf(this, ContentServiceError.prototype);
  }
}

// 400 Bad Request - Invalid input data
export class ValidationError extends ContentServiceError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

// 404 Not Found - Resource not found
export class NotFoundError extends ContentServiceError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} not found with id: ${id}`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND_ERROR');
  }
}

// 409 Conflict - Resource already exists
export class ConflictError extends ContentServiceError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

// 403 Forbidden - User doesn't have permission
export class ForbiddenError extends ContentServiceError {
  constructor(message: string) {
    super(message, 403, 'FORBIDDEN_ERROR');
  }
}

// 401 Unauthorized - Authentication required
export class UnauthorizedError extends ContentServiceError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED_ERROR');
  }
}

// 500 Internal Server Error - Unexpected server error
export class InternalServerError extends ContentServiceError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

// Helper function to convert MongoDB errors to our custom errors
export function handleMongoError(error: any): ContentServiceError {
  // Duplicate key error
  if (error.code === 11000 || error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    return new ConflictError(`${field} '${value}' already exists`);
  }
  
  // Validation error
  if (error.name === 'ValidationError') {
    return new ValidationError('Validation Error', error.errors);
  }
  
  // Cast error (invalid ID format)
  if (error.name === 'CastError' && error.kind === 'ObjectId') {
    return new ValidationError(`Invalid ID format: ${error.value}`);
  }
  
  // Default to internal server error
  return new InternalServerError('Database error', {
    name: error.name,
    message: error.message
  });
}
