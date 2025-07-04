import express, { Request, Response, NextFunction, Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requirePermission } from '../../../../src/middleware/requirePermission';

// Export controllers for testing purposes
export { userController };

// Type assertion for middleware to fix TypeScript compatibility issues
type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<Response | void> | Response | void;
const asRequestHandler = (handler: RequestHandler) => handler as express.RequestHandler;

// Wrapper function for controller functions to fix TypeScript compatibility issues
export const wrapController = (controller: any): express.RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    // @ts-ignore - Suppressing TypeScript errors for controller compatibility
    return controller(req, res, next);
  };
};

// This is a temporary solution until we can properly fix the middleware type compatibility

const router: Router = express.Router();







/**
 * @route GET /api/users
 * @desc Get all users with pagination and filtering
 * @access Private (Admin)
 */
router.get('/', 
  asRequestHandler(authMiddleware), 
  wrapController(userController.getUsers)
);





/**
 * @route GET /api/users/:userId
 * @desc Get user by ID
 * @access Private (Admin or Self)
 */
router.get('/:userId', 
 
  asRequestHandler(authMiddleware), 
   requirePermission('user:read', { application: 'system' }),
  wrapController(userController.getUserById)
);

/**
 * @route PUT /api/users/:userId
 * @desc Update user
 * @access Private (Admin or Self)
 */
router.put('/:userId', 
  asRequestHandler(authMiddleware), 
  requirePermission('user:update', { application: 'system' }),
  wrapController(userController.updateUser)
);

/**
 * @route DELETE /api/users/:userId
 * @desc Delete user
 * @access Private (Admin only)
 */
router.delete('/:userId', 
  asRequestHandler(authMiddleware), 
  requirePermission('user:delete', { application: 'system' }),
  wrapController(userController.deleteUser)
);

/**
 * @route PATCH /api/users/:userId/status
 * @desc Update user active status
 * @access Private (Admin only)
 */
router.patch('/:userId/status', 
  asRequestHandler(authMiddleware), 
  requirePermission('user:update', { application: 'system' }),
  wrapController(userController.updateUserStatus)
);
/**
 * @route PUT /api/users/profile
 * @desc Update authenticated user's profile
 * @access Private
 */
router.put('/profile', 
  asRequestHandler(authMiddleware),
  requirePermission('user:update', { application: 'system' }),
  wrapController(userController.updateProfile)
);

/**
 * @route PUT /api/users/password
 * @desc Change user password
 * @access Private
 */
router.put('/password', 
  asRequestHandler(authMiddleware),
  requirePermission('user:update', { application: 'system' }),
  wrapController(userController.changePassword)
);

/**
 * @route PUT /api/users/security-preferences
 * @desc Update user security preferences
 * @access Private
 */
router.put('/security-preferences', 
  asRequestHandler(authMiddleware),
  requirePermission('user:update', { application: 'system' }),
  wrapController(userController.updateSecurityPreferences)
);

/**
 * @route GET /api/users/:userId/activity
 * @desc Get user activity log
 * @access Private (Self or Admin)
 */
router.get('/:userId/activity', 
  asRequestHandler(authMiddleware),
  requirePermission('user:read', { application: 'system' }),
  wrapController(userController.getUserActivity)
);

/**
 * @route GET /api/users/devices
 * @desc Get user devices
 * @access Private
 */
router.get('/devices', 
  asRequestHandler(authMiddleware),
  requirePermission('user:read', { application: 'system' }),
  wrapController(userController.getUserDevices)
);

/**
 * @route DELETE /api/users/devices/:deviceId
 * @desc Remove user device
 * @access Private
 */
router.delete('/devices/:deviceId', 
  asRequestHandler(authMiddleware),
  requirePermission('user:delete', { application: 'system' }),
  wrapController(userController.removeUserDevice)
);

export default router;