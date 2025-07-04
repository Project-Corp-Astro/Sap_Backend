import { Request, Response, NextFunction } from 'express';

// Define the structure of validation errors
export interface ValidationErrorItem {
  param: string;
  msg: string;
  value?: any;
}

// Custom error class for validation errors
export class ValidationError extends Error {
  statusCode: number;
  errors: ValidationErrorItem[];

  constructor(message: string, errors: ValidationErrorItem[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.errors = errors;
  }
}

// Error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: err.message,
      errors: err.errors || [],
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};

/**
 * Async handler to wrap route handlers and catch errors
 * @param fn Async route handler function
 * @returns Wrapped route handler with error handling
 */
export const asyncHandler = (fn: Function) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
