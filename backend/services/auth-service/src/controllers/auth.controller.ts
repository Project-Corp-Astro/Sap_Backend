import { Request, Response, NextFunction } from 'express';
// Import express-validator directly
import { validationResult } from 'express-validator';
// Import Redis client with proper path using the updated tsconfig paths
import redisClient from '@shared/utils/redis';
import logger from '@shared/utils/logger';
import * as authService from '../services/auth.service';
import { UserRole } from '@corp-astro/shared-types';
import { 
  ExtendedUser, 
  UserDocument, 
  RegistrationRequest, 
  AuthResponse, 
  JwtPayload 
} from '../interfaces/shared-types';

// Define interfaces for request with user
interface AuthenticatedRequest extends Request {
  user?: UserDocument;
}

/**
 * Register a new user
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }
  try {
    const { username, email, password, firstName, lastName, role } = req.body;
    
    // Validate required fields
    if (!username || !email || !password || !firstName || !lastName) {
      res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
      return;
    }
    
    // Register user
    const userData: RegistrationRequest = { username, email, password, firstName, lastName };
    
    // Only add role if provided and request is from an admin
    const authReq = req as AuthenticatedRequest;
    if (role && authReq.user && authReq.user.role === UserRole.ADMIN) {
      (userData as any).role = role;
    }
    
    const user = await authService.register(userData);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user
    });
  } catch (error: any) {
    if (error.message.includes('already') || error.code === 11000) {
      res.status(409).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    next(error);
  }
};

/**
 * Login with OAuth2 provider
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export const oauthLogin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // User is already authenticated by passport strategy
    const user = req.user;
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
      return;
    }
    
    // Generate tokens
    const authData = await authService.generateTokens(user);
    
    // Update refresh token in Redis
    await redisClient.set(`refresh_token:${user._id.toString()}`, authData.refreshToken, 60 * 60 * 24 * 7); // 7 days
    
    res.status(200).json({
      success: true,
      message: 'OAuth login successful',
      data: {
        user: user,
        ...authData
      }
    });
  } catch (error) {
    logger.error('OAuth login error:', error);
    next(error);
  }
};

/**
 * Setup MFA for user
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export const setupMFA = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // User must be authenticated
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }
    
    // Generate MFA secret and QR code
    const mfaData = await authService.setupMFA(req.user._id);
    
    res.status(200).json({
      success: true,
      message: 'MFA setup initiated',
      data: mfaData
    });
  } catch (error) {
    logger.error('MFA setup error:', error);
    next(error);
  }
};

/**
 * Verify MFA token
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export const verifyMFA = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, token } = req.body;
    
    if (!userId || !token) {
      res.status(400).json({
        success: false,
        message: 'User ID and token are required'
      });
      return res;
    }
    
    // Verify MFA token
    const isValid = await authService.verifyMFA(userId, token);
    
    if (!isValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid MFA token'
      });
      return res;
    }
    
    // If this is during setup, enable MFA for the user
    if (req.query.setup === 'true') {
      await authService.enableMFA(userId);
    }
    
    // If this is during login, generate tokens
    if (req.query.login === 'true') {
      const user = await authService.getUserById(userId as string);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      const authData = await authService.generateTokens(user);
      
      // Store MFA session in Redis
      const sessionData = { userId, token };
      await redisClient.set(`mfa_session:${userId}`, JSON.stringify(sessionData), 60 * 10); // 10 minutes
      
      return res.status(200).json({
        success: true,
        message: 'Verification code sent',
        requiresMfa: true,
        mfaToken: token
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'MFA verification successful'
    });
  } catch (error) {
    logger.error('MFA verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying MFA token'
    });
  }
};

export const sendVerificationCode = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    // Generate a random verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store code in Redis with 10-minute expiration
    await redisClient.set(`verification:${userId}`, code, 60 * 10); // 10 minutes
    
    // Generate a token for MFA verification
    const token = await authService.generateTokens({ _id: userId as string } as any);
    const mfaToken = token.accessToken; // Use access token as MFA token
    
    // If this is during login, generate tokens
    if (req.query.login === 'true') {
      const user = await authService.getUserById(userId as string);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      const authData = await authService.generateTokens(user);
      
      // Store MFA session in Redis
      const sessionData = { userId, token };
      await redisClient.set(`mfa_session:${userId as string}`, JSON.stringify(sessionData), 60 * 10); // 10 minutes
      
      return res.status(200).json({
        success: true,
        message: 'Verification code sent',
        requiresMfa: true,
        mfaToken: token
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Verification code sent',
      requiresMfa: true,
      mfaToken: token
    });
  } catch (error) {
    logger.error('Verification code error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error sending verification code'
    });
  }
};

/**
 * Login user
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
      return;
    }
    
    // Authenticate user
    const authData = await authService.login(email, password);
    
    // Check if MFA is enabled
    if (authData.user.mfaEnabled) {
      res.status(200).json({
        success: true,
        message: 'MFA verification required',
        data: {
          requireMFA: true,
          userId: authData.user._id
        }
      });
      return;
    }
    
    // Store refresh token in Redis
    await redisClient.set(`refresh_token:${authData.user._id.toString()}`, authData.refreshToken, 60 * 60 * 24 * 7); // 7 days
    
    // Track login attempt
    await authService.trackLoginAttempt(authData.user._id.toString(), req.ip || 'unknown', true);
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: authData
    });
  } catch (error: any) {
    // Track failed login attempt
    if (error.userId) {
      await authService.trackLoginAttempt(error.userId, req.ip, false);
    }
    
    if (error.message.includes('Invalid') || error.message.includes('disabled') || error.message.includes('locked')) {
      res.status(401).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    next(error);
  }
};

/**
 * Refresh access token
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }
    
    // Verify refresh token
    const decoded = await authService.decodeRefreshToken(refreshToken);
    const refreshTokenData = await redisClient.get(`refresh_token:${decoded.userId as string}`);
    if (!refreshTokenData) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    // Type assertion to handle potential undefined
    const storedRefreshToken = refreshTokenData;
    if (storedRefreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    // Generate new tokens
    const tokens = await authService.refreshToken(refreshToken);
    
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: tokens
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
};

/**
 * Get authenticated user profile
 * @param req - Express request object
 * @param res - Express response object
 */
