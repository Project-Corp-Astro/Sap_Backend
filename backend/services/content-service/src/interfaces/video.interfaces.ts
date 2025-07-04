import { Document } from 'mongoose';

// Base Video interface
export interface IVideo {
  title: string;
  description: string;
  slug: string;
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;
  resolution?: {
    width: number;
    height: number;
  };
  format?: string;
  category?: string;
  tags?: string[];
  author: {
    id: string;
    name: string;
    email?: string;
  };
  status: 'draft' | 'published' | 'archived' | 'pending_review' | 'rejected';
  publishedAt?: Date;
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  shareCount: number;
  videoProvider?: 'youtube' | 'vimeo' | 'internal' | 'other';
  videoId?: string;
  transcript?: string;
  captions?: {
    language: string;
    url: string;
  }[];
  isPrivate: boolean;
  isDownloadable: boolean;
  isEmbeddable: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Video Document interface for Mongoose
export interface VideoDocument extends IVideo, Document {
  _id: string;
}

// Video input for creating a new video
export interface CreateVideoInput {
  title: string;
  description: string;
  slug?: string;
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;
  resolution?: {
    width: number;
    height: number;
  };
  format?: string;
  category?: string;
  tags?: string[];
  author: {
    id: string;
    name: string;
    email?: string;
  };
  status?: 'draft' | 'published' | 'archived' | 'pending_review' | 'rejected';
  videoProvider?: 'youtube' | 'vimeo' | 'internal' | 'other';
  videoId?: string;
  transcript?: string;
  captions?: {
    language: string;
    url: string;
  }[];
  isPrivate?: boolean;
  isDownloadable?: boolean;
  isEmbeddable?: boolean;
}

// Video input for updating an existing video
export interface UpdateVideoInput extends Partial<IVideo> {
  updatedAt?: Date;
}

// Video filter options
export interface VideoFilterOptions {
  category?: string;
  tags?: string[];
  status?: 'draft' | 'published' | 'archived' | 'pending_review' | 'rejected';
  author?: string;
  isPrivate?: boolean;
  videoProvider?: 'youtube' | 'vimeo' | 'internal' | 'other';
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

// Video pagination options
export interface VideoPaginationOptions {
  page?: number;
  limit?: number;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

// Video response
export interface VideoResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}
