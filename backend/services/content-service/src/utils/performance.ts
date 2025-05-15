/**
 * Performance Monitoring Utility
 * 
 * This utility provides tools for monitoring and tracking performance metrics
 * in the Content Service, including:
 * - Response time tracking
 * - Cache hit/miss rates
 * - Database query performance
 * - Memory usage
 */

import logger from './logger.js';

/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
  // Cache metrics
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  
  // Response time metrics (in milliseconds)
  responseTimeAvg: number;
  responseTimeMin: number;
  responseTimeMax: number;
  
  // Database metrics
  dbQueryCount: number;
  dbQueryTimeAvg: number;
  dbQueryTimeTotal: number;
  
  // Memory usage
  memoryUsageMB: number;
  
  // Request metrics
  requestCount: number;
  errorCount: number;
  
  // Timestamp
  timestamp: Date;
}

/**
 * Cache operation type
 */
type CacheOperation = 'hit' | 'miss' | 'set' | 'delete';

/**
 * Performance monitoring class
 */
class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private responseTimes: number[] = [];
  private dbQueryTimes: number[] = [];
  private startTime: Date;
  private metricsInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    this.startTime = new Date();
    this.metrics = this.initializeMetrics();
    
    // Log metrics periodically (every 5 minutes by default)
    this.startMetricsLogging(5 * 60 * 1000);
  }
  
  /**
   * Initialize metrics with default values
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      responseTimeAvg: 0,
      responseTimeMin: 0,
      responseTimeMax: 0,
      dbQueryCount: 0,
      dbQueryTimeAvg: 0,
      dbQueryTimeTotal: 0,
      memoryUsageMB: this.getCurrentMemoryUsage(),
      requestCount: 0,
      errorCount: 0,
      timestamp: new Date()
    };
  }
  
  /**
   * Start periodic metrics logging
   * @param interval - Interval in milliseconds
   */
  public startMetricsLogging(interval: number = 5 * 60 * 1000): void {
    // Clear existing interval if any
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    // Set new interval
    this.metricsInterval = setInterval(() => {
      this.logMetrics();
    }, interval);
  }
  
  /**
   * Stop metrics logging
   */
  public stopMetricsLogging(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }
  
  /**
   * Get current memory usage in MB
   */
  private getCurrentMemoryUsage(): number {
    const memoryUsage = process.memoryUsage();
    return Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100;
  }
  
  /**
   * Track cache operation
   * @param operation - Cache operation type
   * @param key - Cache key
   */
  public trackCacheOperation(operation: CacheOperation, key: string): void {
    switch (operation) {
      case 'hit':
        this.metrics.cacheHits++;
        break;
      case 'miss':
        this.metrics.cacheMisses++;
        break;
      default:
        // Just log other operations
        break;
    }
    
    // Calculate cache hit rate
    const totalCacheOps = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRate = totalCacheOps > 0 
      ? Math.round((this.metrics.cacheHits / totalCacheOps) * 100) / 100
      : 0;
      
    // Log detailed cache operation for debugging in development
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`Cache ${operation}: ${key}`, {
        cacheOperation: operation,
        cacheKey: key,
        cacheHitRate: this.metrics.cacheHitRate
      });
    }
  }
  
  /**
   * Track response time
   * @param startTime - Start time in milliseconds
   * @param endTime - End time in milliseconds
   * @param route - API route
   * @param statusCode - HTTP status code
   */
  public trackResponseTime(
    startTime: number, 
    endTime: number, 
    route: string, 
    statusCode: number
  ): void {
    const responseTime = endTime - startTime;
    this.responseTimes.push(responseTime);
    
    // Update request count
    this.metrics.requestCount++;
    
    // Update error count if status code is 4xx or 5xx
    if (statusCode >= 400) {
      this.metrics.errorCount++;
    }
    
    // Calculate average, min, and max response times
    this.metrics.responseTimeAvg = this.calculateAverage(this.responseTimes);
    this.metrics.responseTimeMin = Math.min(...this.responseTimes);
    this.metrics.responseTimeMax = Math.max(...this.responseTimes);
    
    // Log response time for slow responses (> 1000ms)
    if (responseTime > 1000) {
      logger.warn(`Slow response: ${route} (${responseTime}ms)`, {
        route,
        responseTime,
        statusCode
      });
    }
  }
  
  /**
   * Track database query time
   * @param startTime - Start time in milliseconds
   * @param endTime - End time in milliseconds
   * @param operation - Database operation (find, update, etc.)
   * @param collection - Database collection
   */
  public trackDbQuery(
    startTime: number, 
    endTime: number, 
    operation: string, 
    collection: string
  ): void {
    const queryTime = endTime - startTime;
    this.dbQueryTimes.push(queryTime);
    
    // Update database metrics
    this.metrics.dbQueryCount++;
    this.metrics.dbQueryTimeTotal += queryTime;
    this.metrics.dbQueryTimeAvg = this.calculateAverage(this.dbQueryTimes);
    
    // Log slow queries (> 500ms)
    if (queryTime > 500) {
      logger.warn(`Slow DB query: ${operation} on ${collection} (${queryTime}ms)`, {
        operation,
        collection,
        queryTime
      });
    }
  }
  
  /**
   * Calculate average of an array of numbers
   * @param values - Array of numbers
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }
  
  /**
   * Log current metrics
   */
  public logMetrics(): void {
    // Update memory usage
    this.metrics.memoryUsageMB = this.getCurrentMemoryUsage();
    this.metrics.timestamp = new Date();
    
    // Log metrics
    logger.info('Performance metrics', {
      metrics: this.metrics,
      uptime: Math.round((Date.now() - this.startTime.getTime()) / 1000 / 60) + ' minutes'
    });
    
    // Reset certain metrics for the next period
    this.responseTimes = [];
    this.dbQueryTimes = [];
  }
  
  /**
   * Get current metrics
   */
  public getMetrics(): PerformanceMetrics {
    // Update memory usage before returning
    this.metrics.memoryUsageMB = this.getCurrentMemoryUsage();
    this.metrics.timestamp = new Date();
    return { ...this.metrics };
  }
  
  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.responseTimes = [];
    this.dbQueryTimes = [];
    logger.info('Performance metrics reset');
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
