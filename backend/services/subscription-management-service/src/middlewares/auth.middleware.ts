/**
 * Authentication middleware for subscription management service
 * Uses shared authentication patterns and role-based access control by
 * leveraging shared utilities from the shared folder
 */

import { Request, Response, NextFunction } from 'express';
import { RequestHandler } from 'express';
import logger from '../utils/logger';

// Import shared utilities with proper TypeScript import syntax
import * as authModule from '../../../../shared/utils/auth';
import * as redisModule from '../../../../shared/utils/redis';
import jwt from 'jsonwebtoken';

// Get JWT secret from shared config or use a fallback
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Define roles locally to avoid import conflicts
enum UserRole {
  USER = 'user',
  BUSINESS_ADMIN = 'business_admin',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

// Token blacklist prefix - must match the one in shared auth utility
const TOKEN_BLACKLIST_PREFIX = 'bl_';

// Define JWT payload interface locally to avoid import errors
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  permissions?: string[];
  businessId?: string;
  iat?: number;
  exp?: number;
}

/**
 * Utility function to verify JWT tokens
 * @param token - JWT token to verify
 * @returns Decoded token payload or null if invalid
 */
function verifyToken(token: string): JwtPayload | null {
  try {
    logger.info('Attempting to verify token');
    
    // Verify the token with our secret
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    
    // Log successful verification
    logger.info('Token verified successfully', {
      userId: decoded.userId,
      email: decoded.email
    });
    
    return decoded;
  } catch (error) {
    logger.error('Token verification error:', { error: (error as Error).message });
    return null;
  }
}

// Define user document interface
export interface UserDocument {
  _id: string;
  email: string;
  role: string; 
  isActive: boolean;
  businessId?: string;
  permissions?: string[];
}

// Extend Express Request interface to include token
// And extend Passport's User interface to include our properties
declare global {
  namespace Express {
    interface Request {
      token?: string;
    }
    // This properly extends the User interface from Passport
    interface User extends UserDocument {}
  }
}

/**
 * Middleware to authenticate the user from JWT token
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required: No token provided'
      });
      return;
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Store token for blacklist checking
    req.token = token;
    
    // Verify token locally since shared utility doesn't have verifyToken
    const decoded = verifyToken(token) as JwtPayload;
    
    if (!decoded || !decoded.userId) {
      logger.warn('Authentication failed: Invalid token payload');
      res.status(401).json({
        success: false,
        message: 'Authentication failed: Invalid token'
      });
      return;
    };
    
    // Attach user info to request
    const user: UserDocument = {
      _id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      isActive: true,
      businessId: decoded.businessId,
      permissions: decoded.permissions || []
    };
    
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', { error: (error as Error).message });
    res.status(401).json({
      success: false,
      message: 'Authentication failed: ' + (error as Error).message
    });
  }
};

/**
 * Middleware to check if token is blacklisted (e.g. user logged out)
 * Uses shared utility for token blacklist checking
 */
export const checkBlacklist = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.token;
  
  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }
  
  // Check if token is blacklisted using Redis client
  const tokenKey = `${TOKEN_BLACKLIST_PREFIX}${token}`;
  // Get the Redis client instance
  const redisClient = redisModule.default;
  
  redisClient.exists(tokenKey)
    .then((exists: boolean) => {
      if (exists) {
        logger.warn('Attempt to use blacklisted token');
        res.status(401).json({
          success: false,
          message: 'Authentication failed: Token is invalid'
        });
        return;
      }
      next();
    })
    .catch((error: Error) => {
      logger.error('Error checking token blacklist:', { error: error.message });
      // Continue despite Redis error (fail open in this case)
      next();
    });
};

/**
 * Middleware to check if user has admin role
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const user = req.user as UserDocument;
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }
    
    // Compare with string values instead of enum to avoid import conflicts
    if (user.role === 'admin' || user.role === 'super_admin') {
      next();
      return;
    }
    
    logger.warn('Admin access denied', { userId: user._id, role: user.role });
    res.status(403).json({
      success: false,
      message: 'Access denied: Admin role required'
    });
  } catch (error) {
    logger.error('Error in admin role check:', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Middleware to check if user has any of the management roles
 */
export const requireManagementRole = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const user = req.user as UserDocument;
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }
    
    // Compare with string values instead of enum to avoid import conflicts
    if (
      user.role === 'admin' ||
      user.role === 'super_admin' ||
      user.role === 'business_admin'
    ) {
      next();
      return;
    }
    
    logger.warn('Management access denied', { userId: user._id, role: user.role });
    res.status(403).json({
      success: false,
      message: 'Access denied: Management role required'
    });
  } catch (error) {
    logger.error('Error in management role check:', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Middleware to require specific permission
 * Admins bypass this check
 */
export const requirePermission = (permission: string): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = req.user as UserDocument;
      
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      // Admin users bypass permission checks
      if (user.role === 'admin' || user.role === 'super_admin') {
        next();
        return;
      }
      
      // Check if user has required permission
      if (user.permissions?.includes(permission)) {
        next();
        return;
      }
      
      logger.warn('Permission denied', {
        userId: user._id,
        requiredPermission: permission,
        userPermissions: user.permissions
      });
      
      res.status(403).json({
        success: false,
        message: 'Access denied: Insufficient permissions'
      });
    } catch (error) {
      logger.error('Error in permission middleware:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        message: 'Internal server error during permission check'
      });
    }
  };
};

/**
 * Middleware to require any of the specified permissions
 * Admins bypass this check
 */
export const requireAnyPermission = (permissions: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = req.user as UserDocument;
      
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      // Admin users bypass permission checks
      if (user.role === 'admin' || user.role === 'super_admin') {
        next();
        return;
      }
      
      // Check if user has any of the required permissions
      if (user.permissions && permissions.some(perm => user.permissions!.includes(perm))) {
        next();
        return;
      }
      
      logger.warn('Permission denied', {
        userId: user._id,
        requiredPermissions: permissions,
        userPermissions: user.permissions
      });
      
      res.status(403).json({
        success: false,
        message: 'Access denied: Insufficient permissions'
      });
    } catch (error) {
      logger.error('Error in permission middleware:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        message: 'Internal server error during permission check'
      });
    }
  };
};

/**
 * Middleware to require all of the specified permissions
 * Admins bypass this check
 */
export const requireAllPermissions = (permissions: string[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = req.user as UserDocument;
      
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }
      
      // Admin users bypass permission checks
      if (user.role === 'admin' || user.role === 'super_admin') {
        next();
        return;
      }
      
      // Check if user has all required permissions
      if (user.permissions && permissions.every(perm => user.permissions!.includes(perm))) {
        next();
        return;
      }
      
      logger.warn('Permission denied', {
        userId: user._id,
        requiredPermissions: permissions,
        userPermissions: user.permissions
      });
      
      res.status(403).json({
        success: false,
        message: 'Access denied: Insufficient permissions'
      });
    } catch (error) {
      logger.error('Error in permission middleware:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        message: 'Internal server error during permission check'
      });
    }
  };
};

// Export middleware as default object
export default {
  authenticate,
  checkBlacklist,
  requireAdmin,
  requireManagementRole,
  requirePermission,
  requireAnyPermission,
  requireAllPermissions
};
