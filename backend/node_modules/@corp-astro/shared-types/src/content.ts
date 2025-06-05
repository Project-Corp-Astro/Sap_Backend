/**
 * Content related type definitions
 */

export interface Content {
  id: string;
  title: string;
  description?: string;
  body: string;
  status: ContentStatus;
  type: ContentType;
  author: string; // User ID
  tags?: string[];
  categories?: string[];
  featuredImage?: string;
  slug: string;
  metadata?: ContentMetadata;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  expiresAt?: Date;
}

export enum ContentStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  REJECTED = 'rejected',
  REVISION = 'revision'
}

export enum ContentType {
  ARTICLE = 'article',
  PAGE = 'page',
  NEWS = 'news',
  ANNOUNCEMENT = 'announcement',
  DOCUMENTATION = 'documentation',
  POLICY = 'policy'
}

export interface ContentMetadata {
  seo?: SeoMetadata;
  viewCount?: number;
  readTime?: number;
  customFields?: Record<string, any>;
}

export interface SeoMetadata {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  ogImage?: string;
  canonicalUrl?: string;
}

export interface ContentFilter {
  status?: ContentStatus;
  type?: ContentType;
  author?: string;
  tags?: string[];
  categories?: string[];
  fromDate?: Date;
  toDate?: Date;
  search?: string;
}

export interface ContentApprovalWorkflow {
  id: string;
  contentId: string;
  status: WorkflowStatus;
  approvers: WorkflowApprover[];
  currentStage: number;
  history: WorkflowHistoryItem[];
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
}

export enum WorkflowStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled'
}

export interface WorkflowApprover {
  userId: string;
  stage: number;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  actionDate?: Date;
}

export interface WorkflowHistoryItem {
  timestamp: Date;
  userId: string;
  action: string;
  comments?: string;
  stage?: number;
}
