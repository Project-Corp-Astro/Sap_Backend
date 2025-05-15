// Simple error handler implementation for TypeScript migration
export var ErrorTypes;
(function (ErrorTypes) {
    ErrorTypes["VALIDATION"] = "VALIDATION";
    ErrorTypes["NOT_FOUND"] = "NOT_FOUND";
    ErrorTypes["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorTypes["FORBIDDEN"] = "FORBIDDEN";
    ErrorTypes["CONFLICT"] = "CONFLICT";
    ErrorTypes["INTERNAL"] = "INTERNAL";
})(ErrorTypes || (ErrorTypes = {}));
export class AppError extends Error {
    constructor(message, type = ErrorTypes.INTERNAL, statusCode = 500, isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.type = type;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        // Capturing stack trace, excluding constructor call from it
        Error.captureStackTrace(this, this.constructor);
    }
}
export const handleError = (err) => {
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
