// Type declarations for Jest mocks
import { MediaType } from '../../interfaces/media.interfaces.js';
import { ContentStatus } from '../../interfaces/content.interfaces.js';

// Media types
export interface MediaDocument {
  _id: string;
  title: string;
  description: string;
  type: MediaType;
  url: string;
  slug: string;
  status: ContentStatus;
  fileSize: number;
  mimeType: string;
  category: string;
  tags: string[];
  author: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
  viewCount: number;
  downloadCount: number;
}

export interface MediaResponse {
  data: MediaDocument[];
  totalCount: number;
  page: number;
  limit: number;
}

// Video types
export interface VideoDocument {
  _id: string;
  title: string;
  description: string;
  url: string;
  slug: string;
  status: ContentStatus;
  duration: number;
  videoProvider: string;
  videoId: string;
  category: string;
  tags: string[];
  author: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date;
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  shareCount: number;
  captions: {
    language: string;
    url: string;
  }[];
}

export interface VideoResponse {
  videos: VideoDocument[];
  totalCount: number;
  page: number;
  limit: number;
}
