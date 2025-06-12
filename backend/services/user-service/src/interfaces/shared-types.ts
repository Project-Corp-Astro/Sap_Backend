import { Document } from 'mongoose';
import { User, UserRole, Permission } from '@corp-astro/shared-types';
import { DeviceType, DeviceLocation } from '../models/UserDevice';
import { ActivityType } from '../models/UserActivity';
import { AstrologyUserProfile, BusinessProfile, AstrologyPreferences, AstrologySubscription, AstrologySpecialist } from './astrology.interfaces';

export interface ExtendedUser extends Omit<User, 'isActive' | 'createdAt' | 'updatedAt' | 'permissions'> {
  
  phoneNumber?: string;
  isEmailVerified?: boolean;
  isActive?: boolean;
  lastLogin?: Date;
  avatar?: string;
  address?: UserAddress;
  metadata?: Record<string, any>;
  preferences: UserPreferences;
  securityPreferences?: SecurityPreferences;
  astrologyProfile?: AstrologyUserProfile;
  businessProfiles?: BusinessProfile[];
  astrologyPreferences?: AstrologyPreferences;
  astrologySubscription?: AstrologySubscription;
  specialistProfile?: AstrologySpecialist;
  subscriptionId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  permissions: string[];
}

export interface UserDocument extends Omit<ExtendedUser, 'id'>, Document {
  _id: string;
  devices: IUserDevice[];
  permissionsLegacy?: string[];
  roles?: Array<{
    _id: string;
    permissions?: string[];
  }>;
}

export enum ThemePreference {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system'
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
}

export interface UserPreferences {
  theme: ThemePreference;
  notifications: NotificationPreferences;
  language?: string;
  timezone?: string;
}

export interface SecurityPreferences {
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  activityAlerts: boolean;
  trustedDevicesOnly?: boolean;
  passwordExpiryDays?: number;
}

export interface UserAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

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

export interface IUserActivity {
  user: string;
  type: ActivityType;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  successful?: boolean;
}

export interface UserFilter {
  search?: string;
  role?: UserRole | string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  sunSign?: string;
  moonSign?: string;
  ascendantSign?: string;
  subscriptionTier?: string;
  isSpecialist?: boolean;
  specialty?: string;
}

export interface UserPaginationResult {
  users: UserDocument[];
  totalUsers: number;
  totalPages: number;
  currentPage: number;
  usersPerPage: number;
}

export interface ActivityFilter {
  type?: ActivityType | string;
  successful?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface ActivityPaginationResult {
  activities: any[];
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

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole | string;
  permissions?: string[];
  isSpecialist?: boolean;
  businessIds?: string[];
  subscriptionTier?: string;
  appAccess?: AppAccess[];
  iat?: number;
  exp?: number;
}