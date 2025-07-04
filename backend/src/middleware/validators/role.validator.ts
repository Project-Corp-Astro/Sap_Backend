import { body, param, query } from 'express-validator';
import { PermissionAction, ResourceType } from '../../../shared/interfaces/permission.interface';

// Extend express-validator types
declare module 'express-validator' {
  interface ValidationChain {
    trim(): this;
    isArray(options?: { min?: number; max?: number }): this;
    isMongoId(): this;
    isString(): this;
    optional(): this;
    custom(validator: (value: any) => boolean | Promise<boolean>): this;
  }
}

// Helper function to create a validation chain with proper typing
const createValidator = (type: 'body' | 'param' | 'query', field: string) => {
  let chain;
  switch (type) {
    case 'body':
      chain = body(field);
      break;
    case 'param':
      chain = param(field);
      break;
    case 'query':
      chain = query(field);
      break;
    default:
      throw new Error(`Invalid validator type: ${type}`);
  }
  
  return chain as any; // Type assertion to bypass TypeScript errors
};

// Helper to validate permission format (resource:action)
const isValidPermission = (value: string) => {
  if (typeof value !== 'string') return false;
  if (value === '*:*') return true; // Allow superadmin permission
  
  const [resource, action] = value.split(':');
  return (
    resource && 
    action && 
    (Object.values(ResourceType).includes(resource as ResourceType) || resource === '*') &&
    (Object.values(PermissionAction).includes(action as PermissionAction) || action === '*')
  );
};

export const createRoleValidator = [
  createValidator('body', 'role')
    .trim()
    .notEmpty()
    .withMessage('Role name is required')
    .isString()
    .withMessage('Role name must be a string')
    .isLength({ min: 2, max: 50 })
    .withMessage('Role name must be between 2 and 50 characters'),
  
  createValidator('body', 'application')
    .trim()
    .notEmpty()
    .withMessage('Application name is required')
    .isString()
    .withMessage('Application name must be a string'),
  
  createValidator('body', 'permissions')
    .isArray({ min: 1 })
    .withMessage('At least one permission is required')
    .custom((permissions: string[]) => {
      return Array.isArray(permissions) && permissions.every(permission => {
        if (permission === '*:*') return true; // Allow superadmin permission
        return isValidPermission(permission);
      });
    })
    .withMessage('Invalid permission format. Use "resource:action" format'),
];

export const updateRolePermissionsValidator = [
  createValidator('param', 'roleId')
    .notEmpty()
    .withMessage('Role ID is required')
    .isMongoId()
    .withMessage('Invalid role ID format'),
  
  createValidator('body', 'permissions')
    .isArray({ min: 1 })
    .withMessage('At least one permission is required')
    .custom((permissions: string[]) => {
      return Array.isArray(permissions) && permissions.every(permission => {
        if (permission === '*:*') return true; // Allow superadmin permission
        return isValidPermission(permission);
      });
    })
    .withMessage('Invalid permission format. Use "resource:action" format'),
];

export const assignRoleToUserValidator = [
  createValidator('param', 'userId')
    .notEmpty()
    .withMessage('User ID is required')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  
    createValidator('body', 'role')
    .notEmpty()
    .withMessage('Role ID is required')
    .isMongoId()
    .withMessage('Role ID must be a valid Mongo ID'),
  
  
  createValidator('body', 'application')
    .trim()
    .notEmpty()
    .withMessage('Application name is required')
    .isString()
    .withMessage('Application name must be a string'),
];

export const roleIdValidator = [
  createValidator('param', 'roleId')
    .notEmpty()
    .withMessage('Role ID is required')
    .isMongoId()
    .withMessage('Invalid role ID format'),
];

export const listRolesValidator = [
  createValidator('query', 'application')
    .optional()
    .isString()
    .withMessage('Application filter must be a string'),
];
