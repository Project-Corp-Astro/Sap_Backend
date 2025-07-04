import { Types } from 'mongoose';

// This file should be in your TypeScript compilation context
// and will be automatically included by TypeScript

declare global {
  namespace Express {
    export interface Request {
      user?: {
        _id: Types.ObjectId | string;
        email: string;
        rolePermissionIds: string[];
        [key: string]: any; // For any additional properties
      };
    }
  }
}

export {}; // This file doesn't need to export anything
