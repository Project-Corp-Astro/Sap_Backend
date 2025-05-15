import { Document } from 'mongoose';
import { Content, ContentType, ContentStatus, User } from '@corp-astro/shared-types';
import { ZodiacSign, AstrologyContentType } from './astrology.interfaces';

/**
 * Extended Content interface that includes backend-specific properties
 */
export interface ExtendedContent extends Content {
  slug: string;
  category: string;
  tags?: string[];
  featuredImage?: string;
  author: Author;
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
  approvedBy?: {
    id: string;
    name: string;
    approvedAt: Date;
  };
  
  // Astrology-specific properties
  contentType?: AstrologyContentType;
  relatedSigns?: ZodiacSign[];
  scheduledAt?: Date;
  
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Author interface
 */
export interface Author {
  id: string;
  name: string;
  email: string;
}

/**
 * Revision history entry interface
 */
export interface RevisionHistoryEntry {
  modifiedBy: {
    id: string;
    name: string;
  };
  modifiedAt: Date;
  changes: Record<string, any>;
}

/**
 * Content document interface for Mongoose
 */
export interface ContentDocument extends ExtendedContent, Document {
  _id: string;
  revisionHistory?: RevisionHistoryEntry[];
}

/**
 * Category interface
 */
export interface ICategory {
  name: string;
  slug: string;
  description?: string;
  parentCategory?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Category document interface
 */
export interface CategoryDocument extends ICategory, Document {
  _id: string;
}

/**
 * Content pagination result interface
 */
export interface ContentPaginationResult {
  items: ContentDocument[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
}

/**
 * Content filter interface
 */
export interface ContentFilter {
  $text?: { $search: string };
  category?: string;
  tags?: string;
  status?: ContentStatus | string;
  'author.id'?: string;
  
  // Astrology-specific filters
  contentType?: ContentType | string;
  relatedSigns?: string;
  scheduledAfter?: Date;
  scheduledBefore?: Date;
}

/**
 * User interface for request objects
 */
export interface RequestUser {
  userId: string;
  email: string;
  role: string;
  isSpecialist?: boolean;
  businessIds?: string[];
  subscriptionTier?: string;
}
