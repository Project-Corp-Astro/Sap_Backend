import { UserDocument, IUser } from '../../../../shared/interfaces/user.interface';

// Extend the UserDocument interface to include MFA and other missing properties
declare module '../../../../shared/interfaces/user.interface' {
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
    
    // Username property (if missing)
    username?: string;
  }

  // Add additional interface for JWT token payload
  interface TokenPayload {
    userId: string;
    email: string;
    role: string;
    permissions?: string[];
  }

  // Add interface for auth tokens
  interface AuthTokens {
    accessToken: string;
    refreshToken: string;
  }
}
