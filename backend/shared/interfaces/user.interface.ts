// shared/interfaces/user.interface.ts
import { Document, Types } from 'mongoose';

import { IUserDocument } from '@models/mongodb/User.model';
// Re-export IUserRole for backward compatibility


/**
 * User preferences interface
 */
export interface IUserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
  };
  language: string;
  timezone: string;
}

/**
 * User address interface
 */
export interface IUserAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * User device information
 */
export interface IUserDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  os?: string;
  browser?: string;
  ipAddress?: string;
  lastUsed: Date;
  isTrusted: boolean;
}

/**
 * Base user interface
 */
export interface IUser {
  _id?: Types.ObjectId;
  roles: Types.ObjectId[];
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  avatar?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin?: Date;
  
  address?: IUserAddress;
  preferences: IUserPreferences;
  devices?: IUserDevice[];
  createdAt?: Date;
  updatedAt: Date;
}

/**
 * User document interface (for Mongoose models)
 */
// This is intentionally left empty as it's defined in the model file

/**
 * User creation DTO
 */
export interface ICreateUser {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  preferences?: Partial<IUserPreferences>;
}

/**
 * User update DTO
 */
export interface IUpdateUser {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  avatar?: string;
  preferences?: Partial<IUserPreferences>;
}



/**
 * User query interface
 */
export interface IUserQuery {
  search?: string;
  role?: string;
  application?: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  createdAtStart?: Date;
  createdAtEnd?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * User authentication response
 */
export interface IAuthResponse {
  user: Omit<IUser, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}