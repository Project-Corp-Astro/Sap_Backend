import { AuthServiceClient, UserServiceClient } from '../utils/service-clients';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'Password123!',
  firstName: 'Test',
  lastName: 'User'
};

// Create service clients
const authService = new AuthServiceClient();
const userService = new UserServiceClient();

describe('Auth and User Service Integration Tests', () => {
  let userId: string;
  let accessToken: string;
  let refreshToken: string;

  // Test user registration and authentication flow
  describe('User Registration and Authentication Flow', () => {
    it('should register a new user', async () => {
      // Register a new user through the Auth Service
      const response = await authService.register(testUser);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.message).toBe('User registered successfully');
      expect(response.data).toBeDefined();
      expect(response.data.user).toBeDefined();
      expect(response.data.user.email).toBe(testUser.email);
      
      // Store the user ID for subsequent tests
      userId = response.data.user._id;
    });

    it('should login the registered user', async () => {
      // Login the user through the Auth Service
      const response = await authService.login({
        email: testUser.email,
        password: testUser.password
      });
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.message).toBe('Login successful');
      expect(response.data).toBeDefined();
      expect(response.data.user).toBeDefined();
      expect(response.data.tokens).toBeDefined();
      expect(response.data.tokens.accessToken).toBeDefined();
      expect(response.data.tokens.refreshToken).toBeDefined();
      
      // Store the tokens for subsequent tests
      accessToken = response.data.tokens.accessToken;
      refreshToken = response.data.tokens.refreshToken;
      
      // Set the auth token for the User Service
      userService.setAuthToken(accessToken);
    });

    it('should get the user profile', async () => {
      // Get the user profile through the Auth Service
      const response = await authService.getProfile();
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.message).toBe('User profile retrieved successfully');
      expect(response.data).toBeDefined();
      expect(response.data._id).toBe(userId);
      expect(response.data.email).toBe(testUser.email);
    });

    it('should refresh the access token', async () => {
      // Refresh the access token through the Auth Service
      const response = await authService.refreshToken(refreshToken);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.accessToken).toBeDefined();
      expect(response.data.refreshToken).toBeDefined();
      
      // Update the tokens
      accessToken = response.data.accessToken;
      refreshToken = response.data.refreshToken;
      
      // Update the auth token for the User Service
      userService.setAuthToken(accessToken);
    });
  });

  // Test user data management flow
  describe('User Data Management Flow', () => {
    it('should get the user by ID', async () => {
      // Get the user by ID through the User Service
      const response = await userService.getUserById(userId);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data._id).toBe(userId);
      expect(response.data.email).toBe(testUser.email);
    });

    it('should update the user profile', async () => {
      // Update the user profile through the User Service
      const updatedData = {
        firstName: 'Updated',
        lastName: 'User'
      };
      
      const response = await userService.updateUser(userId, updatedData);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data._id).toBe(userId);
      expect(response.data.firstName).toBe(updatedData.firstName);
      expect(response.data.lastName).toBe(updatedData.lastName);
      expect(response.data.email).toBe(testUser.email); // Email should not change
    });

    it('should get user activity', async () => {
      // Get user activity through the User Service
      const response = await userService.getUserActivity(userId);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data.activities)).toBe(true);
      
      // There should be some activity records for the user
      // (login, profile update, etc.)
      expect(response.data.activities.length).toBeGreaterThan(0);
    });

    it('should get user devices', async () => {
      // Get user devices through the User Service
      const response = await userService.getUserDevices(userId);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data.devices)).toBe(true);
      
      // There should be at least one device record for the user
      // (the device used for login)
      expect(response.data.devices.length).toBeGreaterThan(0);
    });
  });

  // Test authentication requirements
  describe('Authentication Requirements', () => {
    it('should fail to access protected resources without authentication', async () => {
      // Clear the auth token
      userService.setAuthToken('');
      
      try {
        // Try to get the user profile without authentication
        await userService.getUserById(userId);
        
        // Should not reach here
        fail('Should have thrown an error for unauthorized access');
      } catch (error: any) {
        // Verify the error
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(401);
      }
    });

    it('should logout the user', async () => {
      // Set the auth token back
      userService.setAuthToken(accessToken);
      
      // Logout the user through the Auth Service
      const response = await authService.logout();
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.message).toBe('Logout successful');
      
      // Try to access a protected resource after logout
      try {
        // Try to get the user profile after logout
        await userService.getUserById(userId);
        
        // Should not reach here
        fail('Should have thrown an error for unauthorized access after logout');
      } catch (error: any) {
        // Verify the error
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(401);
      }
    });
  });
});
