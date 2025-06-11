import { Request, Response, NextFunction } from 'express';
import { RequestHandler } from 'express';
import userPermissionService from '../services/user-permission.service';
import userServiceLogger from '../utils/logger';

const logger = userServiceLogger;

class UserPermissionController {
  /**
   * Get all permissions for a user
   */
  getUserPermissions: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      const permissions = await userPermissionService.getUserPermissions(userId);
      
      res.status(200).json({
        success: true,
        message: 'User permissions retrieved successfully',
        data: permissions
      });
    } catch (error) {
      logger.error('Error in getUserPermissions controller:', { error: (error as Error).message });
      
      if ((error as Error).message === 'User not found') {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }
      
      next(error);
    }
  }

  /**
   * Assign roles to a user
   */
  assignRolesToUser: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      const { roleIds } = req.body;
      
      if (!Array.isArray(roleIds)) {
        res.status(400).json({
          success: false,
          message: 'roleIds must be an array of role IDs'
        });
        return;
      }
      
      const user = await userPermissionService.assignRolesToUser(userId, roleIds);
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Roles assigned to user successfully',
        data: user
      });
    } catch (error) {
      logger.error('Error in assignRolesToUser controller:', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Assign direct permissions to a user
   */
  assignPermissionsToUser: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      const { permissionIds } = req.body;
      
      // Debug logging
      logger.info('Assigning permissions to user', { 
        userId, 
        permissionIds, 
        body: req.body,
        headers: req.headers
      });
      
      if (!Array.isArray(permissionIds)) {
        logger.warn('Invalid permissionIds format', { permissionIds });
        res.status(400).json({
          success: false,
          message: 'permissionIds must be an array of permission IDs'
        });
        return;
      }
      
      // Log before service call
      logger.info('Calling userPermissionService.assignPermissionsToUser', { userId, permissionIds });
      
      const user = await userPermissionService.assignPermissionsToUser(userId, permissionIds);
      
      // Log after service call
      logger.info('Service call completed', { userId, userFound: !!user });
      
      if (!user) {
        logger.warn('User not found', { userId });
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }
      
      // Log success
      logger.info('Permissions assigned successfully', { 
        userId, 
        permissionIds, 
        userPermissions: user.permissions?.length || 0 
      });
      
      res.status(200).json({
        success: true,
        message: 'Permissions assigned to user successfully',
        data: user
      });
    } catch (error) {
      logger.error('Error in assignPermissionsToUser controller:', { 
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: req.params.userId
      });
      next(error);
    }
  }

  /**
   * Assign system role to a user
   */
  assignSystemRoleToUser: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      const { systemRole } = req.body;
      
      if (!systemRole) {
        res.status(400).json({
          success: false,
          message: 'systemRole is required'
        });
        return;
      }
      
      const user = await userPermissionService.assignSystemRoleToUser(userId, systemRole);
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'System role assigned to user successfully',
        data: user
      });
    } catch (error) {
      logger.error('Error in assignSystemRoleToUser controller:', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Migrate legacy permissions for a user
   */
  migrateLegacyPermissions: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.params;
      
      const user = await userPermissionService.migrateLegacyPermissions(userId);
      
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Legacy permissions migrated successfully',
        data: user
      });
    } catch (error) {
      logger.error('Error in migrateLegacyPermissions controller:', { error: (error as Error).message });
      next(error);
    }
  }
}

export default new UserPermissionController();
