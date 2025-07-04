import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import userService from '../services/user.service';
import { UserDocument, SecurityPreferences, ExtendedUser, UserFilter, UserPaginationResult, JwtPayload } from '../interfaces/shared-types';
import { User, UserRole, Permission, ApiResponse, PaginatedResponse } from '@corp-astro/shared-types';

const serviceLogger = logger;

class UserController {
  // async createUser(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
  //   try {
  //     const userData = req.body;
      
  //     if (!userData.email || !userData.firstName || !userData.lastName) {
  //       return res.status(400).json({
  //         success: false,
  //         message: 'Required fields missing'
  //       });
  //     }
      
  //     const user = await userService.createUser(userData);
      
  //     return res.status(201).json({
  //       success: true,
  //       message: 'User created successfully',
  //       data: user
  //     });
  //   } catch (error) {
  //     if ((error as Error).message.includes('already') || (error as any).code === 11000) {
  //       return res.status(409).json({
  //         success: false,
  //         message: (error as Error).message
  //       });
  //     }
      
  //     return next(error);
  //   }
  // }
  
  async getUsers(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        role,
        isActive
      } = req.query;
      
      const filters: UserFilter = {};
      if (search) filters.search = search as string;
      if (role) filters.role = role as string;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      
      const result = await userService.getUsers(
        filters,
        parseInt(page as string),
        parseInt(limit as string),
        sortBy as string,
        sortOrder as string
      );
      
