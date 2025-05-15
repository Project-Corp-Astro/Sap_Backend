import bcrypt from 'bcrypt';
// Import logger from local utils instead of shared to avoid path issues
import userServiceLogger from '../utils/logger';
import User from '../models/User';
import UserActivity, { ActivityType } from '../models/UserActivity';
import UserDevice from '../models/UserDevice';
import { trackDatabaseOperation } from '../utils/performance';
// Import from our shared-types file that extends the shared package
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
      // Check if user already exists
      const existingUser = await trackDatabaseOperation<UserDocument | null>('findUser', () => 
        User.findOne({ 
          $or: [
            { email: userData.email }, 
            { username: userData.username }
          ]
        }).exec()
      );
      
      if (existingUser) {
        if (existingUser.email === userData.email) {
          throw new Error('Email already in use');
        } else {
          throw new Error('Username already taken');
        }
      }
      
      // Create new user
      const user = new User(userData);
      await trackDatabaseOperation('saveUser', () => user.save());
      
      return user;
    } catch (error) {
      logger.error('Error creating user:', { error: (error as Error).message });
      throw error;
    }
  }
  
  /**
   * Get all users with pagination and filtering
   * @param filters - Query filters
   * @param page - Page number
   * @param limit - Items per page
   * @param sortBy - Sort field
   * @param sortOrder - Sort order (asc/desc)
   * @returns Paginated users list
   */
  async getUsers(
    filters: UserFilter = {}, 
    page: number = 1, 
    limit: number = 10, 
    sortBy: string = 'createdAt', 
    sortOrder: string = 'desc'
  ): Promise<UserPaginationResult> {
    try {
      const query: Record<string, any> = { ...filters };
      
      // Build search query if search param is provided
      if (query.search) {
        const searchRegex = new RegExp(query.search, 'i');
        query.$or = [
          { username: searchRegex },
          { email: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex }
        ];
        delete query.search;
      }
      
      // Count total documents
      const totalUsers = await trackDatabaseOperation<number>('countUsers', () => 
        User.countDocuments(query).exec()
      );
      
      // Calculate skip for pagination
      const skip = (page - 1) * limit;
      
      // Sort direction
      const sort: Record<string, 1 | -1> = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // Get paginated users
      const users = await trackDatabaseOperation<UserDocument[]>('findUsers', () => 
        User.find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec()
      );
      
      return {
        users,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
        currentPage: page,
        usersPerPage: limit
      };
    } catch (error) {
      logger.error('Error getting users:', { error: (error as Error).message });
      throw error;
    }
  }
  
  /**
   * Get user by ID
   * @param userId - User ID
   * @returns User document
   */
  async getUserById(userId: string): Promise<UserDocument> {
    try {
      const user = await trackDatabaseOperation<UserDocument | null>('findUserById', () => 
        User.findById(userId).exec()
      );
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      logger.error('Error getting user by ID:', { error: (error as Error).message, userId });
      throw error;
    }
  }
  
  /**
   * Update user
   * @param userId - User ID
   * @param updateData - Fields to update
   * @returns Updated user
   */
  async updateUser(userId: string, updateData: Partial<UserDocument>): Promise<UserDocument> {
    try {
      // Check if username or email already taken
      if (updateData.username || updateData.email) {
        const query: Record<string, any> = {
          _id: { $ne: userId },
          $or: [] as Record<string, any>[]
        };
        
        if (updateData.username) query.$or.push({ username: updateData.username });
        if (updateData.email) query.$or.push({ email: updateData.email });
        
        if (query.$or.length > 0) {
          const existingUser = await User.findOne(query);
          
          if (existingUser) {
            if (updateData.email && existingUser.email === updateData.email) {
              throw new Error('Email already in use');
            } else if (updateData.username && existingUser.username === updateData.username) {
              throw new Error('Username already taken');
            }
          }
        }
      }
      
      // Update user
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      );
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      logger.error('Error updating user:', { error: (error as Error).message, userId });
      throw error;
    }
  }
  
  /**
   * Delete user
   * @param userId - User ID
   * @returns Deleted user
   */
  async deleteUser(userId: string): Promise<UserDocument> {
    try {
      const user = await User.findByIdAndDelete(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      logger.error('Error deleting user:', { error: (error as Error).message, userId });
      throw error;
    }
  }
  
  /**
   * Update user active status
   * @param userId - User ID
   * @param isActive - Active status
   * @returns Updated user
   */
  async updateUserStatus(userId: string, isActive: boolean): Promise<UserDocument> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: { isActive } },
        { new: true }
      );
      
      if (!user) {
        throw new Error('User not found');
      }
      
      return user;
    } catch (error) {
      logger.error('Error updating user status:', { error: (error as Error).message, userId });
      throw error;
    }
  }
  
  /**
   * Update user profile
   * @param userId - User ID
   * @param profileData - Profile data to update
   * @returns Updated user
   */
  async updateProfile(userId: string, profileData: Partial<UserDocument>): Promise<UserDocument> {
    try {
      // Validate user exists
      await this.getUserById(userId);
      
      // Update only allowed profile fields
      const allowedFields: Record<string, any> = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phoneNumber: profileData.phoneNumber,
        address: profileData.address,
        avatar: profileData.avatar,
        preferences: profileData.preferences
      };
      
      // Remove undefined fields
      Object.keys(allowedFields).forEach(key => {
        if (allowedFields[key] === undefined) {
          delete allowedFields[key];
        }
      });
      
      // Update user profile
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: allowedFields },
        { new: true }
      );
      
      if (!updatedUser) {
        throw new Error('User not found');
      }
      
      // Log activity
      await this.logUserActivity(userId, ActivityType.PROFILE_UPDATE, 'Profile updated');
      
      return updatedUser;
    } catch (error) {
      logger.error('Error updating user profile:', { error: (error as Error).message, userId });
      throw error;
    }
  }
  
  /**
   * Change user password
   * @param userId - User ID
   * @param currentPassword - Current password
   * @param newPassword - New password
   * @returns Success status
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Get user with password
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Verify current password
      const isMatch = await bcrypt.compare(currentPassword, (user as any).password);
      
      if (!isMatch) {
        throw new Error('Current password is incorrect');
      }
      
      // Update password
      (user as any).password = newPassword; // Password will be hashed by pre-save hook
      await user.save();
      
      // Log activity
      await this.logUserActivity(userId, ActivityType.PASSWORD_CHANGE, 'Password changed');
      
      return true;
    } catch (error) {
      logger.error('Error changing password:', { error: (error as Error).message, userId });
      throw error;
    }
  }
  
  /**
   * Update user security preferences
   * @param userId - User ID
   * @param securityPreferences - Security preferences
   * @returns Updated user
   */
  async updateSecurityPreferences(userId: string, securityPreferences: SecurityPreferences): Promise<UserDocument> {
    try {
      // Validate user exists
      await this.getUserById(userId);
      
      // Update security preferences
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { securityPreferences } },
        { new: true }
      );
      
      if (!updatedUser) {
        throw new Error('User not found');
      }
      
      // Log activity
      await this.logUserActivity(userId, ActivityType.SECURITY_UPDATE, 'Security preferences updated');
      
      return updatedUser;
    } catch (error) {
      logger.error('Error updating security preferences:', { error: (error as Error).message, userId });
      throw error;
    }
  }
  
  /**
   * Log user activity
   * @param userId - User ID
   * @param type - Activity type
   * @param description - Activity description
   * @param metadata - Additional metadata
   * @returns Created activity log
   */
  async logUserActivity(
    userId: string, 
    type: ActivityType, 
    description: string, 
    metadata: Record<string, any> = {}
  ): Promise<any> {
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
      return activity;
    } catch (error) {
      logger.error('Error logging user activity:', { error: (error as Error).message, userId });
      // Don't throw error to prevent disrupting the main operation
      return null;
    }
  }
  
  /**
   * Get user activity
   * @param userId - User ID
   * @param page - Page number
   * @param limit - Items per page
   * @param filters - Filters
   * @returns Paginated activity logs
   */
  async getUserActivity(
    userId: string, 
    page: number = 1, 
    limit: number = 20, 
    filters: ActivityFilter = {}
  ): Promise<ActivityPaginationResult> {
    try {
      // Validate user exists
      await this.getUserById(userId);
      
      // Build query
      const query = { user: userId, ...filters };
      
      // Count total documents
      const totalActivities = await UserActivity.countDocuments(query);
      
      // Calculate skip for pagination
      const skip = (page - 1) * limit;
      
      // Get paginated activity logs
      const activities = await UserActivity.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      
      return {
        activities,
        totalActivities,
        totalPages: Math.ceil(totalActivities / limit),
        currentPage: page,
        activitiesPerPage: limit
      };
    } catch (error) {
      logger.error('Error getting user activity:', { error: (error as Error).message, userId });
      throw error;
    }
  }
  
  /**
   * Get user devices
   * @param userId - User ID
   * @returns User devices
   */
  async getUserDevices(userId: string): Promise<any[]> {
    try {
      // Validate user exists
      await this.getUserById(userId);
      
      // Get user devices
      const devices = await UserDevice.find({ user: userId })
        .sort({ lastUsed: -1 });
      
      return devices;
    } catch (error) {
      logger.error('Error getting user devices:', { error: (error as Error).message, userId });
      throw error;
    }
  }
  
  /**
   * Remove user device
   * @param userId - User ID
   * @param deviceId - Device ID
   * @returns Success status
   */
  async removeUserDevice(userId: string, deviceId: string): Promise<boolean> {
    try {
      // Validate user exists
      await this.getUserById(userId);
      
      // Find and remove device
      const device = await UserDevice.findOneAndDelete({
        _id: deviceId,
        user: userId
      });
      
      if (!device) {
        throw new Error('Device not found');
      }
      
      // Log activity
      await this.logUserActivity(userId, ActivityType.DEVICE_REMOVED, 'Device removed', {
        deviceId: deviceId,
        deviceName: device.deviceName
      });
      
      return true;
    } catch (error) {
      logger.error('Error removing user device:', { error: (error as Error).message, userId, deviceId });
      throw error;
    }
  }
}

// Create and export service instance
const userService = new UserService();
export default userService;
