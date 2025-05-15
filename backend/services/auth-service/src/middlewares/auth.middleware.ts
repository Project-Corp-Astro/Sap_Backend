import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import User from '../models/User';

// Define interface for request with user
export interface AuthenticatedRequest extends Request {
  user?: any;
}

/**
 * Authentication middleware to protect routes
 * Validates JWT token and attaches user to request
 */
const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get auth header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.'
      });
      return;
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication token is missing'
      });
      return;
    }
    
    // Verify token
    const decoded = authService.verifyToken(token);
    
    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'User not found or account is disabled'
      });
      return;
    }
    
    // Attach user to request
    (req as AuthenticatedRequest).user = user;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

export default authMiddleware;
