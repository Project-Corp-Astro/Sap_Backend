import { IUser } from '../../../../shared/interfaces/user.interface';
import { IUserDocument } from '../../../../models/mongodb/User.model';

/**
 * Helper function to cast UserDocument to IUser for TypeScript compatibility
 */
export function asIUser(user: IUserDocument | any): IUser {
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
}

/**
 * Helper type for auth tokens
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
