import userServiceLogger from '../utils/logger';
import Permission, { PermissionDocument } from '../models/Permission';
// Import Permission type instead of the undefined VALID_PERMISSIONS
import { Permission as PermissionType } from '@corp-astro/shared-types';
import redisClient from '../../../../shared/utils/redis';

// Define our own VALID_PERMISSIONS based on the hardcoded PERMISSION_IDS from User model
const PERMISSION_IDS = [
  'system.view',
  'system.configure',
  'system.manage_roles',
  'system.view_logs',
  'users.view',
  'users.create',
  'users.edit',
  'users.delete',
  'users.impersonate',
  'content.view',
  'content.create',
  'content.edit',
  'content.delete',
  'content.publish',
  'content.approve',
  'analytics.view',
  'analytics.export',
  'analytics.configure',
  'app.corpastra.manage',
  'app.grahvani.manage',
  'app.tellmystars.manage'
];

// Create VALID_PERMISSIONS array with proper structure matching the Permission interface
const VALID_PERMISSIONS: PermissionType[] = PERMISSION_IDS.map(id => {
  const [resource, action] = id.split('.');
  return {
    id,
    name: `${resource} ${action}`.replace(/\b\w/g, c => c.toUpperCase()),
    description: `Permission to ${action} ${resource}`,
    resource,
    action: action as any
  };
});

const logger = userServiceLogger;

class PermissionService {
  /**
   * Initialize permissions in the database from VALID_PERMISSIONS
   */
  async initializePermissions(): Promise<void> {
    try {
      const count = await Permission.countDocuments();
      if (count === 0) {
        logger.info('Initializing permissions from VALID_PERMISSIONS');
        
        const permissions = VALID_PERMISSIONS.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          resource: p.resource,
          action: p.action
        }));
        
        await Permission.insertMany(permissions);
        logger.info(`Initialized ${permissions.length} permissions`);
      }
    } catch (error) {
      logger.error('Error initializing permissions:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<PermissionDocument[]> {
    try {
      // First try to get fresh data from the database
      const permissions = await Permission.find().sort({ resource: 1, action: 1 });
      
      // Try to update the cache with the fresh data
      try {
        const cacheKey = 'permissions:all';
        // Use a Promise with timeout to avoid hanging on Redis operations
        const delPromise = new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Redis DEL operation timed out'));
          }, 3000);
          
          redisClient.del(cacheKey)
            .then(() => {
              clearTimeout(timeoutId);
              resolve();
            })
            .catch(err => {
              clearTimeout(timeoutId);
              reject(err);
            });
        });
        
        await delPromise.catch(err => {
          logger.warn(`Failed to delete Redis key ${cacheKey}: ${err.message}`);
          // Continue execution even if this fails
        });
        
        // Convert mongoose documents to plain objects before stringifying
        const plainPermissions = permissions.map(p => ({
          _id: p._id.toString(),
          id: p.id,
          name: p.name,
          description: p.description,
          resource: p.resource,
          action: p.action
        }));
        
        // Store as JSON string with timeout protection
        const setPromise = new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Redis SET operation timed out'));
          }, 3000);
          
          redisClient.set(cacheKey, JSON.stringify(plainPermissions), 3600)
            .then(() => {
              clearTimeout(timeoutId);
              resolve();
            })
            .catch(err => {
              clearTimeout(timeoutId);
              reject(err);
            });
        });
        
        await setPromise.catch(err => {
          logger.warn(`Failed to set Redis key ${cacheKey}: ${err.message}`);
          // Continue execution even if this fails
        });
        
        logger.info('Permission cache updated successfully');
      } catch (cacheError) {
        logger.error('Error updating permission cache:', { error: (cacheError as Error).message });
        // Continue even if caching fails
      }
      
      return permissions;
    } catch (error) {
      logger.error('Error getting permissions:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get permissions by IDs
   */
  async getPermissionsByIds(ids: string[]): Promise<PermissionDocument[]> {
    try {
      return await Permission.find({ id: { $in: ids } });
    } catch (error) {
      logger.error('Error getting permissions by IDs:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get permissions by resource
   */
  async getPermissionsByResource(resource: string): Promise<PermissionDocument[]> {
    try {
      // Get directly from database to ensure fresh data
      const permissions = await Permission.find({ resource });
      
      // Try to update the cache for this resource
      try {
        const cacheKey = `permissions:resource:${resource}`;
        // Delete any existing cache first to avoid corruption
        await redisClient.del(cacheKey);
        
        // Convert mongoose documents to plain objects before stringifying
        const plainPermissions = permissions.map(p => ({
          _id: p._id.toString(),
          id: p.id,
          name: p.name,
          description: p.description,
          resource: p.resource,
          action: p.action
        }));
        
        // Store as JSON string with 1 hour expiration
        await redisClient.set(cacheKey, JSON.stringify(plainPermissions), 3600);
      } catch (cacheError) {
        logger.error(`Error caching permissions for resource ${resource}:`, { error: (cacheError as Error).message });
        // Continue even if caching fails
      }
      
      return permissions;
    } catch (error) {
      logger.error('Error getting permissions by resource:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Create a new permission
   */
  async createPermission(permissionData: Partial<PermissionDocument>): Promise<PermissionDocument> {
    try {
      const permission = new Permission(permissionData);
      await permission.save();
      
      // Clear permissions cache
      await redisClient.del('permissions:all');
      
      return permission;
    } catch (error) {
      logger.error('Error creating permission:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Update a permission
   */
  async updatePermission(id: string, permissionData: Partial<PermissionDocument>): Promise<PermissionDocument | null> {
    try {
      const permission = await Permission.findOneAndUpdate(
        { id },
        { $set: permissionData },
        { new: true }
      );
      
      // Clear permissions cache
      await redisClient.del('permissions:all');
      
      return permission;
    } catch (error) {
      logger.error('Error updating permission:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Delete a permission
   */
  async deletePermission(id: string): Promise<boolean> {
    try {
      const result = await Permission.deleteOne({ id });
      
      // Clear permissions cache
      await redisClient.del('permissions:all');
      
      return result.deletedCount === 1;
    } catch (error) {
      logger.error('Error deleting permission:', { error: (error as Error).message });
      throw error;
    }
  }
}

export default new PermissionService();