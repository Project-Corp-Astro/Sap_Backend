import UserModel from '../models/User';
import RolePermissionModel from '../models/RolePermission.model';
import { Types } from 'mongoose';

export class PermissionService {
  /**
   * Check if a user has the required permission
   */
  static async hasPermission(
    userId: string | Types.ObjectId,
    requiredPermission: string,
    application: string = '*',
    rolePermissionIds?: string[]
  ): Promise<boolean> {
    try {
      const [requiredResource, requiredAction] = requiredPermission.split(':');

      // If we have rolePermissionIds, use them directly
      if (rolePermissionIds?.length) {
        const roles = await RolePermissionModel.find({
          _id: { $in: rolePermissionIds.map(id => new Types.ObjectId(id)) },
          $or: [
            { application: application },
            { application: '*' }
          ]
        }).lean();

        // Check permissions in each role
        for (const role of roles) {
          // Check if role has wildcard permission
          if (role.permissions?.includes('*:*')) {
            return true;
          }

          // Check specific permission
          if (role.permissions?.includes(requiredPermission)) {
            return true;
          }

          // Check wildcard resource with specific action (e.g., 'user:*')
          const wildcardResource = `*:${requiredPermission.split(':')[1]}`;
          if (role.permissions?.includes(wildcardResource)) {
            return true;
          }
        }
        return false;
      }

      // Fallback to user roles if no rolePermissionIds provided
      const roles = await UserModel.aggregate([
        { $match: { _id: typeof userId === 'string' ? new Types.ObjectId(userId) : userId } },
        { 
          $lookup: {
            from: 'rolepermissions',
            localField: 'roles',
            foreignField: '_id',
            as: 'roleData',
            pipeline: [
              {
                $match: {
                  $or: [
                    { application: application },
                    { application: '*' }
                  ]
                }
              }
            ]
          }
        },
        { $unwind: { path: '$roleData', preserveNullAndEmptyArrays: false } }
      ]).exec();

      const rolesToCheck = roles.map(r => r.roleData);
      
      for (const role of rolesToCheck) {
        // Normalize permissions to array of { resource, action } objects
        const normalizedPermissions = Array.isArray(role.permissions) 
          ? role.permissions.map(p => {
              if (typeof p === 'string') {
                const [resource, action] = p.split(':');
                return { resource, action };
              }
              return p;
            })
          : [];

        // Check if role has wildcard permission
        if (normalizedPermissions.some(p => p.resource === '*' && p.action === '*')) {
          return true;
        }

        // Check specific permission
        if (normalizedPermissions.some(p => {
          return (p.resource === requiredResource || p.resource === '*') && 
                 (p.action === requiredAction || p.action === '*');
        })) {
          return true;
        }
      }
      
      return false;
    } catch (err) {
      console.error('Error in hasPermission:', err);
      return false;
    }
  }

  /**
   * Get all permissions for a user
   */
  static async getUserPermissions(
    userId: string | Types.ObjectId,
    application: string = '*'
  ): Promise<string[]> {
    try {
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      const results = await UserModel.aggregate([
        { $match: { _id: userObjectId } },
        { 
          $lookup: {
            from: 'rolepermissions',
            localField: 'roles',
            foreignField: '_id',
            as: 'roleData'
          }
        },
        { $unwind: '$roleData' },
        {
          $match: {
            $or: [
              { 'roleData.application': application },
              { 'roleData.application': '*' }
            ]
          }
        },
        {
          $project: {
            permissions: '$roleData.permissions'
          }
        }
      ]).exec();

      const allPermissions = new Set<string>();
      results.forEach(role => {
        (role.permissions || []).forEach((perm: string) => allPermissions.add(perm));
      });

      return Array.from(allPermissions);
    } catch (err) {
      console.error('Error in getUserPermissions aggregate:', err);
      return [];
    }
  }

  /**
   * Check if a role has a specific permission
   */
  static async roleHasPermission(
    roleId: string | Types.ObjectId,
    requiredPermission: string
  ): Promise<boolean> {
    try {
      const roleObjectId = typeof roleId === 'string' ? new Types.ObjectId(roleId) : roleId;
      const role = await RolePermissionModel.findById(roleObjectId).lean();

      if (!role) return false;

      const [requiredResource, requiredAction] = requiredPermission.split(':');
      
      // Normalize permissions
      const normalizedPermissions = Array.isArray(role.permissions) 
        ? role.permissions.map(p => {
            if (typeof p === 'string') {
              const [resource, action] = p.split(':');
              return { resource, action };
            }
            return p;
          })
        : [];

      // Check wildcard permission
      if (normalizedPermissions.some(p => p.resource === '*' && p.action === '*')) {
        return true;
      }

      // Check specific permission
      return normalizedPermissions.some(p => {
        return (p.resource === requiredResource || p.resource === '*') && 
               (p.action === requiredAction || p.action === '*');
      });
    } catch (err) {
      console.error('Error in roleHasPermission:', err);
      return false;
    }
  }
}
