/**
 * Shared user interface for use across all services
 * This ensures compatibility between Auth Service and User Service
 */

import { Document } from 'mongoose';

/**
 * User roles enum
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  CONTENT_MANAGER = 'content_manager',
  SUPPORT = 'support',
  ANALYTICS = 'analytics',
  ASTROLOGER = 'astrologer',
  BUSINESS_USER = 'business_user',
  USER = 'user'
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
export interface UserDevice {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  browser?: string;
  operatingSystem?: string;
  lastUsed: Date;
  ipAddress?: string;
  isTrusted: boolean;
  userAgent?: string;
  location?: {
    city?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
  };
}

/**
 * Astrology user profile interface
 */
export interface AstrologyUserProfile {
  birthDate?: string;
  birthTime?: string;
  birthPlace?: {
    latitude?: number;
    longitude?: number;
    city?: string;
    country?: string;
    timezone?: string;
  };
  sunSign?: string;
  moonSign?: string;
  ascendantSign?: string;
  chartIds?: string[];
}

/**
 * Business profile interface
 */
export interface BusinessProfile {
  businessName?: string;
  incorporationDate?: string;
  incorporationTime?: string;
  incorporationPlace?: {
    latitude?: number;
    longitude?: number;
    city?: string;
    country?: string;
    timezone?: string;
  };
  industry?: string;
  size?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
  chartIds?: string[];
}

/**
 * Astrology preferences interface
 */
export interface AstrologyPreferences {
  preferredZodiacSystem?: 'tropical' | 'sidereal';
  preferredHouseSystem?: string;
  preferredAyanamsa?: string;
  preferredChartStyle?: 'western' | 'vedic' | 'modern';
  includeAsteroids?: boolean;
  showTransits?: boolean;
  dailyHoroscopeEnabled?: boolean;
  weeklyHoroscopeEnabled?: boolean;
  monthlyHoroscopeEnabled?: boolean;
  yearlyHoroscopeEnabled?: boolean;
  transitAlertsEnabled?: boolean;
  retrogradeAlertsEnabled?: boolean;
  newMoonAlertsEnabled?: boolean;
  fullMoonAlertsEnabled?: boolean;
}

/**
 * Astrology subscription tier enum
 */
export enum AstrologySubscriptionTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  BUSINESS = 'business',
  ENTERPRISE = 'enterprise'
}

/**
 * Astrology subscription interface
 */
export interface AstrologySubscription {
  tier: AstrologySubscriptionTier;
  startDate: Date;
  endDate?: Date;
  autoRenew: boolean;
  features: string[];
  aiChatCredits?: number;
  specialistConsultationCredits?: number;
  customReportCredits?: number;
}

/**
 * Base user interface
 * This is the common interface that should be used across all services
 */
export interface IUser {
  _id: any;
  username: string;
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  // permissions?: string[];
  isActive: boolean;
  isEmailVerified?: boolean;
  lastLogin?: Date;
  avatar?: string;
  address?: UserAddress;
  metadata?: Record<string, any>;
  preferences: UserPreferences;
  securityPreferences?: SecurityPreferences;
  devices?: UserDevice[];
  applicationRoles?: Array<{ application: string; role: string; permissions: string[] }>;
  permissionVersion?: number;
  
  // Astrology-specific properties
  astrologyProfile?: AstrologyUserProfile;
  businessProfiles?: BusinessProfile[];
  astrologyPreferences?: AstrologyPreferences;
  astrologySubscription?: AstrologySubscription;
  
  subscriptionId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User document interface for use with Mongoose
 */
// Only extend Document and don't extend IUser to avoid conflicts with required properties
export interface UserDocument extends Document {
  // Explicitly define required properties
  _id: string; // Explicitly define _id from Document
  comparePassword?(candidatePassword: string): Promise<boolean>;
  
  // Add IUser properties as optional
  username?: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role?: UserRole;
  permissions?: string[];
  isActive?: boolean;
  isEmailVerified?: boolean;
  lastLogin?: Date;
  avatar?: string;
  address?: UserAddress;
  metadata?: Record<string, any>;
  preferences?: UserPreferences;
  securityPreferences?: SecurityPreferences;
  devices?: UserDevice[];
  applicationRoles?: Array<{
    application: string;
    role: string;
    permissions: string[];
  }>;
  permissionVersion?: number;

  
  // Astrology-specific properties
  astrologyProfile?: AstrologyUserProfile;
  businessProfiles?: BusinessProfile[];
  astrologyPreferences?: AstrologyPreferences;
  astrologySubscription?: AstrologySubscription;
  subscriptionId?: string;
  
  // Additional properties for MFA and security
  mfaSecret?: string;
  mfaEnabled?: boolean;
  mfaRecoveryCodes?: string[];
  failedLoginAttempts?: number;
  lockUntil?: Date;
  passwordChangedAt?: Date;
  passwordLastChanged?: Date;
}

/**
 * Express Request user interface
 */
export interface RequestUser {
  _id: string;
  userId: string;
  email: string;
  role: string;
  permissions?: string[];
  isSpecialist?: boolean;
  businessIds?: string[];
  subscriptionTier?: string;
}
