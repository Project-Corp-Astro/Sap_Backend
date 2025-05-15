/**
 * Search Service
 * Provides search functionality using Elasticsearch
 */

import esClient from '../../shared/utils/elasticsearch';
import { createServiceLogger } from '../../shared/utils/logger';
import redisClient from '../../shared/utils/redis';

const logger = createServiceLogger('search-service');
const CACHE_TTL = 300; // 5 minutes

export class SearchService {
  /**
   * Search content
   * @param query - Search query
   * @param filters - Search filters
   * @param page - Page number
   * @param limit - Results per page
   * @returns Search results
   */
  async searchContent(
    query: string,
    filters: Record<string, any> = {},
    page: number = 1,
    limit: number = 10
  ): Promise<any> {
    try {
      const from = (page - 1) * limit;
      
      // Generate cache key based on query, filters, and pagination
      const cacheKey = `search:content:${query}:${JSON.stringify(filters)}:${page}:${limit}`;
      
      // Try to get from cache first
      const cachedResults = await redisClient.get(cacheKey);
      if (cachedResults) {
        logger.debug('Content search results found in cache');
        return cachedResults;
      }
      
      // Build Elasticsearch query
      const esQuery: any = {
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ['title^3', 'content', 'summary^2', 'tags^2'],
                  type: 'best_fields',
                  operator: 'and',
                  fuzziness: 'AUTO'
                }
              }
            ],
            filter: []
          }
        },
        highlight: {
          fields: {
            title: { number_of_fragments: 0 },
            content: { number_of_fragments: 3, fragment_size: 150 },
            summary: { number_of_fragments: 1, fragment_size: 150 }
          },
          pre_tags: ['<strong>'],
          post_tags: ['</strong>']
        },
        sort: [
          { _score: { order: 'desc' } },
          { publishedAt: { order: 'desc' } }
        ],
        aggs: {
          categories: {
            terms: { field: 'categoryName.keyword', size: 10 }
          },
          tags: {
            terms: { field: 'tags', size: 20 }
          },
          date_histogram: {
            date_histogram: {
              field: 'publishedAt',
              calendar_interval: 'month'
            }
          }
        }
      };
      
      // Add filters
      if (filters.categoryId) {
        esQuery.query.bool.filter.push({
          term: { categoryId: filters.categoryId }
        });
      }
      
      if (filters.tags && filters.tags.length > 0) {
        esQuery.query.bool.filter.push({
          terms: { tags: filters.tags }
        });
      }
      
      if (filters.status) {
        esQuery.query.bool.filter.push({
          term: { status: filters.status }
        });
      }
      
      if (filters.dateFrom || filters.dateTo) {
        const rangeFilter: any = {
          range: {
            publishedAt: {}
          }
        };
        
        if (filters.dateFrom) {
          rangeFilter.range.publishedAt.gte = filters.dateFrom;
        }
        
        if (filters.dateTo) {
          rangeFilter.range.publishedAt.lte = filters.dateTo;
        }
        
        esQuery.query.bool.filter.push(rangeFilter);
      }
      
      // Execute search
      const results = await esClient.search('content', esQuery, from, limit);
      
      // Format results
      const formattedResults = {
        items: results.hits.map((hit: any) => ({
          id: hit._id,
          score: hit._score,
          ...hit._source,
          highlights: hit.highlight || {}
        })),
        total: results.total.value || 0,
        page,
        limit,
        totalPages: Math.ceil((results.total.value || 0) / limit),
        aggregations: results.aggregations
      };
      
      // Cache results
      await redisClient.set(cacheKey, formattedResults, CACHE_TTL);
      
      return formattedResults;
    } catch (error) {
      logger.error('Error searching content', { error: (error as Error).message, query });
      throw error;
    }
  }

  /**
   * Search users
   * @param query - Search query
   * @param filters - Search filters
   * @param page - Page number
   * @param limit - Results per page
   * @returns Search results
   */
  async searchUsers(
    query: string,
    filters: Record<string, any> = {},
    page: number = 1,
    limit: number = 10
  ): Promise<any> {
    try {
      const from = (page - 1) * limit;
      
      // Generate cache key based on query, filters, and pagination
      const cacheKey = `search:users:${query}:${JSON.stringify(filters)}:${page}:${limit}`;
      
      // Try to get from cache first
      const cachedResults = await redisClient.get(cacheKey);
      if (cachedResults) {
        logger.debug('User search results found in cache');
        return cachedResults;
      }
      
      // Build Elasticsearch query
      const esQuery: any = {
        query: {
          bool: {
            should: [
              {
                multi_match: {
                  query,
                  fields: ['displayName^3', 'firstName^2', 'lastName^2', 'email', 'username', 'bio'],
                  type: 'best_fields',
                  operator: 'and',
                  fuzziness: 'AUTO'
                }
              }
            ],
            filter: []
          }
        },
        sort: [
          { _score: { order: 'desc' } },
          { lastLogin: { order: 'desc' } }
        ],
        aggs: {
          roles: {
            terms: { field: 'role.keyword', size: 10 }
          }
        }
      };
      
      // Add filters
      if (filters.role) {
        esQuery.query.bool.filter.push({
          term: { role: filters.role }
        });
      }
      
      // Execute search
      const results = await esClient.search('users', esQuery, from, limit);
      
      // Format results
      const formattedResults = {
        items: results.hits.map((hit: any) => ({
          id: hit._id,
          score: hit._score,
          ...hit._source
        })),
        total: results.total.value || 0,
        page,
        limit,
        totalPages: Math.ceil((results.total.value || 0) / limit),
        aggregations: results.aggregations
      };
      
      // Cache results
      await redisClient.set(cacheKey, formattedResults, CACHE_TTL);
      
      return formattedResults;
    } catch (error) {
      logger.error('Error searching users', { error: (error as Error).message, query });
      throw error;
    }
  }

  /**
   * Get suggestions for autocomplete
   * @param query - Search query
   * @param field - Field to get suggestions from
   * @param limit - Maximum number of suggestions
   * @returns Array of suggestions
   */
  async getSuggestions(query: string, field: string = 'title', limit: number = 5): Promise<string[]> {
    try {
      // Generate cache key
      const cacheKey = `search:suggestions:${field}:${query}:${limit}`;
      
      // Try to get from cache first
      const cachedSuggestions = await redisClient.get(cacheKey);
      if (cachedSuggestions) {
        logger.debug('Suggestions found in cache');
        return cachedSuggestions;
      }
      
      // Build Elasticsearch query
      const esQuery: any = {
        query: {
          match_phrase_prefix: {
            [field]: {
              query,
              max_expansions: 10
            }
          }
        },
        _source: [field],
        size: limit
      };
      
      // Execute search
      const results = await esClient.search('content', esQuery);
      
      // Extract suggestions
      const suggestions = results.hits
        .map((hit: any) => hit._source[field])
        .filter((value: any, index: number, self: any[]) => self.indexOf(value) === index);
      
      // Cache suggestions
      await redisClient.set(cacheKey, suggestions, CACHE_TTL);
      
      return suggestions;
    } catch (error) {
      logger.error('Error getting suggestions', { error: (error as Error).message, query, field });
      throw error;
    }
  }

  /**
   * Index content document
   * @param content - Content document
   * @returns Elasticsearch response
   */
  async indexContent(content: any): Promise<any> {
    try {
      const response = await esClient.indexDocument('content', content.id, {
        id: content.id,
        title: content.title,
        slug: content.slug,
        content: content.content,
        summary: content.summary,
        categoryId: content.categoryId,
        categoryName: content.category?.name,
        tags: content.tags,
        author: {
          id: content.createdBy?.id,
          name: content.createdBy?.displayName || content.createdBy?.username
        },
        status: content.status,
        publishedAt: content.publishedAt,
        createdAt: content.createdAt,
        updatedAt: content.updatedAt
      });
      
      // Invalidate related caches
      await this.invalidateContentCaches(content.id);
      
      return response;
    } catch (error) {
      logger.error('Error indexing content', { error: (error as Error).message, contentId: content.id });
      throw error;
    }
  }

  /**
   * Index user document
   * @param user - User document
   * @returns Elasticsearch response
   */
  async indexUser(user: any): Promise<any> {
    try {
      const response = await esClient.indexDocument('users', user.id, {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role?.name,
        bio: user.bio,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      });
      
      // Invalidate related caches
      await this.invalidateUserCaches(user.id);
      
      return response;
    } catch (error) {
      logger.error('Error indexing user', { error: (error as Error).message, userId: user.id });
      throw error;
    }
  }

  /**
   * Delete content document from index
   * @param contentId - Content ID
   * @returns Elasticsearch response
   */
  async deleteContent(contentId: string): Promise<any> {
    try {
      const response = await esClient.deleteDocument('content', contentId);
      
      // Invalidate related caches
      await this.invalidateContentCaches(contentId);
      
      return response;
    } catch (error) {
      logger.error('Error deleting content from index', { error: (error as Error).message, contentId });
      throw error;
    }
  }

  /**
   * Delete user document from index
   * @param userId - User ID
   * @returns Elasticsearch response
   */
  async deleteUser(userId: string): Promise<any> {
    try {
      const response = await esClient.deleteDocument('users', userId);
      
      // Invalidate related caches
      await this.invalidateUserCaches(userId);
      
      return response;
    } catch (error) {
      logger.error('Error deleting user from index', { error: (error as Error).message, userId });
      throw error;
    }
  }

  /**
   * Invalidate content-related caches
   * @param contentId - Content ID
   */
  private async invalidateContentCaches(contentId: string): Promise<void> {
    try {
      // Get all search:content:* keys
      const keys = await redisClient.keys('search:content:*');
      
      // Delete all search:content:* keys
      if (keys.length > 0) {
        await Promise.all(keys.map(key => redisClient.del(key)));
        logger.debug(`Invalidated ${keys.length} content search cache keys`);
      }
      
      // Delete specific content cache
      await redisClient.del(`content:${contentId}`);
    } catch (error) {
      logger.error('Error invalidating content caches', { error: (error as Error).message, contentId });
    }
  }

  /**
   * Invalidate user-related caches
   * @param userId - User ID
   */
  private async invalidateUserCaches(userId: string): Promise<void> {
    try {
      // Get all search:users:* keys
      const keys = await redisClient.keys('search:users:*');
      
      // Delete all search:users:* keys
      if (keys.length > 0) {
        await Promise.all(keys.map(key => redisClient.del(key)));
        logger.debug(`Invalidated ${keys.length} user search cache keys`);
      }
      
      // Delete specific user cache
      await redisClient.del(`user:${userId}`);
    } catch (error) {
      logger.error('Error invalidating user caches', { error: (error as Error).message, userId });
    }
  }
}

// Create and export a singleton instance
const searchService = new SearchService();
export default searchService;
