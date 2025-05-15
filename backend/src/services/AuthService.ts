/**
 * Auth Service
 * Provides authentication functionality using PostgreSQL for user data and Redis for sessions
 */

import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { MoreThan } from 'typeorm';
import { createServiceLogger } from '../../shared/utils/logger';
import redisClient from '../../shared/utils/redis';
import config from '../../shared/config/index';
import { UserRepository } from '../repositories/UserRepository';
import { UserSessionRepository } from '../repositories/UserSessionRepository';
import { RoleRepository } from '../repositories/RoleRepository';

const logger = createServiceLogger('auth-service');
const JWT_SECRET = config.get('jwt.secret', 'your-secret-key');
const JWT_EXPIRES_IN = config.get('jwt.expiresIn', '1d');

export class AuthService {
  private userRepository: UserRepository;
  private userSessionRepository: UserSessionRepository;
  private roleRepository: RoleRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.userSessionRepository = new UserSessionRepository();
    this.roleRepository = new RoleRepository();
  }

  /**
   * Register a new user
   * @param userData - User registration data
   * @returns Registered user
   */
  async register(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Promise<any> {
    try {
      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(userData.email);
      
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(userData.password, salt);
      
      // Get default role (viewer)
      const viewerRole = await this.roleRepository.findByName('viewer');
      
      if (!viewerRole) {
        throw new Error('Default role not found');
      }
      
      // Create verification token
      const verificationToken = uuidv4();
      
      // Create user
      const user = await this.userRepository.create({
        email: userData.email,
        passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        verificationToken,
        roleId: viewerRole.id
      });
      
      // Remove sensitive data
      const userResponse = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        role: viewerRole.name,
        createdAt: user.createdAt
      };
      
      // TODO: Send verification email
      
      return userResponse;
    } catch (error) {
      logger.error('Error registering user', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Login user
   * @param email - User email
   * @param password - User password
   * @param deviceInfo - Device information
   * @returns Login response with tokens
   */
  async login(
    email: string,
    password: string,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      deviceType?: string;
      browser?: string;
      operatingSystem?: string;
      ipAddress?: string;
      userAgent?: string;
      location?: {
        country?: string;
        region?: string;
        city?: string;
        latitude?: number;
        longitude?: number;
      };
    }
  ): Promise<any> {
    try {
      // Find user
      const user = await this.userRepository.findByEmail(email);
      
      if (!user) {
        throw new Error('Invalid credentials');
      }
      
      // Check if user is locked
      if (user.isLocked()) {
        throw new Error('Account is locked due to too many failed login attempts');
      }
      
      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      
      if (!isPasswordValid) {
        // Increment login attempts
        user.incrementLoginAttempts();
        await this.userRepository.update(user.id, {
          loginAttempts: user.loginAttempts,
          lockUntil: user.lockUntil
        });
        
        throw new Error('Invalid credentials');
      }
      
      // Reset login attempts
      if (user.loginAttempts > 0) {
        user.resetLoginAttempts();
        await this.userRepository.update(user.id, {
          loginAttempts: 0,
          lockUntil: null
        });
      }
      
      // Update last login
      await this.userRepository.update(user.id, {
        lastLogin: new Date()
      });
      
      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role.name
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      // Create session
      const sessionToken = uuidv4();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days
      
      const session = await this.userSessionRepository.create({
        userId: user.id,
        token: sessionToken,
        expiresAt,
        deviceId: deviceInfo?.deviceId,
        deviceName: deviceInfo?.deviceName,
        deviceType: deviceInfo?.deviceType,
        browser: deviceInfo?.browser,
        operatingSystem: deviceInfo?.operatingSystem,
        ipAddress: deviceInfo?.ipAddress,
        userAgent: deviceInfo?.userAgent,
        location: deviceInfo?.location,
        lastUsedAt: new Date()
      });
      
      // Store session in Redis for faster access
      await redisClient.set(`auth:session:${sessionToken}`, {
        userId: user.id,
        expiresAt: session.expiresAt
      }, 60 * 60 * 24 * 30); // 30 days
      
      // Return response
      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role.name,
          isVerified: user.isVerified
        },
        tokens: {
          accessToken: token,
          refreshToken: sessionToken,
          expiresAt: expiresAt.toISOString()
        }
      };
    } catch (error) {
      logger.error('Error logging in user', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Logout user
   * @param sessionToken - Session token
   * @returns True if logout was successful
   */
  async logout(sessionToken: string): Promise<boolean> {
    try {
      // Revoke session
      const revoked = await this.userSessionRepository.revokeSession(sessionToken);
      
      // Remove from Redis
      await redisClient.del(`auth:session:${sessionToken}`);
      
      return revoked;
    } catch (error) {
      logger.error('Error logging out user', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Refresh access token
   * @param refreshToken - Refresh token
   * @returns New access token
   */
  async refreshToken(refreshToken: string): Promise<any> {
    try {
      // Find session
      const session = await this.userSessionRepository.findByToken(refreshToken);
      
      if (!session) {
        throw new Error('Invalid refresh token');
      }
      
      // Check if session is valid
      if (!session.isValid()) {
        throw new Error('Refresh token is expired or revoked');
      }
      
      // Get user
      const user = await this.userRepository.findById(session.userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }
      
      // Generate new JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role.name
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      // Update session last used time
      await this.userSessionRepository.updateLastUsedTime(refreshToken);
      
      // Return new token
      return {
        accessToken: token
      };
    } catch (error) {
      logger.error('Error refreshing token', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Verify JWT token
   * @param token - JWT token
   * @returns Decoded token payload
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      logger.error('Error verifying token', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Change password
   * @param userId - User ID
   * @param currentPassword - Current password
   * @param newPassword - New password
   * @returns True if password was changed
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Find user
      const user = await this.userRepository.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Verify current password
      const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      
      if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
      }
      
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      
      // Update password
      await this.userRepository.update(userId, {
        passwordHash
      });
      
      // Revoke all sessions for security
      await this.userSessionRepository.revokeAllSessionsForUser(userId);
      
      // Remove all Redis session entries
      const sessionKeys = await redisClient.keys(`auth:session:*`);
      for (const key of sessionKeys) {
        const session = await redisClient.get(key);
        if (session && session.userId === userId) {
          await redisClient.del(key);
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error changing password', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Request password reset
   * @param email - User email
   * @returns True if reset request was successful
   */
  async requestPasswordReset(email: string): Promise<boolean> {
    try {
      // Find user
      const user = await this.userRepository.findByEmail(email);
      
      if (!user) {
        // Return true even if user doesn't exist for security
        return true;
      }
      
      // Generate reset token
      const resetToken = uuidv4();
      
      // Set expiration (1 hour)
      const resetExpires = new Date();
      resetExpires.setHours(resetExpires.getHours() + 1);
      
      // Update user
      await this.userRepository.update(user.id, {
        resetPasswordToken: resetToken,
        resetPasswordExpires: resetExpires
      });
      
      // TODO: Send password reset email
      
      return true;
    } catch (error) {
      logger.error('Error requesting password reset', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Reset password
   * @param token - Reset token
   * @param newPassword - New password
   * @returns True if password was reset
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // Find user by reset token
      const user = await this.userRepository.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: MoreThan(new Date())
      });
      
      if (!user) {
        throw new Error('Invalid or expired reset token');
      }
      
      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);
      
      // Update password and clear reset token
      await this.userRepository.update(user.id, {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null
      });
      
      // Revoke all sessions for security
      await this.userSessionRepository.revokeAllSessionsForUser(user.id);
      
      return true;
    } catch (error) {
      logger.error('Error resetting password', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Verify email
   * @param token - Verification token
   * @returns True if email was verified
   */
  async verifyEmail(token: string): Promise<boolean> {
    try {
      // Find user by verification token
      const user = await this.userRepository.findOne({
        verificationToken: token
      });
      
      if (!user) {
        throw new Error('Invalid verification token');
      }
      
      // Update user
      await this.userRepository.update(user.id, {
        isVerified: true,
        verificationToken: null
      });
      
      return true;
    } catch (error) {
      logger.error('Error verifying email', { error: (error as Error).message });
      throw error;
    }
  }
}

// Create and export a singleton instance
const authService = new AuthService();
export default authService;
