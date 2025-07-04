import { Request, Response } from 'express';
import RolePermissionModel from '../models/RolePermission.model';
import UserModel from '../../../../models/mongodb/User.model';
import { BadRequestError, NotFoundError } from '../../../../src/scripts/utils/errors';

interface ValidationError {
  param: string;
  msg: string;
  value?: any;
}

function validateRequest(req: Request, requiredFields: string[] = []): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of requiredFields) {
    if (req.body[field] === undefined || req.body[field] === '') {
      errors.push({
        param: field,
        msg: `${field} is required`,
        value: req.body[field]
      });
    }
  }

  return errors;
}

export const RoleController = {
  /**
   * Create a new role with permissions
   */
  async createRole(req: Request, res: Response) {
    const errors = validateRequest(req, ['role', 'application', 'permissions']);
    if (errors.length > 0) {
      throw new BadRequestError(JSON.stringify({
        message: 'Validation failed',
        errors
      }));
    }

    const { role, application, permissions } = req.body;

    const existingRole = await RolePermissionModel.findOne({ role, application });
    if (existingRole) {
      throw new BadRequestError(`Role '${role}' already exists for application '${application}'`);
    }

    const newRole = new RolePermissionModel({
      role,
      application,
      permissions,
      version: 1
    });

    await newRole.save();

    res.status(201).json({
      success: true,
      data: newRole
    });
  },

  /**
   * Update role permissions
   */
  async updateRolePermissions(req: Request, res: Response) {
    const { roleId } = req.params;
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      throw new BadRequestError('Permissions must be an array');
    }

    // Add new permissions to existing ones without duplicates
    const updatedRole = await RolePermissionModel.findByIdAndUpdate(
      roleId,
      { 
        $addToSet: { permissions: { $each: permissions } },
        $currentDate: { updatedAt: true }
      },
      { new: true, runValidators: true }
    );

    if (!updatedRole) {
      throw new NotFoundError('Role not found');
    }

    res.json({
      success: true,
      data: updatedRole
    });
  },

  /**
   * Assign role to user
   */
  async assignRoleToUser(req: Request, res: Response) {
    const errors = validateRequest(req, ['role', 'application']);
    if (errors.length > 0) {
      throw new BadRequestError(JSON.stringify({
        message: 'Validation failed',
        errors
      }));
    }

    const { userId } = req.params;
    const { role, application } = req.body;

    const rolePermission = await RolePermissionModel.findOne({ role, application });
    if (!rolePermission) {
      throw new NotFoundError(`Role '${role}' not found for application '${application}'`);
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Remove any existing role assignment for same role
    user.roles = user.roles.filter(
      roleId => !roleId.equals(rolePermission._id)
    );

    // Add the new role reference
    user.roles.push(rolePermission._id);

    await user.save();

    res.json({
      success: true,
      data: user
    });
  },

  /**
   * List all roles
   */
  async listRoles(req: Request, res: Response) {
    const { application } = req.query;

    const query: any = {};
    if (application) {
      query.application = application;
    }

    const roles = await RolePermissionModel.find(query);

    res.json({
      success: true,
      data: roles
    });
  },

  /**
   * Get role details
   */
  async getRole(req: Request, res: Response) {
    const { roleId } = req.params;
    const role = await RolePermissionModel.findById(roleId);

    if (!role) {
      throw new NotFoundError('Role not found');
    }

    res.json({
      success: true,
      data: role
    });
  },

  /**
   * Delete role
   */
  async deleteRole(req: Request, res: Response) {
    const { roleId } = req.params;

    const usersWithRole = await UserModel.countDocuments({
      'roles': roleId
    });

    if (usersWithRole > 0) {
      throw new BadRequestError('Cannot delete role that is assigned to users');
    }

    const result = await RolePermissionModel.findByIdAndDelete(roleId);

    if (!result) {
      throw new NotFoundError('Role not found');
    }

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });
  }
};
