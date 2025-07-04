import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import User from '../models/User';
import { IUser } from '../../../../shared/interfaces/user.interface';
import { otpCache } from '../utils/redis';
import emailService from '../../../../shared/utils/email';
import logger from '../../../../shared/utils/logger';
import { asIUser } from '../utils/type-assertions';
// JWT secret key - should be stored in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
// Add this import at the top of the file with other imports
import RolePermissionModel from '../../../../models/mongodb/RolePermission.model';
// MFA settings
const MFA_APP_NAME = process.env.MFA_APP_NAME || 'SAP Corp Astro';

// Password reset settings
const PASSWORD_RESET_EXPIRES = 90; // 1 1/2 minutes in seconds
const OTP_LENGTH = 4;

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
  rolePermissionIds: string[];
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

    // Find the default 'user' role
    const userRole = await RolePermissionModel.findOne({ 
      role: 'user',
      application: '*' 
    });

    if (!userRole) {
      throw new Error('Default user role not found. Please contact support.');
    }

    // Create user with the 'user' role
    const user = new User({
      ...userData,
      password: userData.password, // The pre-save hook will hash this
      isActive: true,
      roles: [{ role: userRole._id }]
    });
    
    // Save user with proper password handling
    await user.save();
    
    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(user.email, user.firstName);
      logger.info(`Welcome email sent to ${user.email}`);
    } catch (emailError) {
      logger.error('Failed to send welcome email:', emailError);
      // Don't throw error here as it shouldn't prevent registration
    }

    // Return user without sensitive data
    const userObject = user.toObject();
    delete userObject.password;
    
    // Log successful registration
    logger.info(`New user registered: ${user.email} with role '${userRole.role}'`);
    
    return userObject;
  } catch (error) {
    logger.error('Registration error:', error);
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
      console.log('Login failed: User not found for email:', email);
      throw new Error('Invalid email or password');
    }
    
    // Check if user is active
    if (!user.isActive) {
      console.log('Login failed: User account is disabled:', email);
      throw new Error('Account is disabled. Please contact support.');
    }
    
    // Log the stored password hash (for debugging only - remove in production)
    console.log('Stored password hash:', user.password);
    
    // Verify password
    const isMatch = await user.comparePassword(password);
    console.log('Password comparison result:', isMatch);
    
    if (!isMatch) {
      console.log('Login failed: Password mismatch for email:', email);
      throw new Error('Invalid email or password');
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Convert to IUser and generate tokens
    const userData = asIUser(user);
    const tokens = generateTokens(userData);
    
    // Return user data without password
    const userObject = user.toObject();
    delete userObject.password;
    
    return {
      user: userObject,
      ...tokens
    };
  } catch (error) {
    console.error('Login error:', error);
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
      rolePermissionIds: user.roles.map(roleId => roleId.toString())
    };
    
    // Generate access token
    const accessToken = jwt.sign(
      payload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
    );
    
    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user._id.toString() },
      JWT_REFRESH_SECRET as Secret,
      { expiresIn: JWT_REFRESH_EXPIRES_IN } as SignOptions
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
    
    // Convert to IUser
    const userData = asIUser(user);
    
    // Generate new access token
    const payload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      rolePermissionIds: user.roles.map(roleId => roleId.toString())
    };
    
    const accessToken = jwt.sign(
      payload,
      JWT_SECRET as Secret,
      { expiresIn: JWT_EXPIRES_IN } as SignOptions
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
    
    // Convert to IUser
    return asIUser(user);
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
    
    // Use type assertion to fix TypeScript error
    return asIUser(userObject);
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
      // Reset login attempts tracking
      if (user.loginAttempts) {
        user.loginAttempts = user.loginAttempts.filter(attempt => attempt.successful);
      }
      user.accountLocked = false;
      user.accountLockedUntil = undefined;
      
      // Update last login
      user.lastLogin = new Date();
      
      // Track device info if available
      // This would typically come from the request headers
      
      await user.save();
      return;
    }
    
    // Increment failed attempts
    // Use loginAttempts array to track failed attempts
    if (!user.loginAttempts) {
      user.loginAttempts = [];
    }
    
    // Add a failed login attempt
    user.loginAttempts.push({
      timestamp: new Date(),
      ipAddress: ip,
      userAgent: 'Unknown',
      successful: false
    });
    
    // Count failed attempts
    const failedAttempts = user.loginAttempts.filter(attempt => !attempt.successful).length;
    
    // Lock account if too many failed attempts
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      user.accountLocked = true;
      user.accountLockedUntil = new Date(Date.now() + ACCOUNT_LOCK_TIME * 1000);
      
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
export const generatePasswordResetOTP = async (email: string): Promise<{ expiresIn: number }> => {
  try {
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      throw new Error('User not exist');
    }
    
    // Generate OTP (4 digits)
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Store OTP in Redis with expiration
    await otpCache.set(
      `password_reset:${user._id}`,
      otp,
      PASSWORD_RESET_EXPIRES
    );
    
    // Send email with OTP
    await emailService.sendPasswordResetOTP(user.email, otp);

    // Return the expiration time in seconds
    return { expiresIn: PASSWORD_RESET_EXPIRES };
  } catch (error) {
    logger.error('Error in generatePasswordResetOTP:', error);
    throw error;
  }
};

