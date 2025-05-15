import { Document } from 'mongoose';
import { ZodiacSign, AstrologyContentType } from './astrology.interfaces';

/**
 * Content status enum
 */
export enum ContentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  PENDING_REVIEW = 'pending_review',
  REJECTED = 'rejected',
  SCHEDULED = 'scheduled'
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
 * Content interface
 */
export interface IContent {
  title: string;
  slug: string;
  description: string;
  body: string;
  category: string;
  tags?: string[];
  featuredImage?: string;
  author: Author;
  status: ContentStatus;
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
 * Content document interface
 */
export interface ContentDocument extends IContent, Document {
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
  status?: string;
  'author.id'?: string;
  
  // Astrology-specific filters
  contentType?: string;
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
