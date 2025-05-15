/**
 * Common interfaces used across the application
 */

/**
 * Pagination result interface for list responses
 */
export interface PaginationResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  limit: number;
}

/**
 * Filter options interface for queries
 */
export interface FilterOptions {
  [key: string]: any;
}

/**
 * Pagination options interface
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: {
    [key: string]: 1 | -1;
  };
}
