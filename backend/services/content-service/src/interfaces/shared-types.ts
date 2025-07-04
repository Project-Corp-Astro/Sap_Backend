import { Document, Types } from 'mongoose';
import { Content, ContentType, ContentStatus, User } from '@corp-astro/shared-types';
import { ZodiacSign, AstrologyContentType } from './astrology.interfaces';
import { AuthUser } from '../../../../shared/types/auth-user';

/**
 * Extended Content interface that includes backend-specific properties
 */
export interface ExtendedContent extends Omit<Content, 'author'> {
  slug: string;
  category: string;
  tags?: string[];
  featuredImage?: string;
  author: Author | string; // Allow both Author object and string ID for flexibility
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
  
  // These fields are required in the base Content interface
  createdAt: Date;
  updatedAt: Date;
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
interface ContentDocumentBase extends ExtendedContent, Document {
  _id: Types.ObjectId;
  id: string;
  revisionHistory?: RevisionHistoryEntry[];
}

// This ensures TypeScript understands the Mongoose document methods
export type ContentDocument = ContentDocumentBase & {
  save: () => Promise<ContentDocument>;
  toObject: (options?: any) => any;
  toJSON: (options?: any) => any;
};

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
 * Extends the shared AuthUser type for content service specific needs
 */
export interface RequestUser extends Omit<AuthUser, 'id' | 'role'> {
  _id: Types.ObjectId | string;
 
}
