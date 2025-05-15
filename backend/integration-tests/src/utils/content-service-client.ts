import { ApiClient } from './api-client';

/**
 * Content Service client
 */
export class ContentServiceClient {
  private client: ApiClient;

  /**
   * Create a new Content Service client
   * @param baseUrl - Base URL for the Content Service
   */
  constructor(baseUrl: string = 'http://localhost:3003/api/content') {
    this.client = new ApiClient(baseUrl);
  }

  /**
   * Set the authentication token for subsequent requests
   * @param token - JWT token
   */
  setAuthToken(token: string): void {
    this.client.setAuthToken(token);
  }

  /**
   * Get a list of content items
   * @param page - Page number
   * @param limit - Number of items per page
   * @returns Promise with the content items response
   */
  async getContentItems(page: number = 1, limit: number = 10): Promise<any> {
    return this.client.get(`/?page=${page}&limit=${limit}`);
  }

  /**
   * Get a content item by ID
   * @param contentId - Content ID
   * @returns Promise with the content item response
   */
  async getContentById(contentId: string): Promise<any> {
    return this.client.get(`/${contentId}`);
  }

  /**
   * Create a new content item
   * @param contentData - Content data
   * @returns Promise with the content creation response
   */
  async createContent(contentData: {
    title: string;
    body: string;
    type: string;
    tags?: string[];
    category?: string;
    publishDate?: Date;
    isPublished?: boolean;
  }): Promise<any> {
    return this.client.post('/', contentData);
  }

  /**
   * Update a content item
   * @param contentId - Content ID
   * @param contentData - Content data to update
   * @returns Promise with the content update response
   */
  async updateContent(contentId: string, contentData: any): Promise<any> {
    return this.client.put(`/${contentId}`, contentData);
  }

  /**
   * Delete a content item
   * @param contentId - Content ID
   * @returns Promise with the content deletion response
   */
  async deleteContent(contentId: string): Promise<any> {
    return this.client.delete(`/${contentId}`);
  }

  /**
   * Get content analytics
   * @param contentId - Content ID
   * @returns Promise with the content analytics response
   */
  async getContentAnalytics(contentId: string): Promise<any> {
    return this.client.get(`/${contentId}/analytics`);
  }

  /**
   * Track content view
   * @param contentId - Content ID
   * @returns Promise with the content view tracking response
   */
  async trackContentView(contentId: string): Promise<any> {
    return this.client.post(`/${contentId}/view`, {});
  }

  /**
   * Search content
   * @param query - Search query
   * @param page - Page number
   * @param limit - Number of items per page
   * @returns Promise with the search response
   */
  async searchContent(query: string, page: number = 1, limit: number = 10): Promise<any> {
    return this.client.get(`/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
  }
}
