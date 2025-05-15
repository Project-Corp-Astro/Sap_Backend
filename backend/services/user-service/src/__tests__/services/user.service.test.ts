import mongoose from 'mongoose';
import userService from '../../services/user.service';
import User from '../../models/User';
import UserActivity from '../../models/UserActivity';
import { UserRole, ThemePreference } from '../../interfaces/user.interfaces';

// Mock the models
jest.mock('../../models/User');
jest.mock('../../models/UserActivity');
jest.mock('../../../shared/utils/logger', () => ({
  createServiceLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('User Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      const mockUser = {
        ...userData,
        _id: new mongoose.Types.ObjectId().toString(),
        save: jest.fn().mockResolvedValue(true)
      };
      
      (User.findOne as jest.Mock).mockResolvedValue(null);
      (User as unknown as jest.Mock).mockImplementation(() => mockUser);

      // Execute
      const result = await userService.createUser(userData);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({
        $or: [
          { email: userData.email },
          { username: userData.username }
        ]
      });
      expect(mockUser.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw error if email already exists', async () => {
      // Setup
      const existingUser = {
        ...userData,
        _id: new mongoose.Types.ObjectId().toString()
      };
      
      (User.findOne as jest.Mock).mockResolvedValue(existingUser);

      // Execute & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('Email already in use');
    });

    it('should throw error if username already exists', async () => {
      // Setup
      const existingUser = {
        ...userData,
        _id: new mongoose.Types.ObjectId().toString(),
        email: 'different@example.com'
      };
      
      (User.findOne as jest.Mock).mockResolvedValue(existingUser);

      // Execute & Assert
      await expect(userService.createUser(userData)).rejects.toThrow('Username already taken');
    });
  });

  describe('getUsers', () => {
    it('should get users with default pagination', async () => {
      // Setup
      const mockUsers = [
        { _id: '1', username: 'user1' },
        { _id: '2', username: 'user2' }
      ];
      
      const mockCountDocuments = jest.fn().mockResolvedValue(2);
      const mockFind = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue(mockUsers);
      
      (User.countDocuments as jest.Mock) = mockCountDocuments;
      (User.find as jest.Mock) = mockFind;
      
      Object.defineProperty(User.find, 'sort', { value: mockSort });
      Object.defineProperty(User.find, 'skip', { value: mockSkip });
      Object.defineProperty(User.find, 'limit', { value: mockLimit });

      // Execute
      const result = await userService.getUsers();

      // Assert
      expect(mockCountDocuments).toHaveBeenCalledWith({});
      expect(mockFind).toHaveBeenCalledWith({});
      expect(mockSort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        users: mockUsers,
        totalUsers: 2,
        totalPages: 1,
        currentPage: 1,
        usersPerPage: 10
      });
    });

    it('should get users with search filter', async () => {
      // Setup
      const mockUsers = [{ _id: '3', username: 'searchuser' }];
      const searchFilter = { search: 'search' };
      
      const mockCountDocuments = jest.fn().mockResolvedValue(1);
      const mockFind = jest.fn().mockReturnThis();
      const mockSort = jest.fn().mockReturnThis();
      const mockSkip = jest.fn().mockReturnThis();
      const mockLimit = jest.fn().mockResolvedValue(mockUsers);
      
      (User.countDocuments as jest.Mock) = mockCountDocuments;
      (User.find as jest.Mock) = mockFind;
      
      Object.defineProperty(User.find, 'sort', { value: mockSort });
      Object.defineProperty(User.find, 'skip', { value: mockSkip });
      Object.defineProperty(User.find, 'limit', { value: mockLimit });

      // Execute
      const result = await userService.getUsers(searchFilter);

      // Assert
      expect(mockFind).toHaveBeenCalledWith({
        $or: [
          { username: new RegExp('search', 'i') },
          { email: new RegExp('search', 'i') },
          { firstName: new RegExp('search', 'i') },
          { lastName: new RegExp('search', 'i') }
        ]
      });
      expect(result.users).toEqual(mockUsers);
    });
  });

  describe('getUserById', () => {
    it('should get user by ID successfully', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const mockUser = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com'
      };
      
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      // Execute
      const result = await userService.getUserById(userId);

      // Assert
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });

    it('should throw error if user not found', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      (User.findById as jest.Mock).mockResolvedValue(null);

      // Execute & Assert
      await expect(userService.getUserById(userId)).rejects.toThrow('User not found');
    });
  });

  describe('updateUser', () => {
    it('should update user successfully', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };
      
      const mockUser = {
        _id: userId,
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      };
      
      const updatedUser = {
        ...mockUser,
        ...updateData
      };
      
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValue(updatedUser);

      // Execute
      const result = await userService.updateUser(userId, updateData);

      // Assert
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        updateData,
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updatedUser);
    });

    it('should throw error if user not found', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const updateData = { firstName: 'Updated' };
      
      (User.findById as jest.Mock).mockResolvedValue(null);

      // Execute & Assert
      await expect(userService.updateUser(userId, updateData)).rejects.toThrow('User not found');
    });
  });

  // Add more tests for other service methods as needed
});
