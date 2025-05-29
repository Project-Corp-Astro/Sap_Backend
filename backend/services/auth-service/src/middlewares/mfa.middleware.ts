/**
 * MFA middleware
 */
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import logger from '../../../../shared/utils/logger';
import { AuthenticatedRequest } from '../controllers/auth.controller';

// Interface for session with MFA verification
interface MFASession extends Request {
  session?: {
    mfaVerifiedAt?: number;
  };
}

/**
 * Validate that MFA is enabled for the user
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export const validateMFA = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // User should already be authenticated and attached to req by auth middleware
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.user || !authReq.user._id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }
    
    const userId = authReq.user._id;
    
    // Check if MFA is enabled for this user
    const user = await User.findById(userId);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }
    
    if (!user.mfaEnabled) {
      res.status(403).json({
        success: false,
        message: 'MFA is not enabled for this user'
      });
      return;
    }
    
    // MFA is enabled, proceed
    next();
  } catch (error) {
    logger.error('MFA validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating MFA status'
    });
  }
};

/**
 * Require MFA verification for sensitive operations
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next middleware function
 */
export const requireMFAVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // User should already be authenticated and attached to req by auth middleware
    const authReq = req as AuthenticatedRequest;
    
    if (!authReq.user || !authReq.user._id) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }
    
    const userId = authReq.user._id;
    
    // Check if MFA is enabled for this user
    const user = await User.findById(userId);
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }
    
    // If MFA is not enabled, proceed
    if (!user.mfaEnabled) {
      next();
      return;
    }
    
    // Check if MFA was recently verified (within the last 15 minutes)
    const mfaReq = req as MFASession;
    const mfaVerifiedAt = mfaReq.session?.mfaVerifiedAt;
    const fifteenMinutesAgo = Date.now() - (15 * 60 * 1000);
    
    if (mfaVerifiedAt && mfaVerifiedAt > fifteenMinutesAgo) {
      // MFA was recently verified, proceed
      next();
      return;
    }
    
    // MFA verification required
    res.status(403).json({
      success: false,
      message: 'MFA verification required',
      data: {
        requireMFA: true
      }
    });
  } catch (error) {
    logger.error('MFA verification requirement error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking MFA verification status'
    });
  }
};
