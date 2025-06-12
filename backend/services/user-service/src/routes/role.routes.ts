import { Router } from 'express';
import roleController from '../controllers/role.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

// Get all roles
router.get(
  '/roles',
  authenticate,
  requirePermission('system.view'),
  roleController.getAllRoles
);

// Get role by ID
router.get(
  '/roles/:id',
  authenticate,
  requirePermission('system.view'),
  roleController.getRoleById
);

// Create a new role (admin only)
router.post(
  '/roles',
  authenticate,
  requirePermission('system.manage_roles'),
  roleController.createRole
);

// Update a role (admin only)
router.put(
  '/roles/:id',
  authenticate,
  requirePermission('system.manage_roles'),
  roleController.updateRole
);

// Update role permissions (admin only)
router.put(
  '/roles/:id/permissions',
  authenticate,
  requirePermission('system.manage_roles'),
  roleController.updateRolePermissions
);

// Delete a role (admin only)
router.delete(
  '/roles/:id',
  authenticate,
  requirePermission('system.manage_roles'),
  roleController.deleteRole
);

export default router;
