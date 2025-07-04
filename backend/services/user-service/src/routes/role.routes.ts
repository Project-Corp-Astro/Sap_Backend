import { Router } from 'express';
import { RoleController } from '../controllers/role.controller';
import { requirePermission } from '../../../../src/middleware/requirePermission';
import { asyncHandler } from '../../../../src/middleware/validation.middleware';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

router.use(asyncHandler(authMiddleware));

// Create a new role with permissions
router.post(
  '/',
  requirePermission('role:create', { application: 'system' }),
  asyncHandler(RoleController.createRole)
);

// Update role permissions
router.put(
  '/:roleId/permissions',
  requirePermission('role:update', { application: 'system' }),
  asyncHandler(RoleController.updateRolePermissions)
);

// Assign role to user
router.post(
  '/assign',
  requirePermission('user:assign', { application: 'system' }),
  asyncHandler(RoleController.assignRoleToUser)
);

// List all roles (optionally filtered by application)
router.get(
  '/',
  requirePermission('role:read', { application: 'system' }),
  asyncHandler(RoleController.listRoles)
);

// Get role details
router.get(
  '/:roleId',
  requirePermission('role:read', { application: 'system' }),
  asyncHandler(RoleController.getRole)
);

// Delete a role
router.delete(
  '/:roleId',
  requirePermission('role:delete', { application: 'system' }),
  asyncHandler(RoleController.deleteRole)
);

export default router;
