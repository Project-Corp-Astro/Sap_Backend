import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import User, { IUser } from '../models/User';
import redisClient from '../../../../shared/utils/redis';
import emailService from '../../../../shared/utils/email';
import logger from '../../../../shared/utils/logger';
import encryptionService from '../../../../shared/utils/encryption';

// JWT secret key - should be stored in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// MFA settings
const MFA_APP_NAME = process.env.MFA_APP_NAME || 'SAP Corp Astro';

// Password reset settings
const PASSWORD_RESET_EXPIRES = 60 * 60; // 1 hour in seconds

// Login attempt settings
const MAX_FAILED_ATTEMPTS = 5;
const ACCOUNT_LOCK_TIME = 15 * 60; // 15 minutes in seconds

// Define interfaces
export interface UserData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
}

export interface TokenPayload {
  userId: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthData extends AuthTokens {
  user: any;
}

export interface MFAData {
  secret: string;
  qrCodeUrl: string;
  otpAuthUrl: string;
}

/**
 * Register a new user
 * @param userData - User data
 * @returns Newly created user
 */
export const register = async (userData: UserData): Promise<any> => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [
        { email: userData.email }, 
        { username: userData.username }
      ]
    });
    
    if (existingUser) {
      if (existingUser.email === userData.email) {
        throw new Error('Email already in use');
      } else {
        throw new Error('Username already taken');
      }
    }
    
    // Create new user
    const user = new User(userData);
    await user.save();
    
    // Return user without password
    const userObject = user.toObject();
    delete userObject.password;
    
    return userObject;
  } catch (error) {
    throw error;
  }
};

/**
 * Authenticate a user and generate tokens
 * @param email - User email
 * @param password - User password
 * @returns Authentication tokens and user data
 */
export const login = async (email: string, password: string): Promise<AuthData> => {
  try {
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is disabled. Please contact support.');
    }
    
    // Verify password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate tokens
    const tokens = generateTokens(user);
    
    // Return user data without password
    const userObject = user.toObject();
    delete userObject.password;
    
    return {
      user: userObject,
      ...tokens
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Generate JWT tokens for authentication
 * @param user - User document
 * @returns Access and refresh tokens
 */
export const generateTokens = (user: IUser): AuthTokens => {
  try {
    // Create token payload
    const payload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    };
    
    // Generate access token
    const accessToken = jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user._id.toString() },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );
    
    return {
      accessToken,
      refreshToken
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Refresh access token using refresh token
 * @param refreshToken - Refresh token
 * @returns New access token
 */
export const refreshToken = async (refreshToken: string): Promise<{ accessToken: string }> => {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as TokenPayload;
    
    // Find user
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      throw new Error('Invalid token or inactive user');
    }
    
    // Generate new access token
    const payload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role
    };
    
    const accessToken = jwt.sign(
      payload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    return { accessToken };
  } catch (error) {
    throw error;
  }
};

/**
 * Validate JWT token
 * @param token - JWT token
 * @returns Decoded token payload
 */
export const verifyToken = (token: string): TokenPayload => {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    throw error;
  }
};

/**
 * Decode refresh token without verification
 * @param refreshToken - Refresh token
 * @returns Decoded token payload
 */
export const decodeRefreshToken = (refreshToken: string): TokenPayload => {
  try {
    return jwt.verify(refreshToken, JWT_REFRESH_SECRET) as TokenPayload;
  } catch (error) {
    throw error;
  }
};

/**
 * Get user by ID
 * @param userId - User ID
 * @returns User document
 */
