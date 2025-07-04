import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import logger from '../utils/logger';
import { AuthUser } from '../../../../shared/types/auth-user'; // adjust path as needed

// Set the service name for logging
const SERVICE_NAME = 'subscription-management-service';

// JWT secret key - should be stored in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';


// Define JWT payload interface
interface JwtPayload {
  userId: string;
  email: string;
  rolePermissionIds?: string[];
  iat?: number;
  exp?: number;
}

// Extend Express Request type to include our user property
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Define the auth middleware
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Get auth header
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn(`[${SERVICE_NAME}] Missing or invalid auth header`);
    res.status(401).json({
      success: false,
      message: 'Authentication required. Please provide a valid token.',
    });
    return;
  }

  // Extract token
  const token = authHeader.split(' ')[1];

  if (!token) {
    logger.warn(`[${SERVICE_NAME}] Missing token`);
    res.status(401).json({
      success: false,
      message: 'Authentication token is missing',
    });
    return;
  }

  // Verify token
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Attach user info to request
    req.user = {
      _id: payload.userId,
      email: payload.email,
      rolePermissionIds: payload.rolePermissionIds || [],
    };

    // Log the decoded token for debugging
    logger.debug(`[${SERVICE_NAME}] Decoded JWT: ${JSON.stringify(payload, null, 2)}`);
    logger.debug(`[${SERVICE_NAME}] Attached user to request: ${JSON.stringify(req.user)}`);

    next();
  } catch (err) {
    logger.error(`[${SERVICE_NAME}] Token verification error: ${(err as Error).message}`);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};