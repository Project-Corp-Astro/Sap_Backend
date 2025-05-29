import { Document, Model } from 'mongoose';
import { IUser } from '../../../../shared/interfaces/user.interface';

// Extend Mongoose's Document interface to include all the missing properties
declare module 'mongoose' {
  interface Document {
    // MFA properties
    mfaSecret?: string;
    mfaEnabled?: boolean;
    mfaRecoveryCodes?: string[];
    
    // Account security properties
    failedLoginAttempts?: number;
    loginAttempts?: any[];
    lockUntil?: any;
    accountLocked?: boolean;
    accountLockedUntil?: any;
    passwordChangedAt?: any;
    passwordLastChanged?: any;
    
    // User properties
    username?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    isActive?: boolean;
    permissions?: string[];
    preferences?: any;
    
    // Methods
    comparePassword?(candidatePassword: string): Promise<boolean>;
  }
}

// Add additional interfaces for JWT token payload and auth tokens
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  permissions?: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
