import { IUser, UserDocument, UserRole, ThemePreference } from '../../../../shared/interfaces/user.interface';

/**
 * Helper function to convert UserDocument to IUser
 * This is needed to fix TypeScript errors when passing UserDocument to functions expecting IUser
 */
export function convertToIUser(user: UserDocument): IUser {
  // Create a new object with all required IUser properties
  const iUser: IUser = {
    _id: user._id,
    username: user.username || '',
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    role: user.role || UserRole.USER,
    isActive: user.isActive !== undefined ? user.isActive : true,
    preferences: user.preferences || { theme: ThemePreference.SYSTEM, notifications: { email: true, push: true } }
  };
  
  return iUser;
}
