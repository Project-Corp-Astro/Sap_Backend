import { Types } from 'mongoose';

// Extend Express types
declare global {
  namespace Express {
    // User interface with _id
    interface User {
      _id: Types.ObjectId | string;
      [key: string]: any; // Allow other properties
    }

    // Extend the Request interface to include user
    interface Request {
      user?: User;
    }
  }
}

// This export is needed to make this a module
export {};
