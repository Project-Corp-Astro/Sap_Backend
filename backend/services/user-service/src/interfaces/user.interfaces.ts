import { Document } from 'mongoose';
import { UserRole, Permission } from '@corp-astro/shared-types';
import { ActivityType } from '../models/UserActivity';
import { DeviceType, DeviceLocation } from '../models/UserDevice';
import { AstrologyUserProfile, BusinessProfile, AstrologyPreferences, AstrologySubscription, AstrologySpecialist } from './astrology.interfaces';
import { ExtendedUser, UserDocument, ThemePreference, NotificationPreferences, UserPreferences, SecurityPreferences, UserAddress, IUserDevice, IUserActivity, UserFilter, UserPaginationResult, ActivityFilter, ActivityPaginationResult, JwtPayload } from './shared-types';

// These types are now imported from shared-types.ts

/**
 * Legacy User interface - use ExtendedUser from shared-types.ts instead
 * @deprecated Use ExtendedUser from shared-types.ts instead
 */
export interface IUser extends ExtendedUser {
  // Any legacy properties not in ExtendedUser
  username: string;
  phoneNumber?: string;
  isActive: boolean;
  permissions: Permission[]; // Required to match ExtendedUser
}

// Use UserDocument from shared-types.ts

// All these interfaces are now imported from shared-types.ts
