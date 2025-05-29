import { IUser, UserDocument } from '../../../../shared/interfaces/user.interface';

/**
 * Helper function to cast UserDocument to IUser for TypeScript compatibility
 */
export function asIUser(user: UserDocument | any): IUser {
  return user as IUser;
}

/**
 * Helper function to cast any object to IUser
 */
export function anyToIUser(obj: any): IUser {
  return obj as IUser;
}

/**
 * Helper type for JWT token payload
 */
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  permissions?: string[];
}

/**
 * Helper type for auth tokens
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
