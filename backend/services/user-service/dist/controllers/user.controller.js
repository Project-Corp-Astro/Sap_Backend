"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserActivity = exports.removeUserDevice = exports.getUserDevices = exports.updateSecurityPreferences = exports.changePassword = exports.updateProfile = exports.updateUserStatus = exports.deleteUser = exports.updateUser = exports.getUserById = exports.getUsers = exports.createUser = void 0;
const express_validator_1 = require("express-validator");
// Import logger directly to avoid path issues in tests
const logger_1 = __importDefault(require("../utils/logger"));
const user_service_1 = __importDefault(require("../services/user.service"));
// Use logger directly
const serviceLogger = logger_1.default;
/**
 * User management controller
 */
class UserController {
    /**
     * Create a new user
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async createUser(req, res, next) {
        try {
            const userData = req.body;
            // Validate required fields
            if (!userData.username || !userData.email || !userData.firstName || !userData.lastName) {
                return res.status(400).json({
                    success: false,
                    message: 'Required fields missing'
                });
            }
            const user = await user_service_1.default.createUser(userData);
            return res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: user
            });
        }
        catch (error) {
            if (error.message.includes('already') || error.code === 11000) {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }
            return next(error);
        }
    }
    /**
     * Get all users with pagination and filtering
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async getUsers(req, res, next) {
        try {
            const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search, role, isActive } = req.query;
            // Build filters
            const filters = {};
            if (search)
                filters.search = search;
            if (role)
                filters.role = role;
            if (isActive !== undefined)
                filters.isActive = isActive === 'true';
            const result = await user_service_1.default.getUsers(filters, parseInt(page), parseInt(limit), sortBy, sortOrder);
            return res.status(200).json({
                success: true,
                message: 'Users retrieved successfully',
                data: result
            });
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * Get user by ID
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async getUserById(req, res, next) {
        try {
            const { userId } = req.params;
            const user = await user_service_1.default.getUserById(userId);
            return res.status(200).json({
                success: true,
                message: 'User retrieved successfully',
                data: user
            });
        }
        catch (error) {
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            return next(error);
        }
    }
    /**
     * Update user
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async updateUser(req, res, next) {
        try {
            const { userId } = req.params;
            const updateData = req.body;
            // Prevent updating critical fields through this endpoint
            delete updateData.password;
            const user = await user_service_1.default.updateUser(userId, updateData);
            return res.status(200).json({
                success: true,
                message: 'User updated successfully',
                data: user
            });
        }
        catch (error) {
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            if (error.message.includes('already')) {
                return res.status(409).json({
                    success: false,
                    message: error.message
                });
            }
            return next(error);
        }
    }
    /**
     * Delete user
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async deleteUser(req, res, next) {
        try {
            const { userId } = req.params;
            await user_service_1.default.deleteUser(userId);
            return res.status(200).json({
                success: true,
                message: 'User deleted successfully'
            });
        }
        catch (error) {
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            return next(error);
        }
    }
    /**
     * Update user active status
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async updateUserStatus(req, res, next) {
        try {
            const { userId } = req.params;
            const { isActive } = req.body;
            if (isActive === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'isActive field is required'
                });
            }
            const user = await user_service_1.default.updateUserStatus(userId, isActive);
            return res.status(200).json({
                success: true,
                message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
                data: user
            });
        }
        catch (error) {
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            return next(error);
        }
    }
    /**
     * Update user profile
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async updateProfile(req, res, next) {
        try {
            // Validate request
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }
            // Get user ID from authenticated user
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }
            const profileData = req.body;
            // Prevent updating critical fields through this endpoint
            delete profileData.password;
            delete profileData.email; // Email change should be a separate process with verification
            delete profileData.role;
            delete profileData.permissions;
            const user = await user_service_1.default.updateProfile(userId, profileData);
            return res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: user
            });
        }
        catch (error) {
            serviceLogger.error('Profile update error:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Change user password
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async changePassword(req, res, next) {
        try {
            // Validate request
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }
            const { currentPassword, newPassword } = req.body;
            await user_service_1.default.changePassword(userId, currentPassword, newPassword);
            return res.status(200).json({
                success: true,
                message: 'Password changed successfully'
            });
        }
        catch (error) {
            if (error.message === 'Current password is incorrect') {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            serviceLogger.error('Password change error:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Update user security preferences
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async updateSecurityPreferences(req, res, next) {
        try {
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }
            const { securityPreferences } = req.body;
            if (!securityPreferences) {
                return res.status(400).json({
                    success: false,
                    message: 'Security preferences are required'
                });
            }
            const user = await user_service_1.default.updateSecurityPreferences(userId, securityPreferences);
            return res.status(200).json({
                success: true,
                message: 'Security preferences updated successfully',
                data: {
                    securityPreferences: user.securityPreferences
                }
            });
        }
        catch (error) {
            serviceLogger.error('Security preferences update error:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Get user devices
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async getUserDevices(req, res, next) {
        try {
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }
            const devices = await user_service_1.default.getUserDevices(userId);
            return res.status(200).json({
                success: true,
                message: 'User devices retrieved successfully',
                data: devices
            });
        }
        catch (error) {
            serviceLogger.error('Get user devices error:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Remove user device
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async removeUserDevice(req, res, next) {
        try {
            const userId = req.user?._id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }
            const { deviceId } = req.params;
            if (!deviceId) {
                return res.status(400).json({
                    success: false,
                    message: 'Device ID is required'
                });
            }
            await user_service_1.default.removeUserDevice(userId, deviceId);
            return res.status(200).json({
                success: true,
                message: 'Device removed successfully'
            });
        }
        catch (error) {
            if (error.message === 'Device not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            serviceLogger.error('Remove user device error:', { error: error.message });
            return next(error);
        }
    }
    /**
     * Get user activity log
     * @param req - Express request object
     * @param res - Express response object
     * @param next - Express next middleware function
     */
    async getUserActivity(req, res, next) {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 20, type } = req.query;
            // Check if user has permission to view activity
            const isOwnActivity = req.user?._id.toString() === userId;
            const isAdmin = req.user?.role === 'admin';
            if (!isOwnActivity && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to access this resource'
                });
            }
            const filters = {};
            if (type)
                filters.type = type;
            const activities = await user_service_1.default.getUserActivity(userId, parseInt(page), parseInt(limit), filters);
            return res.status(200).json({
                success: true,
                message: 'User activity retrieved successfully',
                data: activities
            });
        }
        catch (error) {
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            serviceLogger.error('Get user activity error:', { error: error.message });
            return next(error);
        }
    }
}
// Create controller instance
const userController = new UserController();
// Export controller methods
exports.createUser = userController.createUser, exports.getUsers = userController.getUsers, exports.getUserById = userController.getUserById, exports.updateUser = userController.updateUser, exports.deleteUser = userController.deleteUser, exports.updateUserStatus = userController.updateUserStatus, exports.updateProfile = userController.updateProfile, exports.changePassword = userController.changePassword, exports.updateSecurityPreferences = userController.updateSecurityPreferences, exports.getUserDevices = userController.getUserDevices, exports.removeUserDevice = userController.removeUserDevice, exports.getUserActivity = userController.getUserActivity;
