/**
 * Type declarations for shared utilities
 */

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

declare module '../../shared/config/index.js' {
  export interface Config {
    port: number;
    env: string;
    mongodb: {
      uri: string;
    };
    jwtSecret: string;
    jwtExpiration: string;
  }
  
  const config: Config;
  export default config;
}

declare module '../../../shared/config/index.js' {
  interface Config {
    port: number;
    env: string;
    mongodb: {
      uri: string;
    };
    jwtSecret: string;
    jwtExpiration: string;
  }
  
  const config: Config;
  export default config;
}

declare module '../../../shared/utils/logger' {
  import { Logger } from 'winston';
  
  export function createServiceLogger(serviceName: string): Logger;
  const defaultLogger: Logger;
  export default defaultLogger;
}

declare module 'slugify' {
  function slugify(str: string, options?: {
    replacement?: string;
    remove?: RegExp;
    lower?: boolean;
    strict?: boolean;
    locale?: string;
    trim?: boolean;
  }): string;
  
  export default slugify;
}
