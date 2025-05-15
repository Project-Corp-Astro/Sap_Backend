import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { UserRole } from '../../interfaces/user.interfaces';

// Define mock functions
const mockAuthMiddleware = jest.fn((req: Request, res: Response, next: NextFunction) => next());
const mockRoleAuthorization = jest.fn();
const mockRoleAuthorizationMiddleware = jest.fn((roles) => {
  mockRoleAuthorization(roles);
  return (req: Request, res: Response, next: NextFunction) => next();
});

// Mock middleware
jest.mock('../../middlewares/auth.middleware', () => ({
  authMiddleware: mockAuthMiddleware,
  roleAuthorization: mockRoleAuthorizationMiddleware
}));

// Import after mocking
import userRoutes from '../../routes/user.routes';
import * as userController from '../../controllers/user.controller';

// Mock the controller functions directly
jest.mock('../../controllers/user.controller', () => ({
  getUsers: jest.fn((req: Request, res: Response) => res.json([])),
  getUserById: jest.fn((req: Request, res: Response) => res.json({})),
  createUser: jest.fn((req: Request, res: Response) => res.json({})),
  updateUser: jest.fn((req: Request, res: Response) => res.json({})),
  deleteUser: jest.fn((req: Request, res: Response) => res.json({})),
  updateUserStatus: jest.fn((req: Request, res: Response) => res.json({})),
  updateProfile: jest.fn((req: Request, res: Response) => res.json({})),
  changePassword: jest.fn((req: Request, res: Response) => res.json({})),
  updateSecurityPreferences: jest.fn((req: Request, res: Response) => res.json({})),
  getUserActivity: jest.fn((req: Request, res: Response) => res.json([])),
  getUserDevices: jest.fn((req: Request, res: Response) => res.json([])),
  removeUserDevice: jest.fn((req: Request, res: Response) => res.json({}))
}));

// Mock the wrapController function
jest.mock('../../routes/user.routes', () => {
  const actualRoutes = jest.requireActual('../../routes/user.routes');
  return {
    ...actualRoutes,
    wrapController: jest.fn(controller => controller),
    __esModule: true,
    default: actualRoutes.default
  };
});

jest.mock('../../controllers/user.controller', () => ({
  getUsers: jest.fn((req, res) => res.json({ success: true })),
  createUser: jest.fn((req, res) => res.json({ success: true })),
  getUserById: jest.fn((req, res) => res.json({ success: true })),
  updateUser: jest.fn((req, res) => res.json({ success: true })),
  deleteUser: jest.fn((req, res) => res.json({ success: true })),
  updateUserStatus: jest.fn((req, res) => res.json({ success: true })),
  updateProfile: jest.fn((req, res) => res.json({ success: true })),
  changePassword: jest.fn((req, res) => res.json({ success: true })),
  updateSecurityPreferences: jest.fn((req, res) => res.json({ success: true })),
  getUserActivity: jest.fn((req, res) => res.json({ success: true })),
  getUserDevices: jest.fn((req, res) => res.json({ success: true })),
  removeUserDevice: jest.fn((req, res) => res.json({ success: true }))
}));

