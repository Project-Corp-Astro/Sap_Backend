import userServiceLogger from '../utils/logger';
import Role, { RoleDocument } from '../models/Role';
import Permission from '../models/Permission';
import { UserRole } from '@corp-astro/shared-types';
import redisClient from '../../../../shared/utils/redis';
import permissionService from './permission.service';

const logger = userServiceLogger;

// Default role configurations
const DEFAULT_ROLES = [
  {
    name: 'Administrator',
    description: 'Full system access',
    systemRole: UserRole.ADMIN,
    permissionIds: [
      'system.view', 'system.configure', 'system.manage_roles', 'system.view_logs',
      'users.view', 'users.create', 'users.edit', 'users.delete', 'users.impersonate',
      'content.view', 'content.create', 'content.edit', 'content.delete', 'content.publish', 'content.approve',
      'analytics.view', 'analytics.export', 'analytics.configure',
      'app.corpastra.manage', 'app.grahvani.manage', 'app.tellmystars.manage'
    ]
  },
  {
    name: 'Manager',
    description: 'Department management access',
    systemRole: UserRole.MANAGER,
    permissionIds: [
      'system.view', 'system.view_logs',
      'users.view', 'users.create', 'users.edit',
      'content.view', 'content.create', 'content.edit', 'content.publish',
      'analytics.view', 'analytics.export'
    ]
  },
  {
    name: 'User',
    description: 'Standard user access',
    systemRole: UserRole.USER,
    permissionIds: [
      'system.view',
      'content.view',
      'analytics.view'
    ]
  }
];

class RoleService {
  /**
   * Initialize default roles in the database
   */
  async initializeRoles(): Promise<void> {
    try {
      const count = await Role.countDocuments();
      if (count === 0) {
        logger.info('Initializing default roles');
        
        // Make sure permissions are initialized first
        await permissionService.initializePermissions();
        
        // Create each default role
        for (const roleConfig of DEFAULT_ROLES) {
          // Get permission documents by their IDs
          const permissions = await Permission.find({ id: { $in: roleConfig.permissionIds } });
          
          // Create the role with references to permission documents
          const role = new Role({
            name: roleConfig.name,
            description: roleConfig.description,
            systemRole: roleConfig.systemRole,
            permissions: permissions.map(p => p._id)
          });
          
          await role.save();
          logger.info(`Created role: ${role.name}`);
        }
        
        logger.info(`Initialized ${DEFAULT_ROLES.length} roles`);
      }
    } catch (error) {
      logger.error('Error initializing roles:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<RoleDocument[]> {
    try {
      const cacheKey = 'roles:all';
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      const roles = await Role.find().populate('permissions').sort({ name: 1 });
      
      // Cache for 1 hour (roles rarely change)
      await redisClient.set(cacheKey, JSON.stringify(roles), 3600);
      
      return roles;
    } catch (error) {
      logger.error('Error getting roles:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get role by ID
   */
  async getRoleById(id: string): Promise<RoleDocument | null> {
    try {
      return await Role.findById(id).populate('permissions');
    } catch (error) {
      logger.error('Error getting role by ID:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get role by system role
   */
  async getRoleBySystemRole(systemRole: string): Promise<RoleDocument | null> {
    try {
      return await Role.findOne({ systemRole }).populate('permissions');
    } catch (error) {
      logger.error('Error getting role by system role:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Create a new role
   */
  async createRole(roleData: Partial<RoleDocument>): Promise<RoleDocument> {
    try {
      const role = new Role(roleData);
      await role.save();
      
      // Clear roles cache
      await redisClient.del('roles:all');
      
      return role;
    } catch (error) {
      logger.error('Error creating role:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Update a role
   */
  async updateRole(id: string, roleData: Partial<RoleDocument>): Promise<RoleDocument | null> {
    try {
      const role = await Role.findByIdAndUpdate(
        id,
        { $set: roleData },
        { new: true }
      );
      
      // Clear roles cache
      await redisClient.del('roles:all');
      
      return role;
    } catch (error) {
      logger.error('Error updating role:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Update role permissions
   */
  async updateRolePermissions(id: string, permissionIds: string[]): Promise<RoleDocument | null> {
    try {
      // Get permission documents by their IDs
      const permissions = await Permission.find({ id: { $in: permissionIds } });
      
      const role = await Role.findByIdAndUpdate(
        id,
        { $set: { permissions: permissions.map(p => p._id) } },
        { new: true }
      ).populate('permissions');
      
      // Clear roles cache
      await redisClient.del('roles:all');
      
      return role;
    } catch (error) {
      logger.error('Error updating role permissions:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(id: string): Promise<boolean> {
    try {
      const result = await Role.deleteOne({ _id: id });
      
      // Clear roles cache
      await redisClient.del('roles:all');
      
      return result.deletedCount === 1;
    } catch (error) {
      logger.error('Error deleting role:', { error: (error as Error).message });
      throw error;
    }
  }
}

export default new RoleService();