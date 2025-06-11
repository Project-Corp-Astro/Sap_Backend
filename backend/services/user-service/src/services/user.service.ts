import bcrypt from 'bcrypt';
import userServiceLogger from '../utils/logger';
import User from '../models/User';
import UserActivity, { ActivityType } from '../models/UserActivity';
import UserDevice from '../models/UserDevice';
import { trackDatabaseOperation } from '../utils/performance';
import {
  UserDocument,
  ExtendedUser,
  UserFilter,
  UserPaginationResult,
  SecurityPreferences,
  ActivityFilter,
  ActivityPaginationResult
} from '../interfaces/shared-types';
import { UserRole, VALID_PERMISSIONS, Permission } from '@corp-astro/shared-types';
import redisClient from '../../../../shared/utils/redis';

const logger = userServiceLogger;

// Temporary fallback to match User.ts
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

class UserService {
  constructor() {
    // Clear users cache on service initialization to prevent issues with corrupted cache
    this.clearUsersCache().catch(err => {
      logger.error('Failed to clear users cache on initialization:', { error: err.message });
    });
  }

  async createUser(userData: Partial<UserDocument>): Promise<UserDocument> {
    try {
      const cacheKey = `user:check:${userData.email}`;
      const cachedCheck = await redisClient.get(cacheKey);
      
      if (cachedCheck) {
        const check = JSON.parse(cachedCheck);
        if (check.email === userData.email) throw new Error('Email already in use');
      }

      const existingUser = await trackDatabaseOperation<UserDocument | null>('findUser', () =>
        User.findOne({ email: userData.email }).exec()
      );

      if (existingUser) {
        await redisClient.set(cacheKey, JSON.stringify({
          email: existingUser.email
        }), 300);
        throw new Error('Email already in use');
      }

      const user = new User({
        ...userData,
        role: userData.role ?? UserRole.USER,
        password: userData.password ? await bcrypt.hash(userData.password, 10) : await bcrypt.hash('Temp123!', 10),
        preferences: userData.preferences ?? {
          theme: 'system',
          notifications: { email: true, push: true }
        },
        securityPreferences: userData.securityPreferences ?? {
          twoFactorEnabled: false,
          loginNotifications: true,
          activityAlerts: true
        },
        isActive: true,
        isMfaEnabled: false
      });

      logger.debug('Attempting to save user:', user.toObject());

      try {
        await trackDatabaseOperation('saveUser', () => user.save());
      } catch (saveError) {
        logger.error('User save failed:', {
          error: (saveError as Error).message,
          stack: (saveError as Error).stack,
          data: user.toObject()
        });
        throw saveError;
      }

      await redisClient.del('users:*');
      await redisClient.del(`user:${user._id}`);
      await redisClient.del(cacheKey);
      return user;
    } catch (error) {
      logger.error('Error creating user:', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Clear all users cache entries
   */
  async clearUsersCache(): Promise<void> {
    try {
      const keys = await redisClient.keys('users:*');
      if (keys.length > 0) {
        await Promise.all(keys.map(key => redisClient.del(key)));
        logger.info(`Cleared ${keys.length} users cache entries`);
      }
    } catch (error) {
      logger.error('Error clearing users cache:', { error: (error as Error).message });
    }
  }

  async getUsers(filters: UserFilter, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc'): Promise<UserPaginationResult> {
    try {
      // Create a serializable version of the filters object
      const serializableFilters: Record<string, any> = {};
      
      // Only include primitive values that can be safely serialized
      if (filters) {
        Object.keys(filters).forEach(key => {
          const value = filters[key as keyof UserFilter];
          if (value !== undefined && value !== null && 
              (typeof value === 'string' || 
               typeof value === 'number' || 
               typeof value === 'boolean')) {
            serializableFilters[key] = value;
          }
        });
      }
      
      const cacheKey = `users:${JSON.stringify({ 
        filters: serializableFilters, 
        page, 
        limit, 
        sortBy, 
        sortOrder 
      })}`;
      
      // Try to get from cache, but handle any errors
      let cachedData = null;
      try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          cachedData = JSON.parse(cached);
        }
      } catch (cacheError) {
        logger.error('Error retrieving or parsing cached users data:', { error: (cacheError as Error).message });
        // Clear the problematic cache entry
        try {
          await redisClient.del(cacheKey);
          logger.info(`Cleared problematic cache entry: ${cacheKey}`);
        } catch (clearError) {
          logger.error('Error clearing problematic cache:', { error: (clearError as Error).message });
        }
      }
      
      if (cachedData) {
        return cachedData;
      }

      const query: Record<string, any> = { ...filters };
      
      if (query.search) {
        const regex = new RegExp(query.search, 'i');
        query.$or = [
          { email: regex },
          { firstName: regex },
          { lastName: regex }
        ];
        delete query.search;
      }

      const totalUsers = await trackDatabaseOperation<number>('countUsers', () => 
        User.countDocuments(query).exec()
      );
      
      const skip = (page - 1) * limit;
      const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
      const users = await trackDatabaseOperation<UserDocument[]>('findUsers', () =>
        User.find(query).sort(sort).skip(skip).limit(limit).exec()
      );

      // We need to maintain the original users array for the return type
      // but create a serializable version for caching
      const serializableUsers = users.map(user => user.toObject ? user.toObject() : user);
      
      // Create a serializable result for caching
      const cacheResult = { 
        users: serializableUsers, 
        totalUsers, 
        totalPages: Math.ceil(totalUsers / limit), 
        currentPage: page, 
        usersPerPage: limit 
      };
      
      // Create the actual result that matches UserPaginationResult type
      const result: UserPaginationResult = {
        users, // Use the original Mongoose documents
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
        currentPage: page,
        usersPerPage: limit
      };
      
      try {
        await redisClient.set(cacheKey, JSON.stringify(cacheResult), 300);
      } catch (cacheError) {
        logger.error('Error caching users data:', { error: (cacheError as Error).message });
        // Continue even if caching fails
      }
      
      return result;
    } catch (error) {
      logger.error('Error getting users:', { error: (error as Error).message });
      throw error;
    }
  }

  async getUserById(userId: string): Promise<UserDocument> {
    try {
      const cacheKey = `user:${userId}`;
      logger.debug('Checking Redis cache', { cacheKey, userId });
  
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          logger.info('✅ Served from Redis cache', { cacheKey, userId });
          return parsed as UserDocument;
        } catch (parseError) {
          logger.error('Failed to parse cached user data', {
            error: (parseError as Error).message,
            cacheKey,
            cachedValue: cached,
            userId
          });
          await redisClient.del(cacheKey);
        }
      }
      logger.info('🗄️ Fetched from MongoDB', { cacheKey, userId });
  
      const user = await trackDatabaseOperation<UserDocument | null>('findUserById', () => User.findById(userId).exec());
      if (!user) {
        logger.warn(`User not found with ID: ${userId}`, { userId });
        throw new Error('User not found');
      }
  
      const userObject = user.toObject();
      try {
        const serialized = JSON.stringify(userObject);
        logger.debug('Storing user data in Redis', { cacheKey, userId, serializedLength: serialized.length });
        await redisClient.set(cacheKey, serialized, 300);
        logger.debug('Successfully stored user data in Redis', { cacheKey, userId });
      } catch (cacheError) {
        logger.error('Failed to cache user data in Redis', {
          error: (cacheError as Error).message,
          cacheKey,
          userId
        });
      }
  
      return user;
    } catch (error) {
      logger.error('Error getting user by ID', { error: (error as Error).message, userId });
      throw error;
    }
  } 

  async updateUser(userId: string, updateData: Partial<UserDocument>): Promise<UserDocument> {
    try {
      // Log the incoming update data for debugging
      logger.debug('Updating user with data:', { userId, updateData: JSON.stringify(updateData) });
      
      // Handle email check if email is being updated
      const cacheKey = `user:check:${updateData.email}`;
      if (updateData.email) {
        const cachedCheck = await redisClient.get(cacheKey);
        if (cachedCheck) {
          const check = JSON.parse(cachedCheck);
          if (updateData.email === check.email) throw new Error('Email already in use');
        }

        const existing = await User.findOne({ email: updateData.email, _id: { $ne: userId } });
        if (existing) {
          await redisClient.set(cacheKey, JSON.stringify({
            email: existing.email
          }), 300);
          throw new Error('Email already in use');
        }
      }
      
      // Create a copy of the update data to modify
      const updateFields: Record<string, any> = {};
      
      // Copy all fields from updateData to updateFields
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof Partial<UserDocument>] !== undefined) {
          updateFields[key] = updateData[key as keyof Partial<UserDocument>];
        }
      });
      
      // Special handling for username field
      // If firstName or lastName is updated but username isn't explicitly set,
      // update the username to match firstName + lastName
      if ((updateData.firstName || updateData.lastName) && !updateData.username) {
        // Get the current user to combine with any updated fields
        const currentUser = await User.findById(userId);
        if (!currentUser) throw new Error('User not found');
        
        const firstName = updateData.firstName || currentUser.firstName;
        const lastName = updateData.lastName || currentUser.lastName;
        
        // Set the username based on firstName and lastName
        updateFields.username = `${firstName} ${lastName}`.trim();
        logger.debug('Automatically updating username:', { username: updateFields.username });
      }
      
      logger.debug('Final update fields:', { updateFields });
      
      // Use findByIdAndUpdate with the prepared update fields
      const user = await User.findByIdAndUpdate(
        userId, 
        { $set: updateFields }, 
        { new: true, runValidators: true }
      );
      
      if (!user) throw new Error('User not found');

      // Clear cache entries
      await redisClient.del(`user:${userId}`);
      await redisClient.del('users:*');
      if (updateData.email) await redisClient.del(cacheKey);
      
      return user;
    } catch (error) {
      logger.error('Error updating user:', { error: (error as Error).message, userId });
      throw error;
    }
  }

  async updateUserPermissions(userId: string, permissions: string[]): Promise<UserDocument> {
    try {
      if (!Array.isArray(permissions)) {
        throw new Error('Permissions must be an array');
      }

      // Use PERMISSION_IDS as fallback until VALID_PERMISSIONS import is fixed
      const validPermissionIds = PERMISSION_IDS; // VALID_PERMISSIONS.map(p => p.id);
      const invalidPermissions = permissions.filter(perm => !validPermissionIds.includes(perm));
      if (invalidPermissions.length > 0) {
        throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
      }

      const user = await trackDatabaseOperation<UserDocument | null>('updateUserPermissions', () =>
        User.findByIdAndUpdate(userId, { $set: { permissions } }, { new: true }).exec()
      );
      if (!user) {
        logger.warn(`User not found with ID: ${userId}`, { userId });
        throw new Error('User not found');
      }

      await this.logUserActivity(userId, ActivityType.PERMISSIONS_UPDATE, 'User permissions updated', {
        permissionsCount: permissions.length,
        permissions
      });

      await redisClient.del(`user:${userId}`);
      await redisClient.del('users:*');

      logger.info('User permissions updated successfully', { userId, permissionsCount: permissions.length });
      return user;
    } catch (error) {
      logger.error('Error updating user permissions:', { error: (error as Error).message, userId });
      throw error;
    }
  }

  async getAllPermissions(): Promise<Permission[]> {
    try {
      const cacheKey = 'permissions:all';
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        // Handle case where cached is already an object or a JSON string
        if (typeof cached === 'string') {
          try {
            return JSON.parse(cached);
          } catch (parseError) {
            logger.error('Error parsing cached permissions:', { error: (parseError as Error).message });
            // Continue to generate fresh permissions if parsing fails
          }
        } else if (Array.isArray(cached)) {
          // If it's already an array (in case Redis client parses JSON automatically)
          return cached as Permission[];
        }
      }

      // Use PERMISSION_IDS to generate Permission objects until VALID_PERMISSIONS import is fixed
      const permissions: Permission[] = PERMISSION_IDS.map(id => ({
        id,
        name: id.split('.').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        description: `Allows ${id.split('.')[1]} action on ${id.split('.')[0]}`,
        resource: id.split('.')[0],
        action: id.split('.')[1] as 'create' | 'read' | 'update' | 'delete' | 'manage'
      }));

      // Cache permissions for 1 hour
      await redisClient.set(cacheKey, JSON.stringify(permissions), 3600);
      return permissions;
    } catch (error) {
      logger.error('Error getting all permissions:', { error: (error as Error).message });
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<UserDocument> {
    try {
      const user = await User.findByIdAndDelete(userId);
      if (!user) throw new Error('User not found');

      await redisClient.del(`user:${userId}`);
      await redisClient.del('users:*');
      await redisClient.del(`user:${userId}:devices`);
      await redisClient.del(`user:${userId}:activity:*`);
      return user;
    } catch (error) {
      logger.error('Error deleting user:', { error: (error as Error).message, userId });
      throw error;
    }
  }

  async updateUserStatus(userId: string, isActive: boolean): Promise<UserDocument> {
    try {
      const user = await User.findByIdAndUpdate(userId, { $set: { isActive } }, { new: true });
      if (!user) throw new Error('User not found');

      await redisClient.del(`user:${userId}`);
      await redisClient.del('users:*');
      return user;
    } catch (error) {
      logger.error('Error updating user status:', { error: (error as Error).message, userId });
      throw error;
    }
  }

  async updateProfile(userId: string, profileData: Partial<UserDocument>): Promise<UserDocument> {
    try {
      await this.getUserById(userId);
      const allowed: any = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phoneNumber: profileData.phoneNumber,
        address: profileData.address,
        profileImage: profileData.profileImage,
        preferences: profileData.preferences
      };
      Object.keys(allowed).forEach(k => allowed[k] === undefined && delete allowed[k]);
      const updatedUser = await User.findByIdAndUpdate(userId, { $set: allowed }, { new: true });
      if (!updatedUser) throw new Error('User not found');
      await this.logUserActivity(userId, ActivityType.PROFILE_UPDATE, 'Profile updated');

      await redisClient.del(`user:${userId}`);
      await redisClient.del('users:*');
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user profile:', { error: (error as Error).message, userId });
      throw error;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const user = await User.findById(userId).select('+password');
      if (!user) throw new Error('User not found');

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) throw new Error('Current password is incorrect');

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      await this.logUserActivity(userId, ActivityType.PASSWORD_CHANGE, 'Password changed');
      
      await redisClient.del(`user:${userId}`);
      return true;
    } catch (error) {
      logger.error('Error changing password:', { error: (error as Error).message, userId });
      throw error;
    }
  }

  async updateSecurityPreferences(userId: string, securityPreferences: SecurityPreferences): Promise<UserDocument> {
    try {
      await this.getUserById(userId);
      const updatedUser = await User.findByIdAndUpdate(userId, { $set: { securityPreferences } }, { new: true });
      if (!updatedUser) throw new Error('User not found');
      await this.logUserActivity(userId, ActivityType.SECURITY_UPDATE, 'Security preferences updated');

      await redisClient.del(`user:${userId}`);
      await redisClient.del('users:*');
      return updatedUser;
    } catch (error) {
      logger.error('Error updating security preferences:', { error: (error as Error).message, userId });
      throw error;
    }
  }

  async logUserActivity(userId: string, type: ActivityType, description: string, metadata: Record<string, any> = {}): Promise<any> {
    try {
      const activity = new UserActivity({
        user: userId,
        type,
        description,
        metadata,
        ipAddress: metadata.ipAddress || '',
        userAgent: metadata.userAgent || ''
      });
      await activity.save();

      await redisClient.del(`user:${userId}:activity:*`);
      return activity;
    } catch (error) {
      logger.error('Error logging user activity:', { error: (error as Error).message, userId });
      return null;
    }
  }

  async getUserActivity(userId: string, page = 1, limit = 20, filters: ActivityFilter = {}): Promise<ActivityPaginationResult> {
    try {
      await this.getUserById(userId);
      const cacheKey = `user:${userId}:activity:${JSON.stringify({ filters, page, limit })}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const query = { user: userId, ...filters };
      const total = await UserActivity.countDocuments(query);
      const skip = (page - 1) * limit;
      const activities = await UserActivity.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
      
      const result = { 
        activities, 
        totalActivities: total, 
        totalPages: Math.ceil(total / limit), 
        currentPage: page, 
        activitiesPerPage: limit 
      };
      
      await redisClient.set(cacheKey, JSON.stringify(result), 300);
      return result;
    } catch (error) {
      logger.error('Error getting user activity:', { error: (error as Error).message, userId });
      throw error;
    }
  }

  async getUserDevices(userId: string): Promise<any[]> {
    try {
      await this.getUserById(userId);
      const cacheKey = `user:${userId}:devices`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const devices = await UserDevice.find({ user: userId }).sort({ lastUsed: -1 });
      await redisClient.set(cacheKey, JSON.stringify(devices), 300);
      return devices;
    } catch (error) {
      logger.error('Error getting user devices:', { error: (error as Error).message, userId });
      throw error;
    }
  }

  async removeUserDevice(userId: string, deviceId: string): Promise<boolean> {
    try {
      await this.getUserById(userId);
      const device = await UserDevice.findOneAndDelete({ _id: deviceId, user: userId });
      if (!device) throw new Error('Device not found');

      await this.logUserActivity(userId, ActivityType.DEVICE_REMOVED, 'Device removed', { deviceId, deviceName: device.deviceName });

      await redisClient.del(`user:${userId}:devices`);
      await redisClient.del(`user:${userId}:activity:*`);
      return true;
    } catch (error) {
      logger.error('Error removing user device:', { error: (error as Error).message, userId, deviceId });
      throw error;
    }
  }
}

const userService = new UserService();
export default userService;