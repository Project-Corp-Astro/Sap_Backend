"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
// Import logger from local utils instead of shared to avoid path issues
const logger_1 = __importDefault(require("../utils/logger"));
const User_1 = __importDefault(require("../models/User"));
const UserActivity_1 = __importStar(require("../models/UserActivity"));
const UserDevice_1 = __importDefault(require("../models/UserDevice"));
const performance_1 = require("../utils/performance");
// Initialize logger
const logger = logger_1.default;
/**
 * User management service
 */
class UserService {
    /**
     * Create a new user
     * @param userData - User data
     * @returns Newly created user
     */
    async createUser(userData) {
        try {
            // Check if user already exists
            const existingUser = await (0, performance_1.trackDatabaseOperation)('findUser', () => User_1.default.findOne({
                $or: [
                    { email: userData.email },
                    { username: userData.username }
                ]
            }).exec());
            if (existingUser) {
                if (existingUser.email === userData.email) {
                    throw new Error('Email already in use');
                }
                else {
                    throw new Error('Username already taken');
                }
            }
            // Create new user
            const user = new User_1.default(userData);
            await (0, performance_1.trackDatabaseOperation)('saveUser', () => user.save());
            return user;
        }
        catch (error) {
            logger.error('Error creating user:', { error: error.message });
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
    async getUsers(filters = {}, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc') {
        try {
            const query = { ...filters };
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
            const totalUsers = await (0, performance_1.trackDatabaseOperation)('countUsers', () => User_1.default.countDocuments(query).exec());
            // Calculate skip for pagination
            const skip = (page - 1) * limit;
            // Sort direction
            const sort = {};
            sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
            // Get paginated users
            const users = await (0, performance_1.trackDatabaseOperation)('findUsers', () => User_1.default.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .exec());
            return {
                users,
                totalUsers,
                totalPages: Math.ceil(totalUsers / limit),
                currentPage: page,
                usersPerPage: limit
            };
        }
        catch (error) {
            logger.error('Error getting users:', { error: error.message });
            throw error;
        }
    }
    /**
     * Get user by ID
     * @param userId - User ID
     * @returns User document
     */
    async getUserById(userId) {
        try {
            const user = await (0, performance_1.trackDatabaseOperation)('findUserById', () => User_1.default.findById(userId).exec());
            if (!user) {
                throw new Error('User not found');
            }
            return user;
        }
        catch (error) {
            logger.error('Error getting user by ID:', { error: error.message, userId });
            throw error;
        }
    }
    /**
     * Update user
     * @param userId - User ID
     * @param updateData - Fields to update
     * @returns Updated user
     */
    async updateUser(userId, updateData) {
        try {
            // Check if username or email already taken
            if (updateData.username || updateData.email) {
                const query = {
                    _id: { $ne: userId },
                    $or: []
                };
                if (updateData.username)
                    query.$or.push({ username: updateData.username });
                if (updateData.email)
                    query.$or.push({ email: updateData.email });
                if (query.$or.length > 0) {
                    const existingUser = await User_1.default.findOne(query);
                    if (existingUser) {
                        if (updateData.email && existingUser.email === updateData.email) {
                            throw new Error('Email already in use');
                        }
                        else if (updateData.username && existingUser.username === updateData.username) {
                            throw new Error('Username already taken');
                        }
                    }
                }
            }
            // Update user
            const user = await User_1.default.findByIdAndUpdate(userId, { $set: updateData }, { new: true });
            if (!user) {
                throw new Error('User not found');
            }
            return user;
        }
        catch (error) {
            logger.error('Error updating user:', { error: error.message, userId });
            throw error;
        }
    }
    /**
     * Delete user
     * @param userId - User ID
     * @returns Deleted user
     */
    async deleteUser(userId) {
        try {
            const user = await User_1.default.findByIdAndDelete(userId);
            if (!user) {
                throw new Error('User not found');
            }
            return user;
        }
        catch (error) {
            logger.error('Error deleting user:', { error: error.message, userId });
            throw error;
        }
    }
    /**
     * Update user active status
     * @param userId - User ID
     * @param isActive - Active status
     * @returns Updated user
     */
    async updateUserStatus(userId, isActive) {
        try {
            const user = await User_1.default.findByIdAndUpdate(userId, { $set: { isActive } }, { new: true });
            if (!user) {
                throw new Error('User not found');
            }
            return user;
        }
        catch (error) {
            logger.error('Error updating user status:', { error: error.message, userId });
            throw error;
        }
    }
    /**
     * Update user profile
     * @param userId - User ID
     * @param profileData - Profile data to update
     * @returns Updated user
     */
    async updateProfile(userId, profileData) {
        try {
            // Validate user exists
            await this.getUserById(userId);
            // Update only allowed profile fields
            const allowedFields = {
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
            const updatedUser = await User_1.default.findByIdAndUpdate(userId, { $set: allowedFields }, { new: true });
            if (!updatedUser) {
                throw new Error('User not found');
            }
            // Log activity
            await this.logUserActivity(userId, UserActivity_1.ActivityType.PROFILE_UPDATE, 'Profile updated');
            return updatedUser;
        }
        catch (error) {
            logger.error('Error updating user profile:', { error: error.message, userId });
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
    async changePassword(userId, currentPassword, newPassword) {
        try {
            // Get user with password
            const user = await User_1.default.findById(userId).select('+password');
            if (!user) {
                throw new Error('User not found');
            }
            // Verify current password
            const isMatch = await bcrypt_1.default.compare(currentPassword, user.password);
            if (!isMatch) {
                throw new Error('Current password is incorrect');
            }
            // Update password
            user.password = newPassword; // Password will be hashed by pre-save hook
            await user.save();
            // Log activity
            await this.logUserActivity(userId, UserActivity_1.ActivityType.PASSWORD_CHANGE, 'Password changed');
            return true;
        }
        catch (error) {
            logger.error('Error changing password:', { error: error.message, userId });
            throw error;
        }
    }
    /**
     * Update user security preferences
     * @param userId - User ID
     * @param securityPreferences - Security preferences
     * @returns Updated user
     */
    async updateSecurityPreferences(userId, securityPreferences) {
        try {
            // Validate user exists
            await this.getUserById(userId);
            // Update security preferences
            const updatedUser = await User_1.default.findByIdAndUpdate(userId, { $set: { securityPreferences } }, { new: true });
            if (!updatedUser) {
                throw new Error('User not found');
            }
            // Log activity
            await this.logUserActivity(userId, UserActivity_1.ActivityType.SECURITY_UPDATE, 'Security preferences updated');
            return updatedUser;
        }
        catch (error) {
            logger.error('Error updating security preferences:', { error: error.message, userId });
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
    async logUserActivity(userId, type, description, metadata = {}) {
        try {
            const activity = new UserActivity_1.default({
                user: userId,
                type,
                description,
                metadata,
                ipAddress: metadata.ipAddress || '',
                userAgent: metadata.userAgent || ''
            });
            await activity.save();
            return activity;
        }
        catch (error) {
            logger.error('Error logging user activity:', { error: error.message, userId });
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
    async getUserActivity(userId, page = 1, limit = 20, filters = {}) {
        try {
            // Validate user exists
            await this.getUserById(userId);
            // Build query
            const query = { user: userId, ...filters };
            // Count total documents
            const totalActivities = await UserActivity_1.default.countDocuments(query);
            // Calculate skip for pagination
            const skip = (page - 1) * limit;
            // Get paginated activity logs
            const activities = await UserActivity_1.default.find(query)
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
        }
        catch (error) {
            logger.error('Error getting user activity:', { error: error.message, userId });
            throw error;
        }
    }
    /**
     * Get user devices
     * @param userId - User ID
     * @returns User devices
     */
    async getUserDevices(userId) {
        try {
            // Validate user exists
            await this.getUserById(userId);
            // Get user devices
            const devices = await UserDevice_1.default.find({ user: userId })
                .sort({ lastUsed: -1 });
            return devices;
        }
        catch (error) {
            logger.error('Error getting user devices:', { error: error.message, userId });
            throw error;
        }
    }
    /**
     * Remove user device
     * @param userId - User ID
     * @param deviceId - Device ID
     * @returns Success status
     */
    async removeUserDevice(userId, deviceId) {
        try {
            // Validate user exists
            await this.getUserById(userId);
            // Find and remove device
            const device = await UserDevice_1.default.findOneAndDelete({
                _id: deviceId,
                user: userId
            });
            if (!device) {
                throw new Error('Device not found');
            }
            // Log activity
            await this.logUserActivity(userId, UserActivity_1.ActivityType.DEVICE_REMOVED, 'Device removed', {
                deviceId: deviceId,
                deviceName: device.deviceName
            });
            return true;
        }
        catch (error) {
            logger.error('Error removing user device:', { error: error.message, userId, deviceId });
            throw error;
        }
    }
}
// Create and export service instance
const userService = new UserService();
exports.default = userService;
