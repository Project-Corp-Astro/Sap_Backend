import { Request, Response, NextFunction } from 'express';
import { RequestHandler } from 'express';
import roleService from '../services/role.service';
import userServiceLogger from '../utils/logger';

const logger = userServiceLogger;

class RoleController {
  /**
   * Get all roles
   */
  getAllRoles: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roles = await roleService.getAllRoles();
      
      res.status(200).json({
        success: true,
        message: 'Roles retrieved successfully',
        data: roles
      });
    } catch (error) {
      logger.error('Error in getAllRoles controller:', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Get role by ID
   */
  getRoleById: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const role = await roleService.getRoleById(id);
      
      if (!role) {
        res.status(404).json({
          success: false,
          message: 'Role not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Role retrieved successfully',
        data: role
      });
    } catch (error) {
      logger.error('Error in getRoleById controller:', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Create a new role
   */
  createRole: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roleData = req.body;
      const role = await roleService.createRole(roleData);
      
      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: role
      });
    } catch (error) {
      logger.error('Error in createRole controller:', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Update a role
   */
  updateRole: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const roleData = req.body;
      
      const role = await roleService.updateRole(id, roleData);
      
      if (!role) {
        res.status(404).json({
          success: false,
          message: 'Role not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Role updated successfully',
        data: role
      });
    } catch (error) {
      logger.error('Error in updateRole controller:', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Update role permissions
   */
  updateRolePermissions: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { permissions } = req.body;
      
      if (!Array.isArray(permissions)) {
        res.status(400).json({
          success: false,
          message: 'Permissions must be an array of permission IDs'
        });
        return;
      }
      
      const role = await roleService.updateRolePermissions(id, permissions);
      
      if (!role) {
        res.status(404).json({
          success: false,
          message: 'Role not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Role permissions updated successfully',
        data: role
      });
    } catch (error) {
      logger.error('Error in updateRolePermissions controller:', { error: (error as Error).message });
      next(error);
    }
  }

  /**
   * Delete a role
   */
  deleteRole: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const deleted = await roleService.deleteRole(id);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Role not found'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Role deleted successfully'
      });
    } catch (error) {
      logger.error('Error in deleteRole controller:', { error: (error as Error).message });
      next(error);
    }
  }
}

export default new RoleController();
