import express from 'express';
import passport from 'passport';
// Custom validation middleware instead of express-validator
import { validateRequest, validators } from '../middlewares/validation.middleware';
import * as authController from '../controllers/auth.controller';
import authMiddleware from '../middlewares/auth.middleware';
import { validateMFA } from '../middlewares/mfa.middleware';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', validateRequest([
  {
    field: 'email',
    validations: [{
      validator: validators.isEmail,
      message: 'Please provide a valid email'
    }]
  },
  {
    field: 'password',
    validations: [{
      validator: validators.isLength(8),
      message: 'Password must be at least 8 characters'
    }]
  },
  {
    field: 'username',
    validations: [{
      validator: validators.isLength(3),
      message: 'Username must be at least 3 characters'
    }]
  },
  {
    field: 'firstName',
    validations: [{
      validator: validators.notEmpty,
      message: 'First name is required'
    }]
  },
  {
    field: 'lastName',
    validations: [{
      validator: validators.notEmpty,
      message: 'Last name is required'
    }]
  }
]), authController.register);

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and get tokens
 * @access Public
 */
router.post('/login', validateRequest([
  {
    field: 'email',
    validations: [{
      validator: validators.isEmail,
      message: 'Please provide a valid email'
    }]
  },
  {
    field: 'password',
    validations: [{
      validator: validators.notEmpty,
      message: 'Password is required'
    }]
  }
]), authController.login);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh-token', validateRequest([
  {
    field: 'refreshToken',
    validations: [{
      validator: validators.notEmpty,
      message: 'Refresh token is required'
    }]
  }
]), authController.refreshToken);

/**
 * @route GET /api/auth/profile
 * @desc Get authenticated user profile
 * @access Private
 */
router.get('/profile', authMiddleware, authController.getProfile);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * @route GET /api/auth/google
 * @desc Authenticate with Google OAuth
 * @access Public
 */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

/**
 * @route GET /api/auth/google/callback
 * @desc Google OAuth callback
 * @access Public
 */
router.get('/google/callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  authController.oauthLogin
);

/**
 * @route GET /api/auth/github
 * @desc Authenticate with GitHub OAuth
 * @access Public
 */
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

/**
 * @route GET /api/auth/github/callback
 * @desc GitHub OAuth callback
 * @access Public
 */
router.get('/github/callback', 
  passport.authenticate('github', { session: false, failureRedirect: '/login' }),
  authController.oauthLogin
);

/**
 * @route POST /api/auth/mfa/setup
 * @desc Setup MFA for user
 * @access Private
 */
router.post('/mfa/setup', authMiddleware, authController.setupMFA);

/**
 * @route POST /api/auth/mfa/verify
 * @desc Verify MFA token
 * @access Public
 */
router.post('/mfa/verify', validateRequest([
  {
    field: 'userId',
    validations: [{
      validator: validators.notEmpty,
      message: 'User ID is required'
    }]
  },
  {
    field: 'token',
    validations: [{
      validator: (value) => validators.isLength(6, 6)(value),
      message: 'Token must be 6 digits'
    }]
  }
]), authController.verifyMFA);

/**
 * @route POST /api/auth/mfa/recovery-codes
 * @desc Generate recovery codes for MFA
 * @access Private
 */
router.post('/mfa/recovery-codes', authMiddleware, validateMFA, authController.generateRecoveryCodes);

/**
 * @route POST /api/auth/password-reset/request
 * @desc Request password reset
 * @access Public
 */
router.post('/password-reset/request', validateRequest([
  {
    field: 'email',
    validations: [{
      validator: validators.isEmail,
      message: 'Please provide a valid email'
    }]
  }
]), authController.requestPasswordResetOTP);

/**
 * @route POST /api/auth/password-reset/verify-otp
 * @desc Verify password reset OTP
 * @access Public
 */
router.post('/password-reset/verify-otp', validateRequest([
  {
    field: 'email',
    validations: [{
      validator: validators.isEmail,
      message: 'Please provide a valid email'
    }]
  },
  {
    field: 'otp',
    validations: [{
      validator: validators.isLength(4),
      message: 'OTP must be 4 digits'
    }]
  }
]), authController.verifyPasswordResetOTP);

/**
 * @route POST /api/auth/password-reset/change
 * @desc Reset password after OTP verification
 * @access Public
 */
router.post('/password-reset/change', validateRequest([
  {
    field: 'email',
    validations: [{
      validator: validators.isEmail,
      message: 'Please provide a valid email'
    }]
  },
  {
    field: 'newPassword',
    validations: [{
      validator: validators.isLength(8),
      message: 'Password must be at least 8 characters'
    }]
  }
]), authController.resetPasswordWithOTP);

export default router;
