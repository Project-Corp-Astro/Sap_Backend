/**
 * Default request logging format
 */
const DEFAULT_FORMAT = ':method :url :status :response-time ms - :res[content-length]';
/**
 * Create middleware for logging HTTP requests
 * @param logger - Logger instance
 * @param options - Request logger options
 * @returns Express middleware function
 */
export function requestLogger(logger, options = {}) {
    const skip = options.skip || (() => false);
    const tokens = options.tokens || {};
    const format = options.format || DEFAULT_FORMAT;
    return (req, res, next) => {
        // Skip logging if the skip function returns true
        if (skip(req, res)) {
            return next();
        }
        const startTime = Date.now();
        const url = req.originalUrl || req.url;
        const method = req.method;
        // Process the request
        res.on('finish', () => {
            const responseTime = Date.now() - startTime;
            const status = res.statusCode;
            const contentLength = res.getHeader('content-length') || '-';
            // Replace tokens in the format string
            let logMessage = format
                .replace(':method', method)
                .replace(':url', url)
                .replace(':status', status.toString())
                .replace(':response-time', responseTime.toString())
                .replace(':res[content-length]', contentLength.toString());
            // Replace custom tokens
            Object.keys(tokens).forEach(token => {
                logMessage = logMessage.replace(`:${token}`, tokens[token](req, res));
            });
            // Log at appropriate level based on status code
            if (status >= 500) {
                logger.error(logMessage, {
                    method,
                    url,
                    status,
                    responseTime,
                    ip: req.ip || req.connection.remoteAddress
                });
            }
            else if (status >= 400) {
                logger.warn(logMessage, {
                    method,
                    url,
                    status,
                    responseTime,
                    ip: req.ip || req.connection.remoteAddress
                });
            }
            else {
                logger.http(logMessage, {
                    method,
                    url,
                    status,
                    responseTime
                });
            }
        });
        next();
    };
}
/**
 * Create middleware for logging errors
 * @param logger - Logger instance
 * @returns Express middleware function
 */
export function errorLogger(logger) {
    return (err, req, res, next) => {
        logger.error(`Error processing ${req.method} ${req.originalUrl || req.url}`, {
            error: err.message,
            stack: err.stack,
            method: req.method,
            url: req.originalUrl || req.url,
            ip: req.ip || req.connection.remoteAddress,
            body: req.body
        });
        next(err);
    };
}
