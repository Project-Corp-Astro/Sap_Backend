import express from 'express';
import passport from 'passport';
import { body } from 'express-validator';
import * as authController from '../controllers/auth.controller';
import authMiddleware from '../middlewares/auth.middleware';
import { validateMFA } from '../middlewares/mfa.middleware';

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required')
], authController.register);

/**
 * @route POST /api/auth/login
 * @desc Authenticate user and get tokens
 * @access Public
 */
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], authController.login);

/**
 * @route POST /api/auth/refresh-token
 * @desc Refresh access token
 * @access Public
 */
router.post('/refresh-token', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required')
], authController.refreshToken);

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
router.post('/mfa/verify', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('token').isLength({ min: 6, max: 6 }).withMessage('Token must be 6 digits')
], authController.verifyMFA);

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
router.post('/password-reset/request', [
  body('email').isEmail().withMessage('Please provide a valid email')
], authController.requestPasswordReset);

/**
 * @route POST /api/auth/password-reset
 * @desc Reset password with token
 * @access Public
 */
router.post('/password-reset', [
  body('token').notEmpty().withMessage('Token is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], authController.resetPassword);

export default router;
