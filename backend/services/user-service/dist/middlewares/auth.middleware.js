"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleAuthorization = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Create a simple logger for auth middleware
const logger = {
    info: (...args) => console.info('[Auth Middleware]', ...args),
    error: (...args) => console.error('[Auth Middleware]', ...args),
    warn: (...args) => console.warn('[Auth Middleware]', ...args),
    debug: (...args) => console.debug('[Auth Middleware]', ...args),
};
// JWT secret key - should be stored in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// Note: Express interface extension is now in src/types/express.d.ts
/**
 * Authentication middleware to protect routes
 * Validates JWT token and attaches user payload to request
 */
const authMiddleware = async (req, res, next) => {
    try {
        // Get auth header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please provide a valid token.'
            });
        }
        // Extract token
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication token is missing'
            });
        }
        // Verify token
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        // Attach user info to request
        // We're just setting the minimum required properties here
        // The actual user document will be fetched in the controller if needed
        req.user = {
            _id: decoded.userId,
            email: decoded.email,
            role: decoded.role
        };
        next();
    }
    catch (error) {
        logger.error('Auth middleware error:', { error: error.message });
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};
exports.authMiddleware = authMiddleware;
/**
 * Role-based authorization middleware
 * @param roles - Array of allowed roles
 */
const roleAuthorization = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: Insufficient permissions'
            });
        }
        next();
    };
};
exports.roleAuthorization = roleAuthorization;
