/**
 * Type declarations for the shared logger utility
 */

declare module '../../../shared/utils/logger.js' {
  import { Logger } from 'winston';
  
  export function createServiceLogger(serviceName: string): Logger;
  const defaultLogger: Logger;
  export default defaultLogger;
}
