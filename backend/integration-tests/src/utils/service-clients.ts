import { ApiClient } from './api-client';

/**
 * Auth Service client
 */
export class AuthServiceClient {
  private client: ApiClient;

  /**
   * Create a new Auth Service client
   * @param baseUrl - Base URL for the Auth Service
   */
  constructor(baseUrl: string = 'http://localhost:3001/api/auth') {
    this.client = new ApiClient(baseUrl);
  }

  /**
   * Register a new user
   * @param userData - User registration data
   * @returns Promise with the registration response
   */
  async register(userData: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<any> {
    return this.client.post('/register', userData);
  }

  /**
   * Login a user
   * @param credentials - User login credentials
   * @returns Promise with the login response
   */
  async login(credentials: {
    email: string;
    password: string;
    rememberMe?: boolean;
  }): Promise<any> {
    const response = await this.client.post('/login', credentials);
    
    // Set the auth token for subsequent requests
    if (response.data && response.data.tokens && response.data.tokens.accessToken) {
      this.client.setAuthToken(response.data.tokens.accessToken);
    }
    
    return response;
  }

  /**
   * Refresh the access token
   * @param refreshToken - Refresh token
   * @returns Promise with the refresh response
   */
  async refreshToken(refreshToken: string): Promise<any> {
    const response = await this.client.post('/refresh-token', { refreshToken });
    
    // Set the new auth token for subsequent requests
    if (response.data && response.data.accessToken) {
      this.client.setAuthToken(response.data.accessToken);
    }
    
    return response;
  }

  /**
   * Logout a user
   * @returns Promise with the logout response
   */
  async logout(): Promise<any> {
    const response = await this.client.post('/logout', {});
    
    // Clear the auth token
    this.client.clearAuthToken();
    
    return response;
  }

  /**
   * Request a password reset
   * @param email - User email
   * @returns Promise with the password reset request response
   */
  async requestPasswordReset(email: string): Promise<any> {
    return this.client.post('/request-password-reset', { email });
  }

  /**
   * Reset a password with a token
   * @param token - Reset token
   * @param newPassword - New password
   * @returns Promise with the password reset response
   */
  async resetPassword(token: string, newPassword: string): Promise<any> {
    return this.client.post('/reset-password', { token, newPassword });
  }

  /**
   * Get the current user profile
   * @returns Promise with the user profile
   */
  async getProfile(): Promise<any> {
    return this.client.get('/profile');
  }
}

/**
 * User Service client
 */
export class UserServiceClient {
  private client: ApiClient;

  /**
   * Create a new User Service client
   * @param baseUrl - Base URL for the User Service
   */
  constructor(baseUrl: string = 'http://localhost:3002/api/users') {
    this.client = new ApiClient(baseUrl);
  }

  /**
   * Set the authentication token for subsequent requests
   * @param token - JWT token
   */
  setAuthToken(token: string): void {
    this.client.setAuthToken(token);
  }

  /**
   * Get a list of users
   * @param page - Page number
   * @param limit - Number of users per page
   * @returns Promise with the users response
   */
  async getUsers(page: number = 1, limit: number = 10): Promise<any> {
    return this.client.get(`/?page=${page}&limit=${limit}`);
  }

  /**
   * Get a user by ID
   * @param userId - User ID
   * @returns Promise with the user response
   */
  async getUserById(userId: string): Promise<any> {
    return this.client.get(`/${userId}`);
  }

  /**
   * Create a new user
   * @param userData - User data
   * @returns Promise with the user creation response
   */
  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
  }): Promise<any> {
    return this.client.post('/', userData);
  }

  /**
   * Update a user
   * @param userId - User ID
   * @param userData - User data to update
   * @returns Promise with the user update response
   */
  async updateUser(userId: string, userData: any): Promise<any> {
    return this.client.put(`/${userId}`, userData);
  }

  /**
   * Delete a user
   * @param userId - User ID
   * @returns Promise with the user deletion response
   */
  async deleteUser(userId: string): Promise<any> {
    return this.client.delete(`/${userId}`);
  }

  /**
   * Get user activity
   * @param userId - User ID
   * @param page - Page number
   * @param limit - Number of activities per page
   * @returns Promise with the user activity response
   */
  async getUserActivity(userId: string, page: number = 1, limit: number = 10): Promise<any> {
    return this.client.get(`/${userId}/activity?page=${page}&limit=${limit}`);
  }

  /**
   * Get user devices
   * @param userId - User ID
   * @returns Promise with the user devices response
   */
  async getUserDevices(userId: string): Promise<any> {
    return this.client.get(`/${userId}/devices`);
  }
}
