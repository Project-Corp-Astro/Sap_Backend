import express, { Request, Response, NextFunction, Router } from 'express';
import { check } from 'express-validator';
import * as userController from '../controllers/user.controller';
import { authMiddleware, roleAuthorization } from '../middlewares/auth.middleware';
import { UserRole } from '../interfaces/user.interfaces';

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
 * @access Private (Admin, Content Manager)
 */
router.get('/', 
  asRequestHandler(authMiddleware), 
  asRequestHandler(roleAuthorization([UserRole.ADMIN, UserRole.CONTENT_MANAGER])), 
  wrapController(userController.getUsers)
);

/**
 * @route POST /api/users
 * @desc Create a new user
 * @access Private (Admin only)
 */
router.post('/', 
  asRequestHandler(authMiddleware), 
  asRequestHandler(roleAuthorization([UserRole.ADMIN])), 
  wrapController(userController.createUser)
);

/**
 * @route GET /api/users/:userId
 * @desc Get user by ID
 * @access Private (Admin, Content Manager, or Self)
 */
router.get('/:userId', asRequestHandler(authMiddleware), wrapController(userController.getUserById));

/**
 * @route PUT /api/users/:userId
 * @desc Update user
 * @access Private (Admin or Self)
 */
router.put('/:userId', asRequestHandler(authMiddleware), wrapController(userController.updateUser));

/**
 * @route DELETE /api/users/:userId
 * @desc Delete user
 * @access Private (Admin only)
 */
router.delete('/:userId', 
  asRequestHandler(authMiddleware), 
  asRequestHandler(roleAuthorization([UserRole.ADMIN])), 
  wrapController(userController.deleteUser)
);

/**
 * @route PATCH /api/users/:userId/status
 * @desc Update user active status
 * @access Private (Admin only)
 */
router.patch('/:userId/status', 
  asRequestHandler(authMiddleware), 
  asRequestHandler(roleAuthorization([UserRole.ADMIN])), 
  wrapController(userController.updateUserStatus)
);

/**
 * @route PUT /api/users/profile
 * @desc Update authenticated user's profile
 * @access Private
 */
router.put('/profile', 
  asRequestHandler(authMiddleware),
  [
    check('firstName', 'First name is required').optional().notEmpty(),
    check('lastName', 'Last name is required').optional().notEmpty(),
    check('phoneNumber', 'Phone number must be valid').optional().isMobilePhone('any')
  ],
  wrapController(userController.updateProfile)
);

/**
 * @route PUT /api/users/password
 * @desc Change user password
 * @access Private
 */
router.put('/password', 
  asRequestHandler(authMiddleware),
  [
    check('currentPassword', 'Current password is required').notEmpty(),
    check('newPassword', 'Password must be at least 8 characters').isLength({ min: 8 })
  ],
  wrapController(userController.changePassword)
);

/**
 * @route PUT /api/users/security-preferences
 * @desc Update user security preferences
 * @access Private
 */
router.put('/security-preferences', 
  asRequestHandler(authMiddleware),
  wrapController(userController.updateSecurityPreferences)
);

/**
 * @route GET /api/users/:userId/activity
 * @desc Get user activity log
 * @access Private (Self or Admin)
 */
router.get('/:userId/activity', 
  asRequestHandler(authMiddleware),
  wrapController(userController.getUserActivity)
);

/**
 * @route GET /api/users/devices
 * @desc Get user devices
 * @access Private
 */
router.get('/devices', 
  asRequestHandler(authMiddleware),
  wrapController(userController.getUserDevices)
);

/**
 * @route DELETE /api/users/devices/:deviceId
 * @desc Remove user device
 * @access Private
 */
router.delete('/devices/:deviceId', 
  asRequestHandler(authMiddleware),
  wrapController(userController.removeUserDevice)
);

export default router;