export const getUserById = async (userId: string): Promise<IUser> => {
  try {
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * Set up MFA for a user
 * @param userId - User ID
 * @returns MFA setup data
 */
export const setupMFA = async (userId: string): Promise<MFAData> => {
  try {
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Generate secret
    const secret = authenticator.generateSecret();
    
    // Create OTP auth URL
    const otpAuthUrl = authenticator.keyuri(user.email, MFA_APP_NAME, secret);
    
    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(otpAuthUrl);
    
    // Save secret to user
    user.mfaSecret = secret;
    await user.save();
    
    return {
      secret,
      qrCodeUrl,
      otpAuthUrl
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Verify MFA token
 * @param userId - User ID
 * @param token - MFA token
 * @returns Whether token is valid
 */
export const verifyMFA = async (userId: string, token: string): Promise<boolean> => {
  try {
    // Find user
    const user = await User.findById(userId);
    
    if (!user || !user.mfaSecret) {
      throw new Error('User not found or MFA not set up');
    }
    
    // Verify token
    const isValid = authenticator.verify({
      token,
      secret: user.mfaSecret
    });
    
    return isValid;
  } catch (error) {
    throw error;
  }
};

/**
 * Enable MFA for a user
 * @param userId - User ID
 * @returns Updated user
 */
export const enableMFA = async (userId: string): Promise<IUser> => {
  try {
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    if (!user.mfaSecret) {
      throw new Error('MFA not set up');
    }
    
    // Enable MFA
    user.mfaEnabled = true;
    
    // Generate recovery codes if not already generated
    if (!user.mfaRecoveryCodes || user.mfaRecoveryCodes.length === 0) {
      user.mfaRecoveryCodes = await generateRecoveryCodesArray();
    }
    
    await user.save();
    
    // Return user without sensitive data
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.mfaSecret;
    
    return userObject;
  } catch (error) {
    throw error;
  }
};

/**
 * Generate recovery codes
 * @param userId - User ID
 * @returns Array of recovery codes
 */
export const generateRecoveryCodes = async (userId: string): Promise<string[]> => {
  try {
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    if (!user.mfaEnabled) {
      throw new Error('MFA is not enabled');
    }
    
    // Generate recovery codes
    const recoveryCodes = await generateRecoveryCodesArray();
    
    // Save to user
    user.mfaRecoveryCodes = recoveryCodes;
    await user.save();
    
    return recoveryCodes;
  } catch (error) {
    throw error;
  }
};

/**
 * Generate an array of recovery codes
 * @returns Array of recovery codes
 */
const generateRecoveryCodesArray = async (): Promise<string[]> => {
  const codes: string[] = [];
  
  // Generate 10 recovery codes
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomBytes(10).toString('hex').slice(0, 10).toUpperCase();
    codes.push(code);
  }
  
  return codes;
};

/**
 * Track login attempt
 * @param userId - User ID
 * @param ip - IP address
 * @param success - Whether login was successful
 */
export const trackLoginAttempt = async (userId: string, ip: string, success: boolean): Promise<void> => {
  try {
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return;
    }
    
    // If login was successful, reset failed attempts
    if (success) {
      user.failedLoginAttempts = 0;
      user.accountLocked = false;
      user.lockUntil = undefined;
      
      // Update last login
      user.lastLogin = new Date();
      
      // Track device info if available
      // This would typically come from the request headers
      
      await user.save();
      return;
    }
    
    // Increment failed attempts
    user.failedLoginAttempts += 1;
    
    // Lock account if too many failed attempts
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.accountLocked = true;
      user.lockUntil = new Date(Date.now() + ACCOUNT_LOCK_TIME * 1000);
      
      // Log account lock
      logger.warn(`Account locked for user ${userId} due to too many failed login attempts`);
    }
    
    await user.save();
  } catch (error) {
    logger.error('Error tracking login attempt:', error);
  }
};

/**
 * Request password reset
 * @param email - User email
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  try {
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal that user doesn't exist
      return;
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    
    // Store token in Redis with expiration
    await redisClient.set(
      `password_reset:${user._id}`,
      hashedToken,
      'EX',
      PASSWORD_RESET_EXPIRES
    );
    
    // Send email with reset link
    await emailService.sendPasswordResetEmail(user.email, resetToken);
  } catch (error) {
    throw error;
  }
};

/**
 * Reset password with token
 * @param token - Reset token
 * @param newPassword - New password
 */
export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  try {
    // Hash token to compare with stored token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    // Find token in Redis
    const keys = await redisClient.keys('password_reset:*');
    
    let userId: string | null = null;
    
    // Check each token
    for (const key of keys) {
      const storedToken = await redisClient.get(key);
      
      if (storedToken === hashedToken) {
        userId = key.split(':')[1];
        break;
      }
    }
    
    if (!userId) {
      throw new Error('Invalid or expired password reset token');
    }
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }
    
    // Update password
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();
    
    // Delete token
    await redisClient.del(`password_reset:${userId}`);
    
    // Invalidate all existing tokens
    // This is done by updating passwordChangedAt
  } catch (error) {
    throw error;
  }
};
