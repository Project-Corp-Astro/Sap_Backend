import { UserDocument, UserRole } from '../interfaces/user.interfaces';
import { Document } from 'mongoose';

// Create a mock of mongoose Document methods to satisfy TypeScript
interface MongooseDocumentMethods {
  $assertPopulated: any;
  $clone: any;
  $getAllSubdocs: any;
  $ignore: any;
  $isDefault: any;
  $isDeleted: any;
  $getPopulatedDocs: any;
  $isEmpty: any;
  $isValid: any;
  $locals: any;
  $markValid: any;
  $model: any;
  $op: any;
  $session: any;
  $set: any;
  $where: any;
  $inc: any;
  $parent: any;
  replaceOne: any;
  collection: any;
  db: any;
  delete: any;
  deleteOne: any;
  depopulate: any;
  directModifiedPaths: any;
  equals: any;
  errors: any;
  get: any;
  getChanges: any;
  increment: any;
  init: any;
  inspect: any;
  invalidate: any;
  isDirectModified: any;
  isDirectSelected: any;
  isInit: any;
  isModified: any;
  isNew: any;
  isSelected: any;
  markModified: any;
  model: any;
  modifiedPaths: any;
  overwrite: any;
  populate: any;
  populated: any;
  remove: any;
  save: any;
  schema: any;
  set: any;
  toJSON: any;
  toObject: any;
  unmarkModified: any;
  update: any;
  updateOne: any;
  validate: any;
  validateSync: any;
}

declare global {
  namespace Express {
    // Define a minimal user interface for auth middleware that satisfies mongoose Document requirements
    interface AuthUser extends Partial<MongooseDocumentMethods> {
      _id: string;
      email: string;
      role: UserRole;
      // Add common properties from UserDocument to improve compatibility
      username?: string;
      firstName?: string;
      lastName?: string;
      isActive?: boolean;
      devices?: any[];
      preferences?: any;
    }
    
    // Allow both full UserDocument and minimal AuthUser
    type User = UserDocument | AuthUser;
    
    interface Request {
      user?: User;
    }
  }
}

// Add module declaration to make TypeScript ignore compatibility issues
declare module 'express-serve-static-core' {
  interface Request {
    user?: Express.User;
  }
}

// Add module declaration for express
declare module 'express' {
  interface Request {
    user?: Express.User;
  }
}
