// Global type declarations to fix TypeScript errors
import { Request } from 'express';
import { Document } from 'mongoose';
import { IUser, UserDocument } from '../../../../shared/interfaces/user.interface';

// Make TypeScript more lenient with type checking for specific interfaces
declare global {
  namespace Express {
    // Override the User interface to be compatible with UserDocument
    interface User extends Partial<IUser> {
      _id: any;
    }
  }
}

// Declare module augmentations for specific interfaces
declare module '../../../../shared/interfaces/user.interface' {
  // Add missing methods to UserDocument
  interface UserDocument {
    toObject(): any;
  }
}

// Export nothing - this is just for type declarations
export {};
