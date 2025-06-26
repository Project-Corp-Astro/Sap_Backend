"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = exports.createBadRequestError = exports.createServiceUnavailableError = exports.createInternalError = exports.createConflictError = exports.createNotFoundError = exports.createAuthorizationError = exports.createAuthenticationError = exports.createValidationError = exports.errorMiddleware = exports.ApiError = exports.ErrorTypes = void 0;
// Standard error types with appropriate HTTP status codes
var ErrorTypes;
(function (ErrorTypes) {
    ErrorTypes["VALIDATION_ERROR"] = "ValidationError";
    ErrorTypes["AUTHENTICATION_ERROR"] = "AuthenticationError";
    ErrorTypes["AUTHORIZATION_ERROR"] = "AuthorizationError";
    ErrorTypes["NOT_FOUND_ERROR"] = "NotFoundError";
    ErrorTypes["CONFLICT_ERROR"] = "ConflictError";
    ErrorTypes["INTERNAL_ERROR"] = "InternalError";
    ErrorTypes["SERVICE_UNAVAILABLE"] = "ServiceUnavailableError";
    ErrorTypes["BAD_REQUEST"] = "BadRequestError";
})(ErrorTypes || (exports.ErrorTypes = ErrorTypes = {}));
// Map error types to HTTP status codes
const ErrorStatusCodes = {
    [ErrorTypes.VALIDATION_ERROR]: 400,
    [ErrorTypes.AUTHENTICATION_ERROR]: 401,
    [ErrorTypes.AUTHORIZATION_ERROR]: 403,
    [ErrorTypes.NOT_FOUND_ERROR]: 404,
    [ErrorTypes.CONFLICT_ERROR]: 409,
    [ErrorTypes.INTERNAL_ERROR]: 500,
    [ErrorTypes.SERVICE_UNAVAILABLE]: 503,
    [ErrorTypes.BAD_REQUEST]: 400,
};
/**
 * Custom API Error class
 * @extends Error
 */
class ApiError extends Error {
    /**
     * Create an API error
     * @param type - Error type from ErrorTypes
     * @param message - Error message
     * @param metadata - Additional error metadata
     * @param originalError - Original error if this is wrapping another error
     */
    constructor(type, message, metadata = {}, originalError = null) {
        super(message);
        this.name = type;
        this.statusCode = ErrorStatusCodes[type] || 500;
        this.metadata = metadata;
        this.originalError = originalError;
        this.timestamp = new Date().toISOString();
        // Capture stack trace
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.ApiError = ApiError;
/**
 * Create error response object for client
 * @param error - API error
 * @param includeDetails - Whether to include error details (for development)
 * @returns Error response object
 */
const createErrorResponse = (error, includeDetails = process.env.NODE_ENV === 'development') => {
    const response = {
        success: false,
        error: {
            type: error.name,
            message: error.message,
            statusCode: error.statusCode,
        }
    };
    if (includeDetails && error.metadata) {
        response.error.details = error.metadata;
    }
    return response;
};
/**
 * Express middleware for handling errors
 * @param logger - Winston logger instance
 * @returns Express error middleware
 */
const errorMiddleware = (logger) => {
    return (err, req, res, next) => {
        // If the error is already an ApiError, use it directly
        const apiError = err instanceof ApiError
            ? err
            : new ApiError(ErrorTypes.INTERNAL_ERROR, err.message || 'An unexpected error occurred', {}, err);
        // Log the error with appropriate level
        const logMethod = apiError.statusCode >= 500 ? 'error' : 'warn';
        logger[logMethod](`${req.method} ${req.path} - ${apiError.statusCode}`, {
            error: {
                message: apiError.message,
                name: apiError.name,
                stack: apiError.stack,
                originalError: apiError.originalError ? {
                    message: apiError.originalError.message,
                    stack: apiError.originalError.stack
                } : undefined
            },
            request: {
                method: req.method,
                path: req.path,
                query: req.query,
                params: req.params,
                ip: req.ip,
                headers: {
                    'user-agent': req.get('user-agent'),
                    'x-request-id': req.get('x-request-id')
                }
            }
        });
        // Send error response to client
        res.status(apiError.statusCode).json(createErrorResponse(apiError));
    };
};
exports.errorMiddleware = errorMiddleware;
// Factory functions for creating specific error types
const createValidationError = (message, metadata) => new ApiError(ErrorTypes.VALIDATION_ERROR, message, metadata);
exports.createValidationError = createValidationError;
const createAuthenticationError = (message, metadata) => new ApiError(ErrorTypes.AUTHENTICATION_ERROR, message, metadata);
exports.createAuthenticationError = createAuthenticationError;
const createAuthorizationError = (message, metadata) => new ApiError(ErrorTypes.AUTHORIZATION_ERROR, message, metadata);
exports.createAuthorizationError = createAuthorizationError;
const createNotFoundError = (message, metadata) => new ApiError(ErrorTypes.NOT_FOUND_ERROR, message, metadata);
exports.createNotFoundError = createNotFoundError;
const createConflictError = (message, metadata) => new ApiError(ErrorTypes.CONFLICT_ERROR, message, metadata);
exports.createConflictError = createConflictError;
const createInternalError = (message, metadata, originalError) => new ApiError(ErrorTypes.INTERNAL_ERROR, message, metadata, originalError || null);
exports.createInternalError = createInternalError;
const createServiceUnavailableError = (message, metadata) => new ApiError(ErrorTypes.SERVICE_UNAVAILABLE, message, metadata);
exports.createServiceUnavailableError = createServiceUnavailableError;
const createBadRequestError = (message, metadata) => new ApiError(ErrorTypes.BAD_REQUEST, message, metadata);
exports.createBadRequestError = createBadRequestError;
// For backward compatibility with code that uses require syntax
exports.AppError = ApiError;
