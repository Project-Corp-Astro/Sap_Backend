import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * API Client for making HTTP requests to the microservices
 */
export class ApiClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private authToken?: string;

  /**
   * Create a new API client
   * @param baseUrl - Base URL for the service
   * @param config - Axios request configuration
   */
  constructor(baseUrl: string, config: AxiosRequestConfig = {}) {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      ...config,
    });
  }

  /**
   * Set the authentication token for subsequent requests
   * @param token - JWT token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear the authentication token
   */
  clearAuthToken(): void {
    this.authToken = undefined;
  }

  /**
   * Get the current authentication token
   * @returns The current authentication token
   */
  getAuthToken(): string | undefined {
    return this.authToken;
  }

  /**
   * Make a GET request
   * @param url - Request URL
   * @param config - Axios request configuration
   * @returns Promise with the response data
   */
  async get<T = any>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    const headers = this.authToken
      ? { ...config.headers, Authorization: `Bearer ${this.authToken}` }
      : config.headers;

    const response: AxiosResponse<T> = await this.client.get(url, {
      ...config,
      headers,
    });

    return response.data;
  }

  /**
   * Make a POST request
   * @param url - Request URL
   * @param data - Request body
   * @param config - Axios request configuration
   * @returns Promise with the response data
   */
  async post<T = any>(url: string, data: any, config: AxiosRequestConfig = {}): Promise<T> {
    const headers = this.authToken
      ? { ...config.headers, Authorization: `Bearer ${this.authToken}` }
      : config.headers;

    const response: AxiosResponse<T> = await this.client.post(url, data, {
      ...config,
      headers,
    });

    return response.data;
  }

  /**
   * Make a PUT request
   * @param url - Request URL
   * @param data - Request body
   * @param config - Axios request configuration
   * @returns Promise with the response data
   */
  async put<T = any>(url: string, data: any, config: AxiosRequestConfig = {}): Promise<T> {
    const headers = this.authToken
      ? { ...config.headers, Authorization: `Bearer ${this.authToken}` }
      : config.headers;

    const response: AxiosResponse<T> = await this.client.put(url, data, {
      ...config,
      headers,
    });

    return response.data;
  }

  /**
   * Make a DELETE request
   * @param url - Request URL
   * @param config - Axios request configuration
   * @returns Promise with the response data
   */
  async delete<T = any>(url: string, config: AxiosRequestConfig = {}): Promise<T> {
    const headers = this.authToken
      ? { ...config.headers, Authorization: `Bearer ${this.authToken}` }
      : config.headers;

    const response: AxiosResponse<T> = await this.client.delete(url, {
      ...config,
      headers,
    });

    return response.data;
  }
}
