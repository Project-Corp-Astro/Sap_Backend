import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { PermissionService } from '../../services/user-service/src/services/PermissionService';
import { ForbiddenError, UnauthorizedError } from '../scripts/utils/errors';

// Define the user type to match what's in your auth middleware
interface AuthUser {
  _id: Types.ObjectId | string;
  [key: string]: any;
}

// Extend the Express Request type to include our user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Middleware to check if user has required permission
 */
export function requirePermission(
  permission: string,
  options: {
    application?: string;
    allowSuperadmin?: boolean;
  } = {}
) {
  const { application = '*', allowSuperadmin = true } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id?.toString();
      if (!userId || !req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      // Get rolePermissionIds from token
      const rolePermissionIds = req.user.rolePermissionIds || [];

      // Check if user is superadmin (if allowed to bypass)
      if (allowSuperadmin) {
        const isSuperAdmin = await PermissionService.hasPermission(
          userId,
          '*:*',
          application,
          rolePermissionIds
        );
        
        if (isSuperAdmin) {
          return next();
        }
      }

      // Check specific permission
      const hasPermission = await PermissionService.hasPermission(
        userId,
        permission,
        application,
        rolePermissionIds
      );

      if (!hasPermission) {
        throw new ForbiddenError(`Required permission: ${permission}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to check if user has any of the specified permissions
 */
export function requireAnyPermission(
  permissions: string[],
  options: {
    application?: string;
    allowSuperadmin?: boolean;
  } = {}
) {
  const { application = '*', allowSuperadmin = true } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id?.toString();
      if (!userId || !req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      // Get rolePermissionIds from token
      const rolePermissionIds = req.user.rolePermissionIds || [];

      // Check if user is superadmin (if allowed to bypass)
      if (allowSuperadmin) {
        const isSuperAdmin = await PermissionService.hasPermission(
          userId,
          '*:*',
          application,
          rolePermissionIds
        );
        
        if (isSuperAdmin) {
          return next();
        }
      }

      // Check for any of the required permissions
      for (const perm of permissions) {
        const hasPermission = await PermissionService.hasPermission(
          userId,
          perm,
          application,
          rolePermissionIds
        );
        if (hasPermission) {
          return next();
        }
      }
      throw new ForbiddenError('Insufficient permissions');
    } catch (error) {
      next(error);
    }
  };
}
