import { UserDocument, IUser } from '../../../../shared/interfaces/user.interface';
import { Document } from 'mongoose';

// Add missing properties to UserDocument and mongoose document types
declare module '../../../../shared/interfaces/user.interface' {
  // Extend UserDocument to include all missing properties
  interface UserDocument {
    // MFA properties
    mfa?: {
      enabled: boolean;
      type: string;
      secret?: string;
      backupCodes?: string[];
      verified: boolean;
      lastVerified?: Date;
    };
    mfaSecret?: string;
    mfaEnabled?: boolean;
    mfaRecoveryCodes?: string[];
    
    // Account security properties
    failedLoginAttempts?: number;
    loginAttempts?: any[];
    lockUntil?: Date;
    accountLocked?: boolean;
    accountLockedUntil?: Date;
    passwordChangedAt?: Date;
    passwordLastChanged?: Date;
  }
  
  // Also extend the mongoose document types that appear in the errors
  interface MongooseDocument extends Document {
    mfaSecret?: string;
    mfaEnabled?: boolean;
    mfaRecoveryCodes?: string[];
    failedLoginAttempts?: number;
    lockUntil?: any; // Use any instead of Date to avoid type conflicts
    passwordChangedAt?: any; // Use any instead of Date to avoid type conflicts
    passwordLastChanged?: any; // Use any instead of Date to avoid type conflicts
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    isActive?: boolean;
    permissions?: string[];
    preferences?: any;
  }
}

// Extend the mongoose document types
declare module 'mongoose' {
  interface Document {
    mfaSecret?: string;
    mfaEnabled?: boolean;
    mfaRecoveryCodes?: string[];
    failedLoginAttempts?: number;
    lockUntil?: any; // Use any instead of Date to avoid type conflicts
    passwordChangedAt?: any; // Use any instead of Date to avoid type conflicts
    passwordLastChanged?: any; // Use any instead of Date to avoid type conflicts
  }
}

// JWT token payload interface
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  permissions?: string[];
}

// Auth tokens interface
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