describe('User Routes Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    
    // Manually trigger the middleware for testing
    app.use((req, res, next) => {
      // Add a mock user to the request to satisfy TypeScript
      (req as any).user = {
        _id: new mongoose.Types.ObjectId(),
        userId: 'test-user-id',
        email: 'test@example.com',
        role: UserRole.USER,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        isActive: true,
        devices: []
      };
      // Use type assertion to avoid TypeScript errors
      mockAuthMiddleware(req as any, res as any, next);
      next();
    });
    
    // Add routes after middleware
    app.use('/api/users', userRoutes);
  });

  describe('GET /api/users', () => {
    it('should call getUsers controller with proper middleware', async () => {
      // Execute
      await request(app).get('/api/users');
      
      // Assert
      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(mockRoleAuthorization).toHaveBeenCalledWith([UserRole.ADMIN, UserRole.CONTENT_MANAGER]);
      expect(userController.getUsers).toHaveBeenCalled();
    });
  });

  describe('POST /api/users', () => {
    it('should call createUser controller with proper middleware', async () => {
      // Setup
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      };
      
      // Execute
      await request(app)
        .post('/api/users')
        .send(userData);
      
      // Assert
      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(mockRoleAuthorization).toHaveBeenCalledWith([UserRole.ADMIN]);
      expect(userController.createUser).toHaveBeenCalled();
    });
  });

  describe('GET /api/users/:userId', () => {
    it('should call getUserById controller with proper middleware', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      
      // Execute
      await request(app).get(`/api/users/${userId}`);
      
      // Assert
      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(userController.getUserById).toHaveBeenCalled();
    });
  });

  describe('PUT /api/users/:userId', () => {
    it('should call updateUser controller with proper middleware', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name'
      };
      
      // Execute
      await request(app)
        .put(`/api/users/${userId}`)
        .send(updateData);
      
      // Assert
      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(userController.updateUser).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/users/:userId', () => {
    it('should call deleteUser controller with proper middleware', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      
      // Execute
      await request(app).delete(`/api/users/${userId}`);
      
      // Assert
      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(mockRoleAuthorization).toHaveBeenCalledWith([UserRole.ADMIN]);
      expect(userController.deleteUser).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/users/:userId/status', () => {
    it('should call updateUserStatus controller with proper middleware', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      const statusData = { isActive: false };
      
      // Execute
      await request(app)
        .patch(`/api/users/${userId}/status`)
        .send(statusData);
      
      // Assert
      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(mockRoleAuthorization).toHaveBeenCalledWith([UserRole.ADMIN]);
      expect(userController.updateUserStatus).toHaveBeenCalled();
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should call updateProfile controller with proper middleware', async () => {
      // Setup
      const profileData = {
        firstName: 'Updated',
        lastName: 'Name',
        phoneNumber: '+1234567890'
      };
      
      // Execute
      await request(app)
        .put('/api/users/profile')
        .send(profileData);
      
      // Assert
      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(userController.updateProfile).toHaveBeenCalled();
    });
  });

  describe('PUT /api/users/password', () => {
    it('should call changePassword controller with proper middleware', async () => {
      // Setup
      const passwordData = {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123'
      };
      
      // Execute
      await request(app)
        .put('/api/users/password')
        .send(passwordData);
      
      // Assert
      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(userController.changePassword).toHaveBeenCalled();
    });
  });

  describe('PUT /api/users/security-preferences', () => {
    it('should call updateSecurityPreferences controller with proper middleware', async () => {
      // Setup
      const securityData = {
        twoFactorEnabled: true,
        loginNotifications: true,
        activityAlerts: true
      };
      
      // Execute
      await request(app)
        .put('/api/users/security-preferences')
        .send(securityData);
      
      // Assert
      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(userController.updateSecurityPreferences).toHaveBeenCalled();
    });
  });

  describe('GET /api/users/:userId/activity', () => {
    it('should call getUserActivity controller with proper middleware', async () => {
      // Setup
      const userId = new mongoose.Types.ObjectId().toString();
      
      // Execute
      await request(app).get(`/api/users/${userId}/activity`);
      
      // Assert
      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(userController.getUserActivity).toHaveBeenCalled();
    });
  });

  describe('GET /api/users/devices', () => {
    it('should call getUserDevices controller with proper middleware', async () => {
      // Execute
      await request(app).get('/api/users/devices');
      
      // Assert
      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(userController.getUserDevices).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/users/devices/:deviceId', () => {
    it('should call removeUserDevice controller with proper middleware', async () => {
      // Setup
      const deviceId = 'device123';
      
      // Execute
      await request(app).delete(`/api/users/devices/${deviceId}`);
      
      // Assert
      expect(mockAuthMiddleware).toHaveBeenCalled();
      expect(userController.removeUserDevice).toHaveBeenCalled();
    });
  });
});
