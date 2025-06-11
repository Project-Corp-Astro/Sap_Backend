import { Request, Response, NextFunction } from 'express';
import { UserDocument } from '../interfaces/shared-types';
import userPermissionService from '../services/user-permission.service';
import userServiceLogger from '../utils/logger';
import { UserRole } from '@corp-astro/shared-types';
import { RequestHandler } from 'express';

const logger = userServiceLogger;

/**
 * Middleware to check if a user has a specific permission
 */
export const requirePermission = (requiredPermission: string): RequestHandler => {
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
      if (user.role === UserRole.ADMIN) {
        next();
        return;
      }
      
      // Check if user has the required permission
      userPermissionService.hasPermission(user._id.toString(), requiredPermission)
        .then(hasPermission => {
          if (hasPermission) {
            next();
          } else {
            logger.warn('Permission denied', {
              userId: user._id,
              requiredPermission,
              userRole: user.role
            });
            
            res.status(403).json({
              success: false,
              message: 'Access denied: Insufficient permissions'
            });
          }
        })
        .catch(error => {
          logger.error('Error in permission middleware:', { error: (error as Error).message });
          res.status(500).json({
            success: false,
            message: 'Internal server error during permission check'
          });
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
 * Middleware to check if a user has any of the specified permissions
 */
export const requireAnyPermission = (requiredPermissions: string[]): RequestHandler => {
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
      if (user.role === UserRole.ADMIN) {
        next();
        return;
      }
      
      // Check if user has any of the required permissions
      userPermissionService.hasAnyPermission(user._id.toString(), requiredPermissions)
        .then(hasPermission => {
          if (hasPermission) {
            next();
          } else {
            logger.warn('Permission denied', {
              userId: user._id,
              requiredPermissions,
              userRole: user.role
            });
            
            res.status(403).json({
              success: false,
              message: 'Access denied: Insufficient permissions'
            });
          }
        })
        .catch(error => {
          logger.error('Error in permission middleware:', { error: (error as Error).message });
          res.status(500).json({
            success: false,
            message: 'Internal server error during permission check'
          });
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
 * Middleware to check if a user has all of the specified permissions
 */
export const requireAllPermissions = (requiredPermissions: string[]): RequestHandler => {
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
      if (user.role === UserRole.ADMIN) {
        next();
        return;
      }
      
      // Check if user has all of the required permissions
      userPermissionService.hasAllPermissions(user._id.toString(), requiredPermissions)
        .then(hasPermission => {
          if (hasPermission) {
            next();
          } else {
            logger.warn('Permission denied', {
              userId: user._id,
              requiredPermissions,
              userRole: user.role
            });
            
            res.status(403).json({
              success: false,
              message: 'Access denied: Insufficient permissions'
            });
          }
        })
        .catch(error => {
          logger.error('Error in permission middleware:', { error: (error as Error).message });
          res.status(500).json({
            success: false,
            message: 'Internal server error during permission check'
          });
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
