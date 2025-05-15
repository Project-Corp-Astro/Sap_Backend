/**
 * Astrology-specific interfaces for the Auth Service
 * These interfaces extend the base user interfaces with astrology-related properties
 */

// Import ZodiacSign enum directly to avoid dependency issues
// Will be replaced with proper imports when shared types are fully integrated
export enum ZodiacSign {
  ARIES = 'aries',
  TAURUS = 'taurus',
  GEMINI = 'gemini',
  CANCER = 'cancer',
  LEO = 'leo',
  VIRGO = 'virgo',
  LIBRA = 'libra',
  SCORPIO = 'scorpio',
  SAGITTARIUS = 'sagittarius',
  CAPRICORN = 'capricorn',
  AQUARIUS = 'aquarius',
  PISCES = 'pisces'
}

/**
 * Astrology user profile interface
 * Contains astrology-specific user information
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
  sunSign?: ZodiacSign;
  moonSign?: ZodiacSign;
  ascendantSign?: ZodiacSign;
  chartIds?: string[]; // References to user's charts
}

/**
 * Business profile interface
 * Contains business-specific information for corporate astrology
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
  chartIds?: string[]; // References to business charts
}

/**
 * Astrology preferences interface
 * Contains user preferences for astrological calculations and reports
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
 * Astrology specialist booking interface
 */
export interface SpecialistBooking {
  specialistId: string;
  userId: string;
  bookingDate: Date;
  duration: number; // in minutes
  topic: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  feedback?: {
    rating: number;
    comment?: string;
  };
}

/**
 * Astrology AI chat interface
 */
export interface AstrologyAIChat {
  userId: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  messageCount: number;
  topic?: string;
  chartReferenced?: string[];
}
