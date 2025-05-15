import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload, UserRole, ThemePreference } from '../interfaces/user.interfaces';

// Create a simple logger for auth middleware
const logger = {
  info: (...args: any[]) => console.info('[Auth Middleware]', ...args),
  error: (...args: any[]) => console.error('[Auth Middleware]', ...args),
  warn: (...args: any[]) => console.warn('[Auth Middleware]', ...args),
  debug: (...args: any[]) => console.debug('[Auth Middleware]', ...args),
};

// JWT secret key - should be stored in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Note: Express interface extension is now in src/types/express.d.ts

/**
 * Authentication middleware to protect routes
 * Validates JWT token and attaches user payload to request
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
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
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    
    // Attach user info to request
    // We're just setting the minimum required properties here
    // The actual user document will be fetched in the controller if needed
    (req as any).user = {
      _id: decoded.userId,
      email: decoded.email,
      role: decoded.role as UserRole
    };
    
    next();
  } catch (error) {
    logger.error('Auth middleware error:', { error: (error as Error).message });
    
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Role-based authorization middleware
 * @param roles - Array of allowed roles
 */
export const roleAuthorization = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
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
