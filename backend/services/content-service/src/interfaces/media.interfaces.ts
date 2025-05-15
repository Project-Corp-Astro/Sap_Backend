import { Document } from 'mongoose';
import { Author, ContentStatus } from './content.interfaces.js';

/**
 * Media type enum
 */
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document'
}

/**
 * Video provider enum
 */
export enum VideoProvider {
  YOUTUBE = 'youtube',
  VIMEO = 'vimeo',
  INTERNAL = 'internal',
  OTHER = 'other'
}

/**
 * Media dimensions interface
 */
export interface MediaDimensions {
  width?: number;
  height?: number;
  duration?: number; // For videos/audio (in seconds)
}

/**
 * Media interface
 */
export interface IMedia {
  title: string;
  description: string;
  slug: string;
  type: MediaType;
  url: string;
  fileSize?: number; // in bytes
  mimeType?: string;
  dimensions?: MediaDimensions;
  thumbnailUrl?: string;
  category: string;
  tags?: string[];
  author: Author;
  status: ContentStatus;
  publishedAt?: Date;
  viewCount?: number;
  downloadCount?: number;
  metadata?: Record<string, any>;
  // For videos
  videoProvider?: VideoProvider;
  videoId?: string; // YouTube/Vimeo ID if applicable
  // Tracking and management
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Media document interface
 */
export interface MediaDocument extends IMedia, Document {
  _id: string;
}

/**
 * Media filter interface
 */
export interface MediaFilter {
  search?: string;
  type?: MediaType;
  category?: string;
  tags?: string[];
  status?: ContentStatus;
  author?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Media pagination result interface
 */
export interface MediaPaginationResult {
  media: MediaDocument[];
  totalMedia: number;
  totalPages: number;
  currentPage: number;
  mediaPerPage: number;
}
