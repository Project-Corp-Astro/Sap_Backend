/**
 * Authentication Middleware
 * Provides authentication and authorization functionality for Express routes
 * using PostgreSQL for user data and Redis for sessions
 */

import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '../../shared/utils/logger';
import redisClient from '../../shared/utils/redis';
import authService from '../services/AuthService';
import { UserRepository } from '../repositories/UserRepository';
import { UserSessionRepository } from '../repositories/UserSessionRepository';

const logger = createServiceLogger('auth-middleware');
const userRepository = new UserRepository();
const userSessionRepository = new UserSessionRepository();

// Extend Express Request interface to include user and session
declare global {
  namespace Express {
    interface Request {
      user?: any;
      session?: any;
      permissions?: string[];
    }
  }
}

/**
 * Authenticate user using JWT token
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = authService.verifyToken(token);
    
    // Get user from Redis cache or database
    const cacheKey = `user:id:${decoded.userId}`;
    let user = await redisClient.get(cacheKey);
    
    if (!user) {
      // If not in cache, get from database
      user = await userRepository.findById(decoded.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      // Store in cache for 15 minutes
      await redisClient.set(cacheKey, user, 900);
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }
    
    // Set user in request
    req.user = user;
    
    // Set permissions in request
    if (user.role && user.role.permissions) {
      req.permissions = user.role.permissions.map((p: any) => p.name);
    } else {
      req.permissions = [];
    }
    
    next();
  } catch (error) {
    logger.error('Authentication error', { error: (error as Error).message });
    return res.status(401).json({ message: 'Invalid token' });
  }
};

/**
 * Authenticate user using session token
 */
export const authenticateSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header or cookie
    const sessionToken = req.headers['x-refresh-token'] as string || req.cookies?.refreshToken;
    
    if (!sessionToken) {
      return res.status(401).json({ message: 'No session token provided' });
    }
    
    // Try to get session from Redis
    const cacheKey = `auth:session:${sessionToken}`;
    let sessionData = await redisClient.get(cacheKey);
    
    if (!sessionData) {
      // If not in cache, get from database
      const session = await userSessionRepository.findByToken(sessionToken);
      
      if (!session) {
        return res.status(401).json({ message: 'Invalid session' });
      }
      
      if (!session.isValid()) {
        return res.status(401).json({ message: 'Session expired or revoked' });
      }
      
      // Get user
      const user = await userRepository.findById(session.userId);
      
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }
      
      // Set session data
      sessionData = {
        userId: user.id,
        expiresAt: session.expiresAt
      };
      
      // Store in Redis for faster access next time
      await redisClient.set(cacheKey, sessionData, 900);
      
      // Update session last used time
      await userSessionRepository.updateLastUsedTime(sessionToken);
      
      // Set user and session in request
      req.user = user;
      req.session = session;
    } else {
      // Get user from Redis cache or database
      const userCacheKey = `user:id:${sessionData.userId}`;
      let user = await redisClient.get(userCacheKey);
      
      if (!user) {
        // If not in cache, get from database
        user = await userRepository.findById(sessionData.userId);
        
        if (!user) {
          return res.status(401).json({ message: 'User not found' });
        }
        
        // Store in cache for 15 minutes
        await redisClient.set(userCacheKey, user, 900);
      }
      
      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }
      
      // Set user and session in request
      req.user = user;
      req.session = {
        token: sessionToken,
        expiresAt: sessionData.expiresAt
      };
    }
    
    // Set permissions in request
    if (req.user.role && req.user.role.permissions) {
      req.permissions = req.user.role.permissions.map((p: any) => p.name);
    } else {
      req.permissions = [];
    }
    
    next();
  } catch (error) {
    logger.error('Session authentication error', { error: (error as Error).message });
    return res.status(401).json({ message: 'Invalid session' });
  }
};

/**
 * Check if user has required role
 * @param roles - Array of allowed roles
 */
export const hasRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role.name)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
};

/**
 * Check if user has required permission
 * @param permissions - Array of required permissions
 */
export const hasPermission = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!req.permissions) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    const hasAllPermissions = permissions.every(permission => 
      req.permissions.includes(permission)
    );
    
    if (!hasAllPermissions) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
};

/**
 * Check if user has at least one of the required permissions
 * @param permissions - Array of permissions (user must have at least one)
 */
export const hasAnyPermission = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (!req.permissions) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    const hasAnyPermission = permissions.some(permission => 
      req.permissions.includes(permission)
    );
    
    if (!hasAnyPermission) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    
    next();
  };
};

/**
 * Check if user is the owner of a resource
 * @param getResourceOwnerId - Function to get resource owner ID from request
 */
export const isResourceOwner = (getResourceOwnerId: (req: Request) => string | Promise<string>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    try {
      const ownerId = await getResourceOwnerId(req);
      
      if (req.user.id !== ownerId) {
        return res.status(403).json({ message: 'You do not have permission to access this resource' });
      }
      
      next();
    } catch (error) {
      logger.error('Error checking resource ownership', { error: (error as Error).message });
      return res.status(500).json({ message: 'Error checking resource ownership' });
    }
  };
};
