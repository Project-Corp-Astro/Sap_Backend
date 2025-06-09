import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator/src/validation-result';
import redisClient from '../../../../shared/utils/redis';
import logger from '../../../../shared/utils/logger';
import * as authService from '../services/auth.service';
import { IUser } from '../../../../shared/interfaces/user.interface';
// Import type fixes and assertion helpers
import { asIUser } from '../utils/type-assertions';
// Import type fixes
import '../types/type-fixes';
// Import auth types
import '../types/auth-types';
// Import user type converter
import { convertToIUser } from '../utils/user-type-converter';
// Import UserRole from shared types instead of local interfaces
import { UserRole } from '@corp-astro/shared-types';
import {
  ExtendedUser,
  UserDocument,
  RegistrationRequest,
  AuthResponse,
  JwtPayload
} from '../interfaces/shared-types';

// Define a custom interface that doesn't extend Request to avoid type conflicts
// Use a consistent AuthenticatedRequest interface that works with Express routes
export interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user?: UserDocument & { username: string };
}

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    return;
  }
  try {
    const { username, email, password, firstName, lastName, role } = req.body;
    if (!username || !email || !password || !firstName || !lastName) {
      res.status(400).json({ success: false, message: 'All fields are required' });
      return;
    }
    const userData: RegistrationRequest = { username, email, password, firstName, lastName };
    // Use a proper type assertion with unknown first to avoid TypeScript error
    const authReq = req as unknown as AuthenticatedRequest;
    if (role && authReq.user?.role === UserRole.ADMIN) {
      (userData as any).role = role;
    }
    const user = await authService.register(userData);
    res.status(201).json({ success: true, message: 'User registered successfully', data: user });
  } catch (error: any) {
    if (error.message.includes('already') || error.code === 11000) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

export const oauthLogin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Authentication failed' });
      return;
    }
    const authData = await authService.generateTokens(user as any);
    await redisClient.set(`refresh_token:${user._id.toString()}`, authData.refreshToken, 60 * 60 * 24 * 7);
    res.status(200).json({ success: true, message: 'OAuth login successful', data: { user, ...authData } });
  } catch (error) {
    logger.error('OAuth login error:', error);
    next(error);
  }
};

export const setupMFA = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const mfaData = await authService.setupMFA(req.user._id);
    res.status(200).json({ success: true, message: 'MFA setup initiated', data: mfaData });
  } catch (error) {
    logger.error('MFA setup error:', error);
    next(error);
  }
};

export const verifyMFA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) {
      res.status(400).json({ success: false, message: 'User ID and token are required' });
      return;
    }
    const isValid = await authService.verifyMFA(userId, token);
    if (!isValid) {
      res.status(401).json({ success: false, message: 'Invalid MFA token' });
      return;
    }
    if (req.query.setup === 'true') await authService.enableMFA(userId);
    if (req.query.login === 'true') {
      const user = await authService.getUserById(userId);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      const authData = await authService.generateTokens(user);
      await redisClient.set(`mfa_session:${userId}`, JSON.stringify({ userId, token }), 60 * 10);
      res.status(200).json({ success: true, message: 'Verification code sent', requiresMfa: true, mfaToken: token });
      return;
    }
    res.status(200).json({ success: true, message: 'MFA verification successful' });
  } catch (error) {
    logger.error('MFA verification error:', error);
    res.status(500).json({ success: false, message: 'Error verifying MFA token' });
  }
};

