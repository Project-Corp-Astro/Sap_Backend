/**
 * Common type definitions used throughout the application
 */
export interface PaginatedResponse<T> {
    data: T[];
    pagination: Pagination;
}
export interface Pagination {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
}
export interface ApiError {
    statusCode: number;
    message: string;
    errors?: Record<string, string[]>;
    timestamp: string;
    path?: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: ApiError;
    message?: string;
}
export interface SystemAlert {
    id: string;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    timestamp: Date;
    isRead: boolean;
    category: 'system' | 'security' | 'performance' | 'user' | 'content';
    link?: string;
    expiresAt?: Date;
}
export interface AuditLog {
    id: string;
    userId: string;
    action: string;
    resource: string;
    resourceId?: string;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, any>;
}
export interface SearchFilter {
    query: string;
    filters?: Record<string, any>;
    sort?: {
        field: string;
        direction: 'asc' | 'desc';
    };
    pagination?: {
        page: number;
        limit: number;
    };
}
