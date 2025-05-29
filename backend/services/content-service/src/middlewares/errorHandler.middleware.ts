import { Request, Response, NextFunction } from 'express';
import { ContentServiceError, InternalServerError } from '../utils/errorTypes';

/**
 * Global error handling middleware for the Content Service
 * This ensures consistent error responses across all endpoints
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  // Log the error for debugging
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  // If it's our custom error type, use its status code and details
  if (err instanceof ContentServiceError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        details: err.details
      }
    });
    return;
  }
  
  // For unknown errors, return a generic 500 response
  const internalError = new InternalServerError('An unexpected error occurred');
  res.status(internalError.statusCode).json({
    success: false,
    error: {
      code: internalError.errorCode,
      message: internalError.message
    }
  });
}

/**
 * Not found middleware for handling 404 errors
 * This is used when no route matches the requested URL
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl}`
    }
  });
}