/**
 * Verify password reset OTP
 * @param email - User email
 * @param otp - OTP received by user
 * @returns Whether OTP is valid
 */
export const verifyPasswordResetOTP = async (email: string, otp: string): Promise<boolean> => {
  try {
    // Validate input
    if (!email || !otp) {
      throw new Error('Email and OTP are required');
    }

    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      logger.warn(`OTP verification failed: User not found for email: ${email}`);
      throw new Error('User not found');
    }
    
    // Get stored OTP
    const storedOTP = await otpCache.get(`password_reset:${user._id}`);

    // Log the OTPs for debugging (remove in production)
    logger.debug(`OTP Verification - Stored: "${storedOTP}" (${typeof storedOTP}), Received: "${otp}" (${typeof otp})`);

    if (!storedOTP) {
      logger.warn(`No OTP found for user: ${email}`);
      throw new Error('OTP expired or invalid');
    }

    // Trim and compare OTPs
    const cleanStoredOTP = storedOTP.toString().trim();
    const cleanOTP = otp.toString().trim();
    
    if (cleanStoredOTP !== cleanOTP) {
      logger.warn(`OTP mismatch for user ${email}. Expected: "${cleanStoredOTP}", Got: "${cleanOTP}"`);
      throw new Error('Invalid OTP');
    }
    
    // Clean up the OTP from Redis
    await otpCache.del(`password_reset:${user._id}`);
    logger.info(`OTP verified successfully for user: ${email}`);
    
    return true;
  } catch (error) {
    logger.error('Error in OTP verification:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      email
    });
    throw error;
  }
};

/**
 * Reset password after OTP verification
 * @param email - User email
 * @param newPassword - New password
 */
export const resetPasswordWithOTP = async (email: string, newPassword: string): Promise<void> => {
  try {
    // Validate input
    if (!email || !newPassword) {
      throw new Error('Email and new password are required');
    }

    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      throw new Error('User not found');
    }

    // Clear existing password reset data
    user.passwordReset = null;
    
    // Set the new password and timestamps
    user.password = newPassword;
    user.passwordLastChanged = new Date();
    user.passwordChangedAt = new Date();
    user.isActive = true;
    
    // Clear password reset data
    user.passwordReset = null;
    
    // Clear login attempts
    user.loginAttempts = [];
    
    // Save the user with the new password
    await user.save();

    // The passwordChangedAt field will be updated by the pre-save hook
    // which will automatically invalidate existing tokens
  } catch (error: any) {
    console.error('Password reset error:', error);
    // Add more specific error handling
    if (error.name === 'ValidationError') {
      throw new Error('Invalid data provided');
    }
    throw error;
  }
};


