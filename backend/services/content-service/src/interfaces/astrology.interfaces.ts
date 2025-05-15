/**
 * Astrology-specific interfaces for the Content Service
 * These interfaces extend the base content interfaces with astrology-related properties
 */

import { Document } from 'mongoose';
import { ContentStatus, Author } from './content.interfaces';

/**
 * Zodiac sign enum
 */
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
 * Horoscope type enum
 */
export enum HoroscopeType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  SPECIAL = 'special'
}

/**
 * Astrology content type enum
 */
export enum AstrologyContentType {
  HOROSCOPE = 'horoscope',
  ARTICLE = 'article',
  GUIDE = 'guide',
  PREDICTION = 'prediction',
  REPORT = 'report',
  CHART_ANALYSIS = 'chart_analysis',
  TRANSIT_ANALYSIS = 'transit_analysis',
  BUSINESS_FORECAST = 'business_forecast'
}

/**
 * Horoscope interface
 */
export interface IHoroscope {
  title: string;
  slug: string;
  sign: ZodiacSign;
  type: HoroscopeType;
  content: string;
  summary: string;
  luckyNumbers?: number[];
  compatibleSigns?: ZodiacSign[];
  keywords?: string[];
  startDate: Date;
  endDate: Date;
  author: Author;
  status: ContentStatus;
  publishedAt?: Date;
  archivedAt?: Date;
  viewCount?: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Horoscope document interface
 */
export interface HoroscopeDocument extends IHoroscope, Document {
  _id: string;
}

/**
 * Astrology article interface
 */
export interface IAstrologyArticle {
  title: string;
  slug: string;
  description: string;
  body: string;
  contentType: AstrologyContentType;
  relatedSigns?: ZodiacSign[];
  featuredImage?: string;
  author: Author;
  status: ContentStatus;
  tags?: string[];
  publishedAt?: Date;
  archivedAt?: Date;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  metadata?: Record<string, any>;
  seoMetadata?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  relatedContent?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Astrology article document interface
 */
export interface AstrologyArticleDocument extends IAstrologyArticle, Document {
  _id: string;
}

/**
 * Business forecast interface
 */
export interface IBusinessForecast {
  title: string;
  slug: string;
  description: string;
  body: string;
  industry?: string;
  timeframe: {
    startDate: Date;
    endDate: Date;
  };
  highlights: string[];
  challenges: string[];
  opportunities: string[];
  author: Author;
  status: ContentStatus;
  publishedAt?: Date;
  archivedAt?: Date;
  viewCount?: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Business forecast document interface
 */
export interface BusinessForecastDocument extends IBusinessForecast, Document {
  _id: string;
}

/**
 * Astrology content filter interface
 */
export interface AstrologyContentFilter {
  $text?: { $search: string };
  contentType?: AstrologyContentType;
  sign?: ZodiacSign;
  horoscopeType?: HoroscopeType;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  'author.id'?: string;
  industry?: string;
}

/**
 * Astrology content pagination result interface
 */
export interface AstrologyContentPaginationResult {
  items: (HoroscopeDocument | AstrologyArticleDocument | BusinessForecastDocument)[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
}
