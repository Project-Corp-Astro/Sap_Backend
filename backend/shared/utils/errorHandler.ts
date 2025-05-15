/**
 * Centralized error handling for SAP backend services
 * This module provides consistent error handling across all microservices
 */
import { Request, Response, NextFunction } from 'express';
import { Logger } from 'winston';

// Standard error types with appropriate HTTP status codes
export enum ErrorTypes {
  VALIDATION_ERROR = 'ValidationError',
  AUTHENTICATION_ERROR = 'AuthenticationError',
  AUTHORIZATION_ERROR = 'AuthorizationError',
  NOT_FOUND_ERROR = 'NotFoundError',
  CONFLICT_ERROR = 'ConflictError',
  INTERNAL_ERROR = 'InternalError',
  SERVICE_UNAVAILABLE = 'ServiceUnavailableError',
  BAD_REQUEST = 'BadRequestError',
}

// Map error types to HTTP status codes
const ErrorStatusCodes: Record<ErrorTypes, number> = {
  [ErrorTypes.VALIDATION_ERROR]: 400,
  [ErrorTypes.AUTHENTICATION_ERROR]: 401,
  [ErrorTypes.AUTHORIZATION_ERROR]: 403,
  [ErrorTypes.NOT_FOUND_ERROR]: 404,
  [ErrorTypes.CONFLICT_ERROR]: 409,
  [ErrorTypes.INTERNAL_ERROR]: 500,
  [ErrorTypes.SERVICE_UNAVAILABLE]: 503,
  [ErrorTypes.BAD_REQUEST]: 400,
};

/**
 * Custom API Error class
 * @extends Error
 */
export class ApiError extends Error {
  name: ErrorTypes;
  statusCode: number;
  metadata: Record<string, any>;
  originalError: Error | null;
  timestamp: string;

  /**
   * Create an API error
   * @param type - Error type from ErrorTypes
   * @param message - Error message
   * @param metadata - Additional error metadata
   * @param originalError - Original error if this is wrapping another error
   */
  constructor(
    type: ErrorTypes, 
    message: string, 
    metadata: Record<string, any> = {}, 
    originalError: Error | null = null
  ) {
    super(message);
    this.name = type;
    this.statusCode = ErrorStatusCodes[type] || 500;
    this.metadata = metadata;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create error response object for client
 * @param error - API error
 * @param includeDetails - Whether to include error details (for development)
 * @returns Error response object
 */
const createErrorResponse = (
  error: ApiError, 
  includeDetails: boolean = process.env.NODE_ENV === 'development'
): Record<string, any> => {
  const response: Record<string, any> = {
    success: false,
    error: {
      type: error.name,
      message: error.message,
      statusCode: error.statusCode,
    }
  };

  if (includeDetails && error.metadata) {
    response.error.details = error.metadata;
  }

  return response;
};

/**
 * Express middleware for handling errors
 * @param logger - Winston logger instance
 * @returns Express error middleware
 */
export const errorMiddleware = (logger: Logger) => {
  return (err: Error | ApiError, req: Request, res: Response, next: NextFunction): void => {
    // If the error is already an ApiError, use it directly
    const apiError = err instanceof ApiError 
      ? err 
      : new ApiError(
          ErrorTypes.INTERNAL_ERROR,
          err.message || 'An unexpected error occurred',
          {},
          err
        );
    
    // Log the error with appropriate level
    const logMethod = apiError.statusCode >= 500 ? 'error' : 'warn';
    logger[logMethod](`${req.method} ${req.path} - ${apiError.statusCode}`, {
      error: {
        message: apiError.message,
        name: apiError.name,
        stack: apiError.stack,
        originalError: apiError.originalError ? {
          message: apiError.originalError.message,
          stack: apiError.originalError.stack
        } : undefined
      },
      request: {
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
        ip: req.ip,
        headers: {
          'user-agent': req.get('user-agent'),
          'x-request-id': req.get('x-request-id')
        }
      }
    });
    
    // Send error response to client
    res.status(apiError.statusCode).json(createErrorResponse(apiError));
  };
};

// Factory functions for creating specific error types
export const createValidationError = (message: string, metadata?: Record<string, any>): ApiError => 
  new ApiError(ErrorTypes.VALIDATION_ERROR, message, metadata);

export const createAuthenticationError = (message: string, metadata?: Record<string, any>): ApiError => 
  new ApiError(ErrorTypes.AUTHENTICATION_ERROR, message, metadata);

export const createAuthorizationError = (message: string, metadata?: Record<string, any>): ApiError => 
  new ApiError(ErrorTypes.AUTHORIZATION_ERROR, message, metadata);

export const createNotFoundError = (message: string, metadata?: Record<string, any>): ApiError => 
  new ApiError(ErrorTypes.NOT_FOUND_ERROR, message, metadata);

export const createConflictError = (message: string, metadata?: Record<string, any>): ApiError => 
  new ApiError(ErrorTypes.CONFLICT_ERROR, message, metadata);

export const createInternalError = (message: string, metadata?: Record<string, any>, originalError?: Error): ApiError => 
  new ApiError(ErrorTypes.INTERNAL_ERROR, message, metadata, originalError || null);

export const createServiceUnavailableError = (message: string, metadata?: Record<string, any>): ApiError => 
  new ApiError(ErrorTypes.SERVICE_UNAVAILABLE, message, metadata);

export const createBadRequestError = (message: string, metadata?: Record<string, any>): ApiError => 
  new ApiError(ErrorTypes.BAD_REQUEST, message, metadata);

// For backward compatibility with code that uses require syntax
export const AppError = ApiError;
