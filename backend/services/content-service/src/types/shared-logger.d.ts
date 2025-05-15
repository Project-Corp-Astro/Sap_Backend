declare module '../../../shared/utils/logger.js' {
  export interface Logger {
    info: (...args: any[]) => void;
    error: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    debug: (...args: any[]) => void;
  }

  export function createServiceLogger(serviceName: string): Logger;
  
  const logger: Logger;
  export default logger;
}

declare module '../../../shared/utils/errorHandler.js' {
  export class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;
    
    constructor(message: string, statusCode: number);
  }
  
  export enum ErrorTypes {
    VALIDATION_ERROR = 'ValidationError',
    AUTHENTICATION_ERROR = 'AuthenticationError',
    AUTHORIZATION_ERROR = 'AuthorizationError',
    NOT_FOUND_ERROR = 'NotFoundError',
    CONFLICT_ERROR = 'ConflictError',
    SERVER_ERROR = 'ServerError'
  }
}
