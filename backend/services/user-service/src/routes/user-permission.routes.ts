import { Router } from 'express';
import userPermissionController from '../controllers/user-permission.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

// Get all permissions for a user
router.get(
  '/users/:userId/permissions',
  authenticate,
  requirePermission('users.view'),
  userPermissionController.getUserPermissions
);

// Assign roles to a user
router.put(
  '/users/:userId/roles',
  authenticate,
  requirePermission('users.edit'),
  userPermissionController.assignRolesToUser
);

// Assign direct permissions to a user
router.put(
  '/users/:userId/permissions',
  authenticate,
  requirePermission('users.edit'),
  userPermissionController.assignPermissionsToUser
);

// Assign system role to a user
router.put(
  '/users/:userId/system-role',
  authenticate,
  requirePermission('users.edit'),
  userPermissionController.assignSystemRoleToUser
);

// Migrate legacy permissions for a user
router.post(
  '/users/:userId/migrate-permissions',
  authenticate,
  requirePermission('system.manage_roles'),
  userPermissionController.migrateLegacyPermissions
);

export default router;