      return res.status(200).json({
        success: true,
        message: 'Users retrieved successfully',
        data: result
      });
    } catch (error) {
      return next(error);
    }
  }
  
  async getUserById(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userId } = req.params;
      
      const user = await userService.getUserById(userId);
      
      return res.status(200).json({
        success: true,
        message: 'User retrieved successfully',
        data: user
      });
    } catch (error) {
      if ((error as Error).message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: (error as Error).message
        });
      }
      
      return next(error);
    }
  }
  
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userId } = req.params;
      const userData = req.body;
      
      delete userData.password;
      
      const user = await userService.updateUser(userId.toString(), userData);

      console.log("updated user data"+user)
      
      return res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: user
      });
    } catch (error) {
      if ((error as Error).message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: (error as Error).message
        });
      }
      
      return next(error);
    }
  }
  
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userId } = req.params;
      
      await userService.deleteUser(userId);
      
      return res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      if ((error as Error).message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: (error as Error).message
        });
      }
      
      return next(error);
    }
  }
  
  async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userId } = req.params;
      const { isActive } = req.body;
      
      if (isActive === undefined) {
        return res.status(400).json({
          success: false,
          message: 'isActive status is required'
        });
      }
      
      const user = await userService.updateUserStatus(userId, isActive);
      
      return res.status(200).json({
        success: true,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: user
      });
    } catch (error) {
      if ((error as Error).message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: (error as Error).message
        });
      }
      
      return next(error);
    }
  }
  
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      // @ts-ignore
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      const profileData = req.body;
      
      delete profileData.password;
      delete profileData.email;
      delete profileData.role;
      delete profileData.permissions;
      
      const user = await userService.updateProfile(userId.toString(), profileData);
      
      return res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: user
      });
    } catch (error) {
      serviceLogger.error('Profile update error:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password and new password are required'
        });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters'
        });
      }
      
      // @ts-ignore
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      await userService.changePassword(userId.toString(), currentPassword, newPassword);
      
      return res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      if ((error as Error).message === 'Current password is incorrect') {
        return res.status(400).json({
          success: false,
          message: (error as Error).message
        });
      }
      
      serviceLogger.error('Password change error:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  async updateSecurityPreferences(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      // @ts-ignore
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      const securityPreferences: SecurityPreferences = req.body;
      
      if (typeof securityPreferences.twoFactorEnabled !== 'boolean' ||
          typeof securityPreferences.loginNotifications !== 'boolean' ||
          typeof securityPreferences.activityAlerts !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Invalid security preferences'
        });
      }
      
      const user = await userService.updateSecurityPreferences(userId.toString(), securityPreferences);
      
      return res.status(200).json({
        success: true,
        message: 'Security preferences updated successfully',
        data: user
      });
    } catch (error) {
      serviceLogger.error('Security preferences update error:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  async getUserDevices(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      // @ts-ignore
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      const devices = await userService.getUserDevices(userId.toString());
      
      return res.status(200).json({
        success: true,
        message: 'User devices retrieved successfully',
        data: devices
      });
    } catch (error) {
      serviceLogger.error('Get user devices error:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  async removeUserDevice(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      // @ts-ignore
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
      
      await userService.removeUserDevice(userId.toString(), deviceId);
      
      return res.status(200).json({
        success: true,
        message: 'Device removed successfully'
      });
    } catch (error) {
      if ((error as Error).message === 'Device not found') {
        return res.status(404).json({
          success: false,
          message: (error as Error).message
        });
      }
      
      serviceLogger.error('Remove user device error:', { error: (error as Error).message });
      return next(error);
    }
  }
  
  async getUserActivity(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, type } = req.query;
      
      // @ts-ignore
      const isOwnActivity = req.user?._id.toString() === userId;
      // @ts-ignore
      const isAdmin = req.user?.role === UserRole.ADMIN;
      
      if (!isOwnActivity && !isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to access this resource'
        });
      }
      
      const filters: Record<string, any> = {};
      if (type) filters.type = type;
      
      const activities = await userService.getUserActivity(
        userId,
        parseInt(page as string),
        parseInt(limit as string),
        filters
      );
      
      return res.status(200).json({
        success: true,
        message: 'User activity retrieved successfully',
        data: activities
      });
    } catch (error) {
      if ((error as Error).message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: (error as Error).message
        });
      }
      
      serviceLogger.error('Get user activity error:', { error: (error as Error).message });
      return next(error);
    }
  }

  // async updateUserPermissions(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
  //   try {
  //     const { userId } = req.params;
  //     const { permissions } = req.body;

  //     if (!Array.isArray(permissions)) {
  //       return res.status(400).json({
  //         success: false,
  //         message: 'Permissions must be an array'
  //       });
  //     }

  //     // @ts-ignore
  //     const requesterId = req.user?._id;
  //     // @ts-ignore
  //     const requesterRole = req.user?.role;
  //     // @ts-ignore
  //     const requesterPermissions = req.user?.permissions || [];

  //     if (requesterId !== userId && requesterRole !== UserRole.ADMIN && !requesterPermissions.includes('system.manage_roles')) {
  //       return res.status(403).json({
  //         success: false,
  //         message: 'Not authorized to update permissions'
  //       });
  //     }

  //     const user = await userService.updateUserPermissions(userId, permissions);

  //     return res.status(200).json({
  //       success: true,
  //       message: 'Permissions updated successfully',
  //       data: user.permissions
  //     });
  //   } catch (error) {
  //     if ((error as Error).message === 'User not found') {
  //       return res.status(404).json({
  //         success: false,
  //         message: 'User not found'
  //       });
  //     }
  //     if ((error as Error).message.includes('Invalid permissions')) {
  //       return res.status(400).json({
  //         success: false,
  //         message: (error as Error).message
  //       });
  //     }

  //     serviceLogger.error('Permissions update error:', { error: (error as Error).message });
  //     return next(error);
  //   }
  // }

  /**
   * Get all available permissions
   * @param req - Express request object
   * @param res - Express response object
   * @param next - Express next middleware function
   */
  // async getAllPermissions(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
  //   try {
  //     // @ts-ignore
  //     const requesterRole = req.user?.role;
  //     // @ts-ignore
  //     const requesterPermissions = req.user?.permissions || [];

  //     if (requesterRole !== UserRole.ADMIN && !requesterPermissions.includes('system.manage_roles')) {
  //       return res.status(403).json({
  //         success: false,
  //         message: 'Not authorized to access permissions'
  //       });
  //     }

  //     const permissions = await userService.getAllPermissions();

  //     return res.status(200).json({
  //       success: true,
  //       message: 'Permissions retrieved successfully',
  //       data: permissions
  //     });
  //   } catch (error) {
  //     serviceLogger.error('Get permissions error:', { error: (error as Error).message });
  //     return next(error);
  //   }
  // }
}

const userController = new UserController();

export const {
  // createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateUserStatus,
  updateProfile,
  changePassword,
  updateSecurityPreferences,
  getUserDevices,
  removeUserDevice,
  getUserActivity,
  // updateUserPermissions,
  // getAllPermissions
} = userController;