// Global type declarations to fix TypeScript errors

import { Document } from 'mongoose';
import { IUser } from '../../../../shared/interfaces/user.interface';

// Make TypeScript more lenient with type checking for specific interfaces
declare global {
  // Extend the UserDocument interface to include all the properties needed
  namespace Express {
    interface User extends IUser {}
  }
  
  // Add missing properties to mongoose Document
  namespace mongoose {
    interface Document {
      mfaSecret?: string;
      mfaEnabled?: boolean;
      mfaRecoveryCodes?: string[];
      failedLoginAttempts?: number;
      lockUntil?: any;
      passwordChangedAt?: any;
      passwordLastChanged?: any;
    }
  }
}

// Declare module augmentations for specific interfaces
declare module '../../../../shared/interfaces/user.interface' {
  // Make TypeScript treat UserDocument as IUser for compatibility
  interface UserDocument extends IUser {}
}

// Export nothing - this is just for type declarations
export {};
