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
// Import shared types
import { UserRole } from '@corp-astro/shared-types';
import redisClient from '../../../../shared/utils/redis';

// Initialize logger
const logger = userServiceLogger;

/**
 * User management service
 */
class UserService {
  /**
   * Create a new user
   * @param userData - User data
   * @returns Newly created user
   */
  async createUser(userData: Partial<UserDocument>): Promise<UserDocument> {
    try {
      const cacheKey = `user:check:${userData.email}:${userData.username}`;
      const cachedCheck = await redisClient.get(cacheKey);
      
      if (cachedCheck) {
        const check = JSON.parse(cachedCheck);
        if (check.email === userData.email) throw new Error('Email already in use');
        if (check.username === userData.username) throw new Error('Username already taken');
      }

      const existingUser = await trackDatabaseOperation<UserDocument | null>('findUser', () =>
        User.findOne({ $or: [{ email: userData.email }, { username: userData.username }] }).exec()
      );

      if (existingUser) {
        await redisClient.set(cacheKey, JSON.stringify({
          email: existingUser.email,
          username: existingUser.username
        }), 300);
        if (existingUser.email === userData.email) throw new Error('Email already in use');
        else throw new Error('Username already taken');
      }

      const user = new User({
        ...userData,
        role: userData.role ?? 'user',
        password: userData.password ?? 'Temp123!',
        preferences: userData.preferences ?? {
          theme: 'system',
          notifications: { email: true, push: true },
          language: 'en',
          timezone: 'UTC'
        },
        securityPreferences: userData.securityPreferences ?? {
          twoFactorEnabled: false,
          loginNotifications: true,
          activityAlerts: true
        },
        isActive: true
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

      // Invalidate user list and user-specific caches
      await redisClient.del('users:*');
      await redisClient.del(`user:${user._id}`);
      await redisClient.del(cacheKey);
      return user;
    } catch (error) {
      logger.error('Error creating user:', { error: (error as Error).message });
      throw error;
    }
  }

  async getUsers(filters: UserFilter = {}, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc'): Promise<UserPaginationResult> {
    try {
      const cacheKey = `users:${JSON.stringify({ filters, page, limit, sortBy, sortOrder })}`;
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const query: Record<string, any> = { ...filters };
      
      // Build search query if search param is provided
      if (query.search) {
        const regex = new RegExp(query.search, 'i');
        query.$or = [
          { username: regex },
          { email: regex },
          { firstName: regex },
          { lastName: regex }
        ];
        delete query.search;
      }

      // Count total documents
      const totalUsers = await trackDatabaseOperation<number>('countUsers', () => 
        User.countDocuments(query).exec()
      );
      
      // Calculate skip for pagination
      const skip = (page - 1) * limit;
      const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
      const users = await trackDatabaseOperation<UserDocument[]>('findUsers', () =>
        User.find(query).sort(sort).skip(skip).limit(limit).exec()
      );

      const result = { users, totalUsers, totalPages: Math.ceil(totalUsers / limit), currentPage: page, usersPerPage: limit };
      await redisClient.set(cacheKey, JSON.stringify(result), 300);
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
      const cacheKey = `user:check:${updateData.email}:${updateData.username}`;
      if (updateData.username || updateData.email) {
        const cachedCheck = await redisClient.get(cacheKey);
        if (cachedCheck) {
          const check = JSON.parse(cachedCheck);
          if (updateData.email === check.email) throw new Error('Email already in use');
          if (updateData.username === check.username) throw new Error('Username already taken');
        }

        const query: any = { _id: { $ne: userId }, $or: [] };
        if (updateData.username) query.$or.push({ username: updateData.username });
        if (updateData.email) query.$or.push({ email: updateData.email });
        if (query.$or.length) {
          const existing = await User.findOne(query);
          if (existing) {
            await redisClient.set(cacheKey, JSON.stringify({
              email: existing.email,
              username: existing.username
            }), 300);
            if (updateData.email === existing.email) throw new Error('Email already in use');
            if (updateData.username === existing.username) throw new Error('Username already taken');
          }
        }
      }

      const user = await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
      if (!user) throw new Error('User not found');

      // Invalidate caches
      await redisClient.del(`user:${userId}`);
      await redisClient.del('users:*');
      await redisClient.del(cacheKey);
      return user;
    } catch (error) {
      logger.error('Error updating user:', { error: (error as Error).message, userId });
      throw error;
    }
  }

  async deleteUser(userId: string): Promise<UserDocument> {
    try {
      const user = await User.findByIdAndDelete(userId);
      if (!user) throw new Error('User not found');

      // Invalidate caches
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

      // Invalidate caches
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
        avatar: profileData.avatar,
        preferences: profileData.preferences
      };
      Object.keys(allowed).forEach(k => allowed[k] === undefined && delete allowed[k]);
      const updatedUser = await User.findByIdAndUpdate(userId, { $set: allowed }, { new: true });
      if (!updatedUser) throw new Error('User not found');
      await this.logUserActivity(userId, ActivityType.PROFILE_UPDATE, 'Profile updated');

      // Invalidate caches
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

      const isMatch = await bcrypt.compare(currentPassword, (user as any).password);
      if (!isMatch) throw new Error('Current password is incorrect');

      (user as any).password = newPassword;
      await user.save();

      await this.logUserActivity(userId, ActivityType.PASSWORD_CHANGE, 'Password changed');
      
      // Invalidate user cache
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

      // Invalidate caches
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

      // Invalidate activity cache
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

      // Invalidate caches
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