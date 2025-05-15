import mongoose from 'mongoose';
import User from '../../models/User';
import { UserRole, MFAType } from '../../interfaces/auth.interfaces';

describe('User Model Tests', () => {
  const userData = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'Password123!',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.USER,
    isActive: true,
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
  };

  beforeEach(async () => {
    // Clear users collection before each test
    await User.deleteMany({});
  });

  it('should create a new user successfully', async () => {
    const newUser = new User(userData);
    const savedUser = await newUser.save();
    
    expect(savedUser._id).toBeDefined();
    expect(savedUser.username).toBe(userData.username);
    expect(savedUser.email).toBe(userData.email);
    expect(savedUser.firstName).toBe(userData.firstName);
    expect(savedUser.lastName).toBe(userData.lastName);
    expect(savedUser.role).toBe(userData.role);
    expect(savedUser.isActive).toBe(userData.isActive);
    expect(savedUser.createdAt).toBeDefined();
    expect(savedUser.updatedAt).toBeDefined();
  });

  it('should fail to create a user without required fields', async () => {
    const invalidUser = new User({
      username: 'incomplete',
      // Missing required fields
    });

    await expect(invalidUser.save()).rejects.toThrow();
  });

  it('should validate role enum values', async () => {
    const userWithInvalidRole = new User({
      ...userData,
      username: 'roletest',
      email: 'role@example.com',
      role: 'invalid_role' // Not in UserRole enum
    });

    await expect(userWithInvalidRole.save()).rejects.toThrow();
  });

  it('should enforce unique email constraint', async () => {
    // Get the User schema
    const userSchema = User.schema;
    
    // Check if the email field has a unique index
    const emailPath = userSchema.path('email');
    expect(emailPath).toBeDefined();
    
    // Check if the email field has the unique property set to true
    const emailSchemaType = emailPath as any;
    expect(emailSchemaType.options).toBeDefined();
    expect(emailSchemaType.options.unique).toBe(true);
  });
});