export const getProfile = (req: AuthenticatedRequest, res: Response): void => {
  // User is already attached to the request by auth middleware
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }
  
  res.status(200).json({
    success: true,
    message: 'User profile retrieved successfully',
    data: req.user
  });
};

/**
 * Logout user
 * @param req - Express request object
 * @param res - Express response object
 */
export const logout = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return res;
    }
    
    // Remove refresh token from Redis
    await redisClient.del(`refresh_token:${req.user._id}`);
    
    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
};

/**
 * Generate recovery codes for MFA
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export const generateRecoveryCodes = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }
    
    // Generate recovery codes
    const recoveryCodes = await authService.generateRecoveryCodes(req.user._id);
    
    res.status(200).json({
      success: true,
      message: 'Recovery codes generated successfully',
      data: {
        recoveryCodes
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Request password reset
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export const requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    
    if (!email) {
      res.status(400).json({
        success: false,
        message: 'Email is required'
      });
      return;
    }
    
    // Request password reset
    await authService.requestPasswordReset(email);
    
    // Always return success to prevent email enumeration
    res.status(200).json({
      success: true,
      message: 'Password reset link sent if email exists'
    });
  } catch (error) {
    // Log error but don't expose to client
    logger.error('Password reset request error:', error);
    
    // Always return success to prevent email enumeration
    res.status(200).json({
      success: true,
      message: 'Password reset link sent if email exists'
    });
  }
};

/**
 * Reset password with token
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export const resetPassword = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and new password are required'
      });
    }
    
    // Reset password
    await authService.resetPassword(token, newPassword);
    
    return res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error: any) {
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
};

/**
 * Forgot password
 * @param req - Express request object
 * @param res - Express response object
 */
export const forgotPassword = async (req: Request, res: Response): Promise<Response> => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  try {
    const { email } = req.body;
    
    // Validate required fields
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }
    
    // Request password reset
    await authService.requestPasswordReset(email);
    
    // Always return success to prevent email enumeration
    return res.status(200).json({
      success: true,
      message: 'Password reset link sent if email exists'
    });
  } catch (error) {
    // Log error but don't expose to client
    logger.error('Password reset request error:', error);
    
    // Always return success to prevent email enumeration
    return res.status(200).json({
      success: true,
      message: 'Password reset link sent if email exists'
    });
  }
};
