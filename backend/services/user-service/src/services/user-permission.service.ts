import userServiceLogger from '../utils/logger';
import User from '../models/User';
import Role from '../models/Role';
import Permission from '../models/Permission';
import { UserDocument } from '../interfaces/shared-types';
import redisClient from '../../../../shared/utils/redis';
import roleService from './role.service';

const logger = userServiceLogger;

class UserPermissionService {
  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<any[]> {
    try {
      const cacheKey = `user:permissions:${userId}`;
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      // Get user with populated permissions and roles
      const user = await User.findById(userId)
        .populate('permissions')
        .populate({
          path: 'roles',
          populate: {
            path: 'permissions'
          }
        });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Combine direct permissions and role-based permissions
      const directPermissions = user.permissions || [];
      const rolePermissions = user.roles?.flatMap(role => role.permissions || []) || [];
      
      // Include legacy permissions if they exist
      let legacyPermissionDocs: any[] = [];
      if (user.permissionsLegacy && user.permissionsLegacy.length > 0) {
        legacyPermissionDocs = await Permission.find({ id: { $in: user.permissionsLegacy } });
      }
      
      // Combine all permissions and remove duplicates
      const allPermissions = [...directPermissions, ...rolePermissions, ...legacyPermissionDocs];
      const uniquePermissions = Array.from(
        new Map(allPermissions.map(p => [p.id, p])).values()
      );
      
      // Cache for 15 minutes
      await redisClient.set(cacheKey, JSON.stringify(uniquePermissions), 900);
      
      return uniquePermissions;
    } catch (error) {
      logger.error('Error getting user permissions:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Check if a user has a specific permission
   */
  async hasPermission(userId: string, permissionId: string): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId);
      return permissions.some(p => p.id === permissionId);
    } catch (error) {
      logger.error('Error checking user permission:', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Check if a user has any of the specified permissions
   */
  async hasAnyPermission(userId: string, permissionIds: string[]): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId);
      return permissions.some(p => permissionIds.includes(p.id));
    } catch (error) {
      logger.error('Error checking user permissions:', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Check if a user has all of the specified permissions
   */
  async hasAllPermissions(userId: string, permissionIds: string[]): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId);
      const userPermissionIds = permissions.map(p => p.id);
      return permissionIds.every(id => userPermissionIds.includes(id));
    } catch (error) {
      logger.error('Error checking user permissions:', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Assign roles to a user
   */
  async assignRolesToUser(userId: string, roleIds: string[]): Promise<UserDocument | null> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { roles: roleIds } },
        { new: true }
      );
      
      // Clear user permissions cache
      await redisClient.del(`user:permissions:${userId}`);
      await redisClient.del(`user:${userId}`);
      
      return user;
    } catch (error) {
      logger.error('Error assigning roles to user:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Assign direct permissions to a user
   */
  async assignPermissionsToUser(userId: string, permissionIds: string[]): Promise<UserDocument | null> {
    try {
      logger.info('Starting assignPermissionsToUser', { userId, permissionIds });
      
      let permissions = [];
      
      // Check if the permissionIds are ObjectIDs or string IDs
      const isObjectIdFormat = permissionIds.length > 0 && 
        /^[0-9a-fA-F]{24}$/.test(permissionIds[0]);
      
      if (isObjectIdFormat) {
        // If they are ObjectIDs, search by _id
        permissions = await Permission.find({ 
          $or: [
            { _id: { $in: permissionIds } },
            { id: { $in: permissionIds } }
          ]
        });
        logger.info('Searching permissions by ObjectID', { isObjectIdFormat });
      } else {
        // Otherwise search by string id field
        permissions = await Permission.find({ id: { $in: permissionIds } });
        logger.info('Searching permissions by string ID', { isObjectIdFormat });
      }
      
      // Log found permissions
      logger.info('Found permissions', { 
        requestedCount: permissionIds.length, 
        foundCount: permissions.length,
        foundPermissions: permissions.map(p => p.id)
      });
      
      // Check if any permissions were not found
      const foundPermissionIds = isObjectIdFormat 
        ? permissions.map(p => p._id.toString())
        : permissions.map(p => p.id);
      
      const missingPermissionIds = permissionIds.filter(id => 
        !foundPermissionIds.includes(isObjectIdFormat ? id : id));
      
      if (missingPermissionIds.length > 0) {
        logger.warn('Some permission IDs were not found', { missingPermissionIds });
      }
      
      // Convert permissions to ObjectIds for MongoDB
      const permissionObjectIds = permissions.map(p => p._id);
      logger.info('Permission ObjectIds', { permissionObjectIds: permissionObjectIds.map(id => id.toString()) });
      
      // Find user first to check if exists
      const existingUser = await User.findById(userId);
      if (!existingUser) {
        logger.warn('User not found', { userId });
        return null;
      }
      
      logger.info('Found user', { userId, username: existingUser.username });
      
      // Update user with permissions
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { permissions: permissionObjectIds } },
        { new: true }
      );
      
      // Log updated user
      logger.info('Updated user', { 
        userId, 
        username: user?.username,
        permissionsCount: user?.permissions?.length || 0
      });
      
      // Clear user permissions cache with timeout protection
      try {
        await Promise.all([
          redisClient.del(`user:permissions:${userId}`),
          redisClient.del(`user:${userId}`)
        ]);
        logger.info('User cache cleared', { userId });
      } catch (cacheError) {
        logger.warn('Failed to clear user cache', { 
          userId, 
          error: (cacheError as Error).message 
        });
        // Continue even if cache clearing fails
      }
      
      return user;
    } catch (error) {
      logger.error('Error assigning permissions to user:', { 
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId,
        permissionIds
      });
      throw error;
    }
  }

  /**
   * Migrate legacy permissions to the new system
   */
  async migrateLegacyPermissions(userId: string): Promise<UserDocument | null> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      if (!user.permissionsLegacy || user.permissionsLegacy.length === 0) {
        return user; // No legacy permissions to migrate
      }
      
      // Get permission documents by their IDs
      const permissions = await Permission.find({ id: { $in: user.permissionsLegacy } });
      
      // Update user with new permission references
      user.permissions = permissions.map(p => p._id);
      user.permissionsLegacy = []; // Clear legacy permissions
      
      await user.save();
      
      // Clear user permissions cache
      await redisClient.del(`user:permissions:${userId}`);
      await redisClient.del(`user:${userId}`);
      
      return user;
    } catch (error) {
      logger.error('Error migrating legacy permissions:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Assign system role to a user
   */
  async assignSystemRoleToUser(userId: string, systemRoleName: string): Promise<UserDocument | null> {
    try {
      // Get the role by system role name
      const role = await roleService.getRoleBySystemRole(systemRoleName);
      if (!role) {
        throw new Error(`Role with system name ${systemRoleName} not found`);
      }
      
      // Update user with the role
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          $set: { 
            role: systemRoleName,
            roles: [role._id]
          } 
        },
        { new: true }
      );
      
      // Clear user permissions cache
      await redisClient.del(`user:permissions:${userId}`);
      await redisClient.del(`user:${userId}`);
      
      return user;
    } catch (error) {
      logger.error('Error assigning system role to user:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Clear user permissions cache
   */
  async clearUserPermissionsCache(userId: string): Promise<void> {
    try {
      await redisClient.del(`user:permissions:${userId}`);
    } catch (error) {
      logger.error('Error clearing user permissions cache:', { error: (error as Error).message });
    }
  }
}

export default new UserPermissionService();
