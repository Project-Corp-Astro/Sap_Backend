// Simple logger implementation for TypeScript migration
const logger = {
    info: (...args) => console.info('[Content Service]', ...args),
    error: (...args) => console.error('[Content Service]', ...args),
    warn: (...args) => console.warn('[Content Service]', ...args),
    debug: (...args) => console.debug('[Content Service]', ...args)
};
export const createServiceLogger = (serviceName) => {
    return {
        info: (...args) => logger.info(`[${serviceName}]`, ...args),
        error: (...args) => logger.error(`[${serviceName}]`, ...args),
        warn: (...args) => logger.warn(`[${serviceName}]`, ...args),
        debug: (...args) => logger.debug(`[${serviceName}]`, ...args)
    };
};
export default logger;
