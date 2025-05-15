// Type definitions for logger.js
export interface Logger {
  info: (message: string, meta?: any) => void;
  error: (message: string, meta?: any) => void;
  warn: (message: string, meta?: any) => void;
  debug: (message: string, meta?: any) => void;
}

export function createServiceLogger(serviceName: string): Logger;

export default {
  createServiceLogger
};
