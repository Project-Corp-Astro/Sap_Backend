/**
 * Security middleware for SAP backend services
 * This module provides centralized security features across all microservices
 */

import { Request, Response, NextFunction } from 'express';
import { Application } from 'express-serve-static-core';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
// @ts-ignore - no type definitions available
import xss from 'xss-clean';
// @ts-ignore - no type definitions available
import hpp from 'hpp';
import cors from 'cors';
import config from '../config';
import { createServiceLogger } from '../utils/logger';
import { createAuthenticationError, createAuthorizationError } from '../utils/errorHandler';

// Create a dedicated logger for security operations
const securityLogger = createServiceLogger('security');

// Define interfaces
interface UserPayload {
  id: string;
  email: string;
  roles: string[];
  [key: string]: any;
}

interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: any;
  statusCode?: number;
  [key: string]: any;
}

interface CorsOptions {
  origin?: string | string[] | boolean;
  methods?: string | string[];
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
  [key: string]: any;
}

interface SecurityOptions {
  helmet?: Record<string, any>;
  cors?: CorsOptions;
  hpp?: Record<string, any>;
  rateLimit?: RateLimitOptions | false;
}

/**
 * JWT authentication middleware
 * Verifies JWT token and attaches user data to request
 * @returns Express middleware
 */
const authMiddleware = () => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw createAuthenticationError('No authentication token provided');
      }
      
      const token = authHeader.split(' ')[1];
      
      // Verify token
      const decoded = jwt.verify(token, config.get('jwt.secret')) as UserPayload;
      
      // Attach user data to request
      req.user = decoded;
      
      next();
    } catch (err: any) {
      if (err.name === 'JsonWebTokenError') {
        next(createAuthenticationError('Invalid authentication token'));
      } else if (err.name === 'TokenExpiredError') {
        next(createAuthenticationError('Authentication token expired'));
      } else {
        next(err);
      }
    }
  };
};

/**
 * Role-based authorization middleware
 * Checks if user has required roles
 * @param roles - Required roles
 * @returns Express middleware
 */
const roleAuthorization = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createAuthenticationError('User not authenticated'));
    }
    
    const userRoles = req.user.roles || [];
    
    // Check if user has any of the required roles
    const hasRole = roles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return next(createAuthorizationError('Insufficient permissions'));
    }
    
    next();
  };
};

/**
 * Rate limiting middleware
 * Limits number of requests from same IP
 * @param options - Rate limiting options
 * @returns Express middleware
 */
const rateLimiter = (options: RateLimitOptions = {}): RateLimitRequestHandler => {
  const defaultOptions = config.get('rateLimit') as RateLimitOptions;
  
  return rateLimit({
    windowMs: options.windowMs || defaultOptions.windowMs,
    max: options.max || defaultOptions.max,
    message: {
      success: false,
      message: 'Too many requests, please try again later',
    },
    handler: (req: Request, res: Response, next: NextFunction, options: any) => {
      securityLogger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
      });
      
      res.status(options.statusCode).json(options.message);
    },
    ...options,
  });
};

/**
 * CORS middleware
 * Handles Cross-Origin Resource Sharing
 * @param options - CORS options
 * @returns Express middleware
 */
const corsMiddleware = (options: CorsOptions = {}) => {
  const defaultOptions = config.get('cors') as CorsOptions;
  
  return cors({
    origin: options.origin || defaultOptions.origin,
    methods: options.methods || defaultOptions.methods,
    preflightContinue: options.preflightContinue || defaultOptions.preflightContinue,
    optionsSuccessStatus: options.optionsSuccessStatus || defaultOptions.optionsSuccessStatus,
    ...options,
  });
};

/**
 * Helmet middleware
 * Sets various HTTP headers for security
 * @param options - Helmet options
 * @returns Express middleware
 */
const helmetMiddleware = (options: Record<string, any> = {}) => {
  return helmet(options);
};

/**
 * XSS protection middleware
 * Sanitizes user input to prevent XSS attacks
 * @returns Express middleware
 */
const xssProtection = () => {
  return xss();
};

/**
 * HTTP Parameter Pollution protection middleware
 * Prevents parameter pollution attacks
 * @param options - HPP options
 * @returns Express middleware
 */
const hppProtection = (options: Record<string, any> = {}) => {
  return hpp(options);
};

/**
 * Request logger middleware
 * Logs all incoming requests
 * @returns Express middleware
 */
const requestLogger = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    securityLogger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      query: req.query,
      params: req.params,
    });
    
    next();
  };
};

/**
 * Apply all security middleware to an Express app
 * @param app - Express app
 * @param options - Security options
 */
const applySecurityMiddleware = (app: any, options: SecurityOptions = {}) => {
  // Apply helmet middleware
  app.use(helmetMiddleware(options.helmet));
  
  // Apply CORS middleware
  app.use(corsMiddleware(options.cors));
  
  // Apply XSS protection middleware
  app.use(xssProtection());
  
  // Apply HPP protection middleware
  app.use(hppProtection(options.hpp));
  
  // Apply request logger middleware
  app.use(requestLogger());
  
  // Apply rate limiter middleware to all routes
  if (options.rateLimit !== false) {
    app.use(rateLimiter(options.rateLimit));
  }
  
  securityLogger.info('Security middleware applied');
};

export {
  authMiddleware,
  roleAuthorization,
  rateLimiter,
  corsMiddleware,
  helmetMiddleware,
  xssProtection,
  hppProtection,
  requestLogger,
  applySecurityMiddleware,
  UserPayload,
  AuthenticatedRequest,
  RateLimitOptions,
  CorsOptions,
  SecurityOptions
};
