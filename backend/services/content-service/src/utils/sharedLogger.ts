// Simple logger implementation for TypeScript migration
const logger = {
  info: (...args: any[]) => console.info('[Content Service]', ...args),
  error: (...args: any[]) => console.error('[Content Service]', ...args),
  warn: (...args: any[]) => console.warn('[Content Service]', ...args),
  debug: (...args: any[]) => console.debug('[Content Service]', ...args)
};

export const createServiceLogger = (serviceName: string) => {
  return {
    info: (...args: any[]) => logger.info(`[${serviceName}]`, ...args),
    error: (...args: any[]) => logger.error(`[${serviceName}]`, ...args),
    warn: (...args: any[]) => logger.warn(`[${serviceName}]`, ...args),
    debug: (...args: any[]) => logger.debug(`[${serviceName}]`, ...args)
  };
};

export default logger;
