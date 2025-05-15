declare module '@sap/logger' {
  export interface LoggerOptions {
    service: string;
    level?: string;
    transports?: {
      console?: boolean;
      file?: {
        filename?: string;
        maxFiles?: number;
        maxSize?: string;
      };
    };
    format?: {
      timestamp?: boolean;
      colorize?: boolean;
      json?: boolean;
    };
  }

  export interface Logger {
    info(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
    verbose(message: string, meta?: any): void;
    middleware: {
      requestLogger: any;
      errorLogger: any;
    };
  }

  export function createLogger(options: LoggerOptions): Logger;
}
