// Simple error handler implementation for TypeScript migration
export enum ErrorTypes {
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  CONFLICT = 'CONFLICT',
  INTERNAL = 'INTERNAL'
}

export class AppError extends Error {
  public type: ErrorTypes;
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, type: ErrorTypes = ErrorTypes.INTERNAL, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.type = type;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    // Capturing stack trace, excluding constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (err: Error | AppError): void => {
  console.error('Error:', err);
  
  // If we need to perform any cleanup or shutdown on critical errors
  if (err instanceof AppError && !err.isOperational) {
    console.error('Critical error, shutting down...');
    process.exit(1);
  }
};

export default {
  AppError,
  ErrorTypes,
  handleError
};
