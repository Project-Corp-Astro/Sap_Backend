import { Request, Response, NextFunction } from 'express';
import { RequestHandler } from 'express';
import permissionService from '../services/permission.service';
import userServiceLogger from '../utils/logger';

const logger = userServiceLogger;

class PermissionController {
  /**
   * Get all permissions
   */
  getAllPermissions: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const permissions = await permissionService.getAllPermissions();
      
      res.status(200).json({
        success: true,
        message: 'Permissions retrieved successfully',
        data: permissions
      });
    } catch (error) {
      logger.error('Error in getAllPermissions controller:', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Get permissions by resource
   */
  getPermissionsByResource: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { resource } = req.params;
      const permissions = await permissionService.getPermissionsByResource(resource);
      
      res.status(200).json({
        success: true,
        message: `Permissions for resource '${resource}' retrieved successfully`,
        data: permissions
      });
    } catch (error) {
      logger.error('Error in getPermissionsByResource controller:', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Create a new permission
   */
  createPermission: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const permissionData = req.body;
      const permission = await permissionService.createPermission(permissionData);
      
      res.status(201).json({
        success: true,
        message: 'Permission created successfully',
        data: permission
      });
    } catch (error) {
      logger.error('Error in createPermission controller:', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Update a permission
   */
  updatePermission: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const permissionData = req.body;
      
      const permission = await permissionService.updatePermission(id, permissionData);
      
      if (!permission) {
        res.status(404).json({
          success: false,
          message: 'Permission not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Permission updated successfully',
        data: permission
      });
    } catch (error) {
      logger.error('Error in updatePermission controller:', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Delete a permission
   */
  deletePermission: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const deleted = await permissionService.deletePermission(id);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Permission not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Permission deleted successfully'
      });
    } catch (error) {
      logger.error('Error in deletePermission controller:', { error: (error as Error).message });
      next(error);
    }
  }
}

export default new PermissionController();
