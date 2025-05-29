import { Document } from 'mongoose';
import type { Permission, UserRole } from '@corp-astro/shared-types';

import { ActivityType } from '../models/UserActivity';
import { DeviceType, DeviceLocation } from '../models/UserDevice';
import {
  AstrologyUserProfile,
  BusinessProfile,
  AstrologyPreferences,
  AstrologySubscription,
  AstrologySpecialist,
} from './astrology.interfaces';

import {
  ExtendedUser,
  UserDocument,
  ThemePreference,
  NotificationPreferences,
  UserPreferences,
  SecurityPreferences,
  UserAddress,
  IUserDevice,
  IUserActivity,
  UserFilter,
  UserPaginationResult,
  ActivityFilter,
  ActivityPaginationResult,
  JwtPayload,
} from './shared-types';

/**
 * Legacy User interface - use ExtendedUser from shared-types.ts instead
 * @deprecated Use ExtendedUser from shared-types.ts instead
 */
export interface IUser extends ExtendedUser {
  username: string;
  phoneNumber?: string;
  isActive: boolean;
  permissions: Permission[]; // from shared-types
}
