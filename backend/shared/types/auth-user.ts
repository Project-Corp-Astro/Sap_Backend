import { Types } from 'mongoose';

export interface AuthUser {
  _id: Types.ObjectId | string;
  email: string;
  rolePermissionIds: string[];
  username?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  devices?: any[];
  preferences?: any;
  [key: string]: any;
}
