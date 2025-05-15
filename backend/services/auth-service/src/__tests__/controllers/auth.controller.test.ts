import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import * as authController from '../../controllers/auth.controller';
import User from '../../models/User';
import Token from '../../models/Token';
import { UserRole, TokenType } from '../../interfaces/auth.interfaces';

// Mock the auth service
jest.mock('../../services/auth.service', () => ({
  register: jest.fn().mockImplementation((userData) => {
    return Promise.resolve({
      user: {
        _id: new mongoose.Types.ObjectId(),
        ...userData,
        password: undefined // Password should not be returned
      },
      tokens: {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600
      }
    });
  }),
  login: jest.fn(),
  refreshToken: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn()
}));

// Mock response object
const mockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

// Define interface for authenticated request
interface AuthenticatedRequest extends Request {
  user?: any;
}

// Mock request object
const mockRequest = (data: any = {}) => {
  const req: Partial<AuthenticatedRequest> = {
    body: data.body || {},
    params: data.params || {},
    query: data.query || {},
    user: data.user || null
  };
  return req as AuthenticatedRequest;
};

// Mock next function
const mockNext = jest.fn();

describe('Auth Controller Tests', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  let userId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    // Clear collections before each test
    await User.deleteMany({});
    await Token.deleteMany({});
    
    // No need to initialize controller as we're using exported functions
    
    // Create a test user
    const user = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      role: UserRole.USER,
      isActive: true,
      isEmailVerified: true,
      accountLocked: false,
      preferences: {
        theme: 'system',
        notifications: {
          email: true,
          push: true
        }
      },
      securityPreferences: {
        twoFactorEnabled: false,
        loginNotifications: true,
        activityAlerts: true
      }
    });
    
    const savedUser = await user.save();
    userId = savedUser._id as unknown as mongoose.Types.ObjectId;
  });

  describe('requestPasswordReset', () => {
    it('should request password reset successfully', async () => {
      const req = mockRequest({
        body: {
          email: 'test@example.com'
        }
      });
      
      const res = mockResponse();
      
      // Call the requestPasswordReset function
      await authController.requestPasswordReset(req, res, mockNext);
      
      // Verify response (always returns success to prevent email enumeration)
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Password reset link sent if email exists');
    });
    
    it('should return error for missing email', async () => {
      const req = mockRequest({
        body: {
          // Missing email
        }
      });
      
      const res = mockResponse();
      
      // Call the requestPasswordReset function
      await authController.requestPasswordReset(req, res, mockNext);
      
      // Verify response for validation error
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBe('Email is required');
    });
  });
  
  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const req = mockRequest({
        body: {
          token: 'valid-reset-token',
          newPassword: 'NewPassword123!'
        }
      });
      
      const res = mockResponse();
      
      // Call the resetPassword function
      await authController.resetPassword(req, res, mockNext);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Password reset successful');
    });
    
    it('should return error for missing token or new password', async () => {
      const req = mockRequest({
        body: {
          // Missing token and newPassword
        }
      });
      
      const res = mockResponse();
      
      // Call the resetPassword function
      await authController.resetPassword(req, res, mockNext);
      
      // Verify response for validation error
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBe('Token and new password are required');
    });
    
    it('should return error for invalid or expired token', async () => {
      const req = mockRequest({
        body: {
          token: 'invalid-reset-token',
          newPassword: 'NewPassword123!'
        }
      });
      
      const res = mockResponse();
      
      // Mock auth service to throw error for invalid token
      jest.spyOn(require('../../services/auth.service'), 'resetPassword')
        .mockImplementationOnce(() => {
          const error = new Error('Token is expired or invalid');
          error.message = 'Token is expired or invalid';
          throw error;
        });
      
      // Call the resetPassword function
      await authController.resetPassword(req, res, mockNext);
      
      // Verify response for invalid token
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBe('Token is expired or invalid');
    });
  });
  
  describe('register', () => {
    it('should register a new user successfully', async () => {
      const req = mockRequest({
        body: {
          username: 'newuser',
          email: 'new@example.com',
          password: 'Password123!',
          firstName: 'New',
          lastName: 'User'
        }
      });
      
      const res = mockResponse();
      
      await authController.register(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeDefined();
      expect(responseData.message).toBe('User registered successfully');
    });

    it('should return error for duplicate email', async () => {
      const req = mockRequest({
        body: {
          username: 'duplicate',
          email: 'test@example.com', // Already exists
          password: 'Password123!',
          firstName: 'Duplicate',
          lastName: 'User'
        }
      });
      
      const res = mockResponse();
      
      await authController.register(req, res, mockNext);
      
      // Should call next with error
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login a user successfully', async () => {
      const req = mockRequest({
        body: {
          email: 'test@example.com',
          password: 'Password123!'
        }
      });
      
      const res = mockResponse();
      
      // Call the login function
      await authController.login(req, res, mockNext);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      // Check response data structure
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Login successful');
      expect(responseData.data).toBeDefined();
    });
    
    it('should return error for invalid credentials', async () => {
      // Mock auth service to throw error for invalid credentials
      jest.spyOn(require('../../services/auth.service'), 'login')
        .mockImplementationOnce(() => {
          throw new Error('Invalid credentials');
        });
      
      const req = mockRequest({
        body: {
          email: 'wrong@example.com',
          password: 'WrongPassword'
        }
      });
      
      const res = mockResponse();
      
      // Call the login function
      await authController.login(req, res, mockNext);
      
      // Verify next was called with error
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Invalid credentials');
    });
    
    it('should return error for missing email or password', async () => {
      const req = mockRequest({
        body: {
          // Missing email and password
        }
      });
      
      const res = mockResponse();
      
      // Call the login function
      await authController.login(req, res, mockNext);
      
      // Verify response for validation error
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBe('Email and password are required');
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      // Create a refresh token
      const token = new Token({
        userId,
        token: 'valid-refresh-token',
        type: TokenType.REFRESH,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        isRevoked: false
      });
      
      await token.save();
      
      const req = mockRequest({
        body: {
          refreshToken: 'valid-refresh-token'
        }
      });
      
      const res = mockResponse();
      
      // Call the refreshToken function
      await authController.refreshToken(req, res, mockNext);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      // Check response data structure
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeDefined();
      expect(responseData.data.accessToken).toBeDefined();
      expect(responseData.data.refreshToken).toBeDefined();
      expect(responseData.data.expiresIn).toBeDefined();
    });
    
    it('should return error for invalid refresh token', async () => {
      const req = mockRequest({
        body: {
          refreshToken: 'invalid-refresh-token'
        }
      });
      
      const res = mockResponse();
      
      // Mock auth service to throw error for invalid token
      jest.spyOn(require('../../services/auth.service'), 'refreshToken')
        .mockImplementationOnce(() => {
          throw new Error('Invalid refresh token');
        });
      
      // Call the refreshToken function
      await authController.refreshToken(req, res, mockNext);
      
      // Verify response for invalid token
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBe('Invalid or expired refresh token');
    });
    
    it('should return error for missing refresh token', async () => {
      const req = mockRequest({
        body: {
          // Missing refreshToken
        }
      });
      
      const res = mockResponse();
      
      // Call the refreshToken function
      await authController.refreshToken(req, res, mockNext);
      
      // Verify response for validation error
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBe('Refresh token is required');
    });
  });

  describe('logout', () => {
    it('should logout a user successfully', async () => {
      // Create a refresh token
      const token = new Token({
        userId,
        token: 'valid-refresh-token',
        type: TokenType.REFRESH,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        isRevoked: false
      });
      
      await token.save();
      
      const req = mockRequest({
        user: {
          _id: userId
        }
      });
      
      const res = mockResponse();
      
      // Call the logout function
      await authController.logout(req, res);
      
      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      
      // Check response data structure
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Logout successful');
    });
    
    it('should return error for unauthenticated user', async () => {
      const req = mockRequest({
        // No user property (unauthenticated)
      });
      
      const res = mockResponse();
      
      // Call the logout function
      await authController.logout(req, res);
      
      // Verify response for unauthenticated user
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
      
      const responseData = (res.json as jest.Mock).mock.calls[0][0];
      expect(responseData.success).toBe(false);
      expect(responseData.message).toBe('Authentication required');
    });
  });
});
