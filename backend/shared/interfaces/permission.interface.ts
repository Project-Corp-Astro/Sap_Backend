// shared/interfaces/permission.interface.ts

import { Types } from "mongoose";

/**
 * Permission action types
 */
export enum PermissionAction {
    CREATE = 'create',
    READ = 'read',
    UPDATE = 'update',
    DELETE = 'delete',
    MANAGE = 'manage',
    APPROVE = 'approve',
    EXPORT = 'export',
    IMPORT = 'import',
  }
  
  /**
   * Resource types that can be protected
   */
  export enum ResourceType {
    USER = 'user',
    ROLE = 'role',
    PERMISSION = 'permission',
    SUBSCRIPTION = 'subscription',
    CONTENT = 'content',
    SETTINGS = 'settings',
  }
  
  /**
   * User role assignment
   */
  export type UserRole = Types.ObjectId;  // Direct reference to RolePermission _id
  
  /**
   * Role-Permission mapping
   */
  export interface IRolePermission {
    _id?: any;
    role: string;
    application: string;
    permissions: string[];  // Array of "resource:action" strings
    version: number;
  }