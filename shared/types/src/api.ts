/**
 * API related type definitions
 */

// Import necessary types from other files
import { ApiResponse, PaginatedResponse } from './common';
import { User, UserProfile } from './user';
import { Content, ContentStatus, ContentApprovalWorkflow } from './content';

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface ApiRequestOptions {
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
}

export interface ApiErrorResponse {
  status: number;
  statusText: string;
  data: {
    message: string;
    errors?: Record<string, string[]>;
    code?: string;
  };
}

// Generic request and response types for CRUD operations
export interface CreateRequest<T> {
  data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
}

export interface UpdateRequest<T> {
  id: string;
  data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;
}

export interface DeleteRequest {
  id: string;
}

export interface GetByIdRequest {
  id: string;
}

export interface ListRequest {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filter?: Record<string, any>;
  search?: string;
}

// Specific API endpoints type definitions
export interface UserApiEndpoints {
  getUsers: (request: ListRequest) => Promise<ApiResponse<PaginatedResponse<User>>>;
  getUserById: (request: GetByIdRequest) => Promise<ApiResponse<User>>;
  createUser: (request: CreateRequest<User>) => Promise<ApiResponse<User>>;
  updateUser: (request: UpdateRequest<User>) => Promise<ApiResponse<User>>;
  deleteUser: (request: DeleteRequest) => Promise<ApiResponse<void>>;
  getUserProfile: (userId: string) => Promise<ApiResponse<UserProfile>>;
  updateUserProfile: (userId: string, data: Partial<UserProfile>) => Promise<ApiResponse<UserProfile>>;
}

export interface ContentApiEndpoints {
  getContents: (request: ListRequest) => Promise<ApiResponse<PaginatedResponse<Content>>>;
  getContentById: (request: GetByIdRequest) => Promise<ApiResponse<Content>>;
  createContent: (request: CreateRequest<Content>) => Promise<ApiResponse<Content>>;
  updateContent: (request: UpdateRequest<Content>) => Promise<ApiResponse<Content>>;
  deleteContent: (request: DeleteRequest) => Promise<ApiResponse<void>>;
  getContentApprovalWorkflows: (contentId: string) => Promise<ApiResponse<ContentApprovalWorkflow[]>>;
  updateContentStatus: (contentId: string, status: ContentStatus) => Promise<ApiResponse<Content>>;
}

// End of API related type definitions
