import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { createServiceLogger } from '../utils/sharedLogger';
import { AuthUser } from '../../../../shared/types/auth-user'; // adjust path as needed

// Initialize logger
const logger = createServiceLogger('auth-middleware');

// JWT secret key - should be stored in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Define interfaces
interface JwtPayload {
  userId: string;
  email: string;
  rolePermissionIds?: string[];
  iat?: number;
  exp?: number;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

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
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Attach user info to request with only the data we have in the token
    req.user = {
      _id: decoded.userId,
      email: decoded.email,
      rolePermissionIds: decoded.rolePermissionIds || []
    };
    
    // Log the decoded token for debugging
    logger.debug('Decoded JWT:', JSON.stringify(decoded, null, 2));
    logger.debug('Attached user to request:', req.user);

    return next();
  } catch (error) {
    logger.error('Auth middleware error:', { error: (error as Error).message });

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