export const sendVerificationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await redisClient.set(`verification:${userId}`, code, 60 * 10);
    const token = await authService.generateTokens({ _id: userId } as any);
    if (req.query.login === 'true') {
      const user = await authService.getUserById(userId);
      if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      const authData = await authService.generateTokens(user);
      await redisClient.set(`mfa_session:${userId}`, JSON.stringify({ userId, token }), 60 * 10);
      res.status(200).json({ success: true, message: 'Verification code sent', requiresMfa: true, mfaToken: token });
      return;
    }
    res.status(200).json({ success: true, message: 'Verification code sent', requiresMfa: true, mfaToken: token });
  } catch (error) {
    logger.error('Verification code error:', error);
    res.status(500).json({ success: false, message: 'Error sending verification code' });
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }
    const authData = await authService.login(email, password);
    if (authData.user.mfaEnabled) {
      res.status(200).json({ success: true, message: 'MFA verification required', data: { requireMFA: true, userId: authData.user._id } });
      return;
    }
    await redisClient.set(`refresh_token:${authData.user._id.toString()}`, authData.refreshToken, 60 * 60 * 24 * 7);
    await authService.trackLoginAttempt(authData.user._id.toString(), req.ip || 'unknown', true);
    res.status(200).json({ success: true, message: 'Login successful', data: authData });
  } catch (error: any) {
    if (error.userId) {
      await authService.trackLoginAttempt(error.userId, req.ip || 'unknown', false);
    }
    if (error.message.includes('Invalid') || error.message.includes('disabled') || error.message.includes('locked')) {
      res.status(401).json({ success: false, message: error.message });
      return;
    }
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, message: 'Refresh token is required' });
      return;
    }
    const decoded = await authService.decodeRefreshToken(refreshToken);
    const storedToken = await redisClient.get(`refresh_token:${decoded.userId}`);
    if (storedToken !== refreshToken) {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
      return;
    }
    const tokens = await authService.refreshToken(refreshToken);
    res.status(200).json({ success: true, message: 'Token refreshed successfully', data: tokens });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

export const getProfile = (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  res.status(200).json({ success: true, message: 'User profile retrieved successfully', data: req.user });
};

export const logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    await redisClient.del(`refresh_token:${req.user._id}`);
    res.status(200).json({ success: true, message: 'Logout successful' });
  } catch {
    res.status(500).json({ success: false, message: 'Error during logout' });
  }
};

export const generateRecoveryCodes = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const recoveryCodes = await authService.generateRecoveryCodes(req.user._id);
    res.status(200).json({ success: true, message: 'Recovery codes generated successfully', data: { recoveryCodes } });
  } catch (error) {
    next(error);
  }
};

export const requestPasswordResetOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    try {
      const { expiresIn } = await authService.generatePasswordResetOTP(email);
      res.status(200).json({ 
        success: true, 
        message: 'OTP has been sent to your email',
        data: {
          expiresIn // This will be the number of seconds until OTP expires
        }
      });
    } catch (error: any) {
      if (error.message === 'User not exist') {
        res.status(404).json({ 
          success: false, 
          message: 'User does not exist' 
        });
      } else {
        throw error; // Re-throw other errors to be caught by the outer catch
      }
    }
  } catch (error) {
    logger.error('Password reset OTP request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'An error occurred while processing your request' 
    });
  }
};

export const verifyPasswordResetOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      res.status(400).json({ success: false, message: 'Email and OTP are required' });
      return;
    }
    const isValid = await authService.verifyPasswordResetOTP(email, otp);
    res.status(200).json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    logger.error('Password reset OTP verification error:', error);
    res.status(400).json({ success: false, message: 'Invalid OTP' });
  }
};

export const resetPasswordWithOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      res.status(400).json({ success: false, message: 'Email and new password are required' });
      return;
    }
    await authService.resetPasswordWithOTP(email, newPassword);
    res.status(200).json({ success: true, message: 'Password has been reset successfully' });
  } catch (error: any) {
    if (error.message.includes('expired') || error.message.includes('invalid')) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Error resetting password' });
  }
};

// export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
//     return;
//   }
//   try {
//     const { email } = req.body;
//     if (!email) {
//       res.status(400).json({ success: false, message: 'Email is required' });
//       return;
//     }
//     await authService.requestPasswordReset(email);
//     res.status(200).json({ success: true, message: 'Password reset link sent if email exists' });
//   } catch (error) {
//     logger.error('Password reset request error:', error);
//     res.status(200).json({ success: true, message: 'Password reset link sent if email exists' });
//   }
// };
