import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { createServiceLogger } from '../utils/sharedLogger.js';
// Initialize logger
const logger = createServiceLogger('auth-middleware');
// JWT secret key - should be stored in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
/**
 * Authentication middleware to protect routes
 * Validates JWT token and attaches user payload to request
 */
export const authMiddleware = async (req, res, next) => {
    try {
        // Get auth header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required. Please provide a valid token.',
            });
        }
        // Extract token
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authentication token is missing',
            });
        }
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        // Attach user info to request
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            role: decoded.role,
        };
        return next();
    }
    catch (error) {
        logger.error('Auth middleware error:', { error: error.message });
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token',
        });
    }
};
/**
 * Role-based authorization middleware
 * @param roles - Array of allowed roles
 */
export const roleAuthorization = (roles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'User not authenticated',
        });
    }
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Not authorized to access this resource',
        });
    }
    return next();
};
