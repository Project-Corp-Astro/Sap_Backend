import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import * as userController from '../../controllers/user.controller';
import userService from '../../services/user.service';
import { UserRole, ThemePreference } from '../../interfaces/user.interfaces';

// Mock the user service
jest.mock('../../services/user.service');

describe('User Controller Tests', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup request and response objects
    req = {
      body: {},
      params: {},
      query: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });
  
  describe('createUser', () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.USER,
      preferences: {
        theme: ThemePreference.SYSTEM,
        notifications: {
          email: true,
          push: true
        }
      }
    };
    
    it('should create a user successfully', async () => {
      // Setup
      req.body = userData;
      
      const createdUser = {
        _id: new mongoose.Types.ObjectId().toString(),
        ...userData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      (userService.createUser as jest.Mock).mockResolvedValue(createdUser);
      
      // Execute
      await userController.createUser(req as Request, res as Response, next);
      
      // Assert
      expect(userService.createUser).toHaveBeenCalledWith(userData);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User created successfully',
        data: createdUser
      });
    });
    
    it('should return 400 if required fields are missing', async () => {
      // Setup
      req.body = {
        username: 'testuser',
        // Missing required fields
      };
      
      // Execute
      await userController.createUser(req as Request, res as Response, next);
      
      // Assert
      expect(userService.createUser).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Required fields missing'
      });
    });
    
    it('should return 409 if user already exists', async () => {
      // Setup
      req.body = userData;
      
      const duplicateError = new Error('User with this email already exists');
      (duplicateError as any).code = 11000;
      (userService.createUser as jest.Mock).mockRejectedValue(duplicateError);
      
      // Execute
      await userController.createUser(req as Request, res as Response, next);
      
      // Assert
      expect(userService.createUser).toHaveBeenCalledWith(userData);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User with this email already exists'
      });
    });
    
    it('should call next with error for unexpected errors', async () => {
      // Setup
      req.body = userData;
      
      const unexpectedError = new Error('Unexpected error');
      (userService.createUser as jest.Mock).mockRejectedValue(unexpectedError);
      
      // Execute
      await userController.createUser(req as Request, res as Response, next);
      
      // Assert
      expect(userService.createUser).toHaveBeenCalledWith(userData);
      expect(next).toHaveBeenCalledWith(unexpectedError);
    });
  });
  
  describe('getUsers', () => {
    it('should get users with default pagination', async () => {
      // Setup
      req.query = {};
      
      const usersResult = {
        users: [{ _id: '1', username: 'user1' }, { _id: '2', username: 'user2' }],
        totalUsers: 2,
        totalPages: 1,
        currentPage: 1,
        usersPerPage: 10
      };
      
      (userService.getUsers as jest.Mock).mockResolvedValue(usersResult);
      
      // Execute
      await userController.getUsers(req as Request, res as Response, next);
      
      // Assert
      expect(userService.getUsers).toHaveBeenCalledWith(
        {},
        1,
        10,
        'createdAt',
        'desc'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Users retrieved successfully',
        data: usersResult
      });
    });
    
    it('should get users with custom pagination and filters', async () => {
      // Setup
      req.query = {
        page: '2',
        limit: '5',
        sortBy: 'username',
        sortOrder: 'asc',
        search: 'test',
        role: 'admin',
        isActive: 'true'
      };
      
      const usersResult = {
        users: [{ _id: '3', username: 'test3' }],
        totalUsers: 6,
        totalPages: 2,
        currentPage: 2,
        usersPerPage: 5
      };
      
      (userService.getUsers as jest.Mock).mockResolvedValue(usersResult);
      
      // Execute
      await userController.getUsers(req as Request, res as Response, next);
      
      // Assert
      expect(userService.getUsers).toHaveBeenCalledWith(
        { search: 'test', role: 'admin', isActive: true },
        2,
        5,
        'username',
        'asc'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Users retrieved successfully',
        data: usersResult
      });
    });
  });
  
  describe('getUserById', () => {
    it('should get user by ID successfully', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      req.params = { userId };
      
      const user = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com'
      };
      
      (userService.getUserById as jest.Mock).mockResolvedValue(user);
      
      // Execute
      await userController.getUserById(req as Request, res as Response, next);
      
      // Assert
      expect(userService.getUserById).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User retrieved successfully',
        data: user
      });
    });
    
    it('should return 404 if user not found', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      req.params = { userId };
      
      const notFoundError = new Error('User not found');
      (userService.getUserById as jest.Mock).mockRejectedValue(notFoundError);
      
      // Execute
      await userController.getUserById(req as Request, res as Response, next);
      
      // Assert
      expect(userService.getUserById).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
  });
  
  describe('updateUser', () => {
    it('should update user successfully', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      req.params = { userId };
      req.body = {
        firstName: 'Updated',
        lastName: 'User',
        preferences: {
          theme: ThemePreference.DARK
        }
      };
      
      const updatedUser = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Updated',
        lastName: 'User',
        preferences: {
          theme: ThemePreference.DARK
        },
        updatedAt: new Date()
      };
      
      (userService.updateUser as jest.Mock).mockResolvedValue(updatedUser);
      
      // Execute
      await userController.updateUser(req as Request, res as Response, next);
      
      // Assert
      expect(userService.updateUser).toHaveBeenCalledWith(userId, {
        firstName: 'Updated',
        lastName: 'User',
        preferences: {
          theme: ThemePreference.DARK
        }
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
      });
    });
    
    it('should handle user not found error', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      req.params = { userId };
      req.body = { firstName: 'Updated' };
      
      const notFoundError = new Error('User not found');
      (userService.updateUser as jest.Mock).mockRejectedValue(notFoundError);
      
      // Execute
      await userController.updateUser(req as Request, res as Response, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(notFoundError);
    });
  });
  
  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      req.params = { userId };
      
      (userService.deleteUser as jest.Mock).mockResolvedValue({ acknowledged: true, deletedCount: 1 });
      
      // Execute
      await userController.deleteUser(req as Request, res as Response, next);
      
      // Assert
      expect(userService.deleteUser).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User deleted successfully'
      });
    });
    
    it('should return 404 if user not found for deletion', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      req.params = { userId };
      
      const notFoundError = new Error('User not found');
      (userService.deleteUser as jest.Mock).mockRejectedValue(notFoundError);
      
      // Execute
      await userController.deleteUser(req as Request, res as Response, next);
      
      // Assert
      expect(userService.deleteUser).toHaveBeenCalledWith(userId);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
  });
  
  describe('updateUserStatus', () => {
    it('should update user status to inactive', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      req.params = { userId };
      req.body = { isActive: false };
      
      const updatedUser = {
        _id: userId,
        username: 'testuser',
        isActive: false,
        updatedAt: new Date()
      };
      
      (userService.updateUserStatus as jest.Mock).mockResolvedValue(updatedUser);
      
      // Execute
      await userController.updateUserStatus(req as Request, res as Response, next);
      
      // Assert
      expect(userService.updateUserStatus).toHaveBeenCalledWith(userId, false);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User status updated successfully',
        data: updatedUser
      });
    });
    
    it('should return 400 if isActive is missing', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      req.params = { userId };
      req.body = {}; // Missing isActive
      
      // Execute
      await userController.updateUserStatus(req as Request, res as Response, next);
      
      // Assert
      expect(userService.updateUserStatus).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'isActive field is required'
      });
    });
  });
});
