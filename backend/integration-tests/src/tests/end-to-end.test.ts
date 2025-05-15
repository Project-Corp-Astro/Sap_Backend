import { AuthServiceClient, UserServiceClient } from '../utils/service-clients';
import { ContentServiceClient } from '../utils/content-service-client';

// Test data
const testUser = {
  username: 'e2etestuser',
  email: 'e2etest@example.com',
  password: 'Password123!',
  firstName: 'E2E',
  lastName: 'Test'
};

const testContent = {
  title: 'Test Content Item',
  body: 'This is a test content item created during E2E testing.',
  type: 'article',
  tags: ['test', 'e2e', 'typescript'],
  category: 'testing',
  isPublished: true
};

// Create service clients
const authService = new AuthServiceClient();
const userService = new UserServiceClient();
const contentService = new ContentServiceClient();

describe('End-to-End Integration Tests', () => {
  let userId: string;
  let accessToken: string;
  let refreshToken: string;
  let contentId: string;

  // Test the complete user journey
  describe('Complete User Journey', () => {
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
      
      // Set the auth token for all services
      userService.setAuthToken(accessToken);
      contentService.setAuthToken(accessToken);
    });

    it('should get the user profile', async () => {
      // Get the user profile through the User Service
      const response = await userService.getUserById(userId);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data._id).toBe(userId);
      expect(response.data.email).toBe(testUser.email);
    });

    it('should create a content item', async () => {
      // Create a content item through the Content Service
      const response = await contentService.createContent(testContent);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.title).toBe(testContent.title);
      expect(response.data.body).toBe(testContent.body);
      expect(response.data.type).toBe(testContent.type);
      expect(response.data.createdBy).toBe(userId);
      
      // Store the content ID for subsequent tests
      contentId = response.data._id;
    });

    it('should get the created content item', async () => {
      // Get the content item through the Content Service
      const response = await contentService.getContentById(contentId);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data._id).toBe(contentId);
      expect(response.data.title).toBe(testContent.title);
      expect(response.data.createdBy).toBe(userId);
    });

    it('should track content view', async () => {
      // Track a content view through the Content Service
      const response = await contentService.trackContentView(contentId);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
    });

    it('should get content analytics', async () => {
      // Get content analytics through the Content Service
      const response = await contentService.getContentAnalytics(contentId);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.views).toBeGreaterThan(0); // Should have at least one view
    });

    it('should update the content item', async () => {
      // Update the content item through the Content Service
      const updatedData = {
        title: 'Updated Test Content',
        body: 'This content has been updated during E2E testing.'
      };
      
      const response = await contentService.updateContent(contentId, updatedData);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data._id).toBe(contentId);
      expect(response.data.title).toBe(updatedData.title);
      expect(response.data.body).toBe(updatedData.body);
      expect(response.data.type).toBe(testContent.type); // Type should not change
    });

    it('should search for content', async () => {
      // Search for content through the Content Service
      const response = await contentService.searchContent('Updated Test');
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data.results)).toBe(true);
      expect(response.data.results.length).toBeGreaterThan(0);
      
      // The first result should be our updated content
      const firstResult = response.data.results[0];
      expect(firstResult._id).toBe(contentId);
    });

    it('should get user activity after content operations', async () => {
      // Get user activity through the User Service
      const response = await userService.getUserActivity(userId);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data.activities)).toBe(true);
      
      // There should be activity records for content creation and update
      expect(response.data.activities.length).toBeGreaterThan(0);
      
      // Check if there are content-related activities
      const contentActivities = response.data.activities.filter(
        (activity: any) => activity.metadata && activity.metadata.contentId
      );
      expect(contentActivities.length).toBeGreaterThan(0);
    });

    it('should delete the content item', async () => {
      // Delete the content item through the Content Service
      const response = await contentService.deleteContent(contentId);
      
      // Verify the response
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      
      // Try to get the deleted content
      try {
        await contentService.getContentById(contentId);
        
        // Should not reach here
        fail('Should have thrown an error for deleted content');
      } catch (error: any) {
        // Verify the error
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(404);
      }
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
      
      // Update the auth token for all services
      userService.setAuthToken(accessToken);
      contentService.setAuthToken(accessToken);
    });

    it('should logout the user', async () => {
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
