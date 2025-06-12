import { Router } from 'express';
import permissionController from '../controllers/permission.controller';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = Router();

// Get all permissions
router.get(
  '/permissions',
  authenticate,
  requirePermission('system.view'),
  permissionController.getAllPermissions
);

// Get permissions by resource
router.get(
  '/permissions/resource/:resource',
  authenticate,
  requirePermission('system.view'),
  permissionController.getPermissionsByResource
);

// Create a new permission (admin only)
router.post(
  '/permissions',
  authenticate,
  requirePermission('system.manage_roles'),
  permissionController.createPermission
);

// Update a permission (admin only)
router.put(
  '/permissions/:id',
  authenticate,
  requirePermission('system.manage_roles'),
  permissionController.updatePermission
);

// Delete a permission (admin only)
router.delete(
  '/permissions/:id',
  authenticate,
  requirePermission('system.manage_roles'),
  permissionController.deletePermission
);

export default router;
