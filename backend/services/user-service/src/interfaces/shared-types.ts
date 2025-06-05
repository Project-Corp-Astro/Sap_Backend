import { Document } from 'mongoose';
import { User, UserRole, Permission } from '@corp-astro/shared-types';
import { DeviceType, DeviceLocation } from '../models/UserDevice';
import { ActivityType } from '../models/UserActivity';
import { AstrologyUserProfile, BusinessProfile, AstrologyPreferences, AstrologySubscription, AstrologySpecialist } from './astrology.interfaces';

/**
 * Extended User interface that includes backend-specific properties
 */
export interface ExtendedUser extends Omit<User, 'isActive' | 'createdAt' | 'updatedAt'> {
  // Additional backend-specific properties
  username: string; // Username for login (in addition to email)
  phoneNumber?: string; // Optional phone number
  isEmailVerified?: boolean;
  isActive?: boolean; // Whether the user account is active (optional in backend, required in frontend)
  lastLogin?: Date;
  avatar?: string;
  address?: UserAddress;
  metadata?: Record<string, any>;
  preferences: UserPreferences;
  securityPreferences?: SecurityPreferences;
  
  // Astrology-specific properties
  astrologyProfile?: AstrologyUserProfile;
  businessProfiles?: BusinessProfile[];
  astrologyPreferences?: AstrologyPreferences;
  astrologySubscription?: AstrologySubscription;
  specialistProfile?: AstrologySpecialist;
  
  // Standard properties
  subscriptionId?: string;
  createdAt?: Date; // Optional in backend model, populated automatically
  updatedAt?: Date; // Optional in backend model, populated automatically
}

/**
 * User document interface for Mongoose
 */
export interface UserDocument extends Omit<ExtendedUser, 'id'>, Document {
  _id: string; // Mongoose uses _id instead of id
  devices: IUserDevice[];
}

/**
 * Theme preference enum
 */
export enum ThemePreference {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

/**
 * User notification preferences
 */
export interface NotificationPreferences {
  email: boolean;
  push: boolean;
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme: ThemePreference;
  notifications: NotificationPreferences;
  language?: string;
  timezone?: string;
}

/**
 * Security preferences
 */
export interface SecurityPreferences {
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  activityAlerts: boolean;
  trustedDevicesOnly?: boolean;
  passwordExpiryDays?: number;
}

/**
 * User address interface
 */
export interface UserAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * User device interface
 */
export interface IUserDevice {
  deviceId: string;
  deviceName: string;
  deviceType: DeviceType;
  browser?: string;
  operatingSystem?: string;
  lastUsed: Date;
  ipAddress?: string;
  isTrusted: boolean;
  userAgent?: string;
  location?: DeviceLocation;
}

/**
 * User activity interface
 */
export interface IUserActivity {
  user: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  successful?: boolean;
}

/**
 * User filter interface
 */
export interface UserFilter {
  search?: string;
  role?: UserRole | string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  
  // Astrology-specific filters
  sunSign?: string;
  moonSign?: string;
  ascendantSign?: string;
  subscriptionTier?: string;
  isSpecialist?: boolean;
  specialty?: string;
}

/**
 * User pagination result interface
 */
export interface UserPaginationResult {
  users: UserDocument[];
  totalUsers: number;
  totalPages: number;
  currentPage: number;
  usersPerPage: number;
}

/**
 * Activity filter interface
 */
export interface ActivityFilter {
  type?: ActivityType | string;
  successful?: boolean;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Activity pagination result interface
 */
export interface ActivityPaginationResult {
  activities: any[]; // Using any here as we'll get the actual UserActivityDocument from the model
  totalActivities: number;
  totalPages: number;
  currentPage: number;
  activitiesPerPage: number;
}

export enum AppAccess {
  CORP_ASTRO = 'corpAstro',
  GRAHVANI = 'grahvani',
  TELL_MY_STARS = 'tellmystars',
  HUMAN_ASTROLOGY = 'human astrology'
}


/**
 * JWT payload interface
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole | string;
  permissions?: Permission[];
  isSpecialist?: boolean;
  businessIds?: string[];
  subscriptionTier?: string;
  appAccess?: AppAccess[]; // ← Added here
  iat?: number;
  exp?: number;
}
