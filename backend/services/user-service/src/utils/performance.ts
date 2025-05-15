/**
 * Performance monitoring utility for User Service
 * Tracks response times, database operations, and system resources
 */

import os from 'os';
import { Request, Response, NextFunction } from 'express';
import logger from './logger';

class PerformanceMonitor {
  private metrics = {} as {
    responseTime: {
      total: number;
      count: number;
      average: number;
      min: number;
      max: number;
      byEndpoint: Record<string, { total: number; count: number; average: number }>;
    };
    database: {
      operations: number;
      queryTime: {
        total: number;
        average: number;
      };
      byOperation: Record<string, { total: number; count: number; average: number }>;
    };
    memory: {
      usage: number;
      free: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      loadAvg: number[];
    };
    errors: {
      count: number;
      byType: Record<string, number>;
    };
    startTime: number;
    uptime: number;
  };

  constructor() {
    // Initialize metrics
    this.resetMetrics();
    
    // Update system metrics every minute
    setInterval(() => this.updateSystemMetrics(), 60000);
    
    // Log performance metrics every 5 minutes
    setInterval(() => this.logPerformanceMetrics(), 300000);
  }

  /**
   * Reset all metrics to initial values
   */
  resetMetrics(): void {
    this.metrics = {
      responseTime: {
        total: 0,
        count: 0,
        average: 0,
        min: Number.MAX_SAFE_INTEGER,
        max: 0,
        byEndpoint: {},
      },
      database: {
        operations: 0,
        queryTime: {
          total: 0,
          average: 0,
        },
        byOperation: {},
      },
      memory: {
        usage: 0,
        free: 0,
        total: 0,
        percentage: 0,
      },
      cpu: {
        usage: 0,
        loadAvg: [0, 0, 0],
      },
      errors: {
        count: 0,
        byType: {},
      },
      startTime: Date.now(),
      uptime: 0,
    };
    
    // Initialize system metrics
    this.updateSystemMetrics();
  }

  /**
   * Track response time for an API request
   * @param startTime - Start time in milliseconds
   * @param endTime - End time in milliseconds
   * @param endpoint - API endpoint
   * @param statusCode - HTTP status code
   */
  trackResponseTime(startTime: number, endTime: number, endpoint: string, statusCode: number): void {
    const duration = endTime - startTime;
    
    // Update overall response time metrics
    this.metrics.responseTime.total += duration;
    this.metrics.responseTime.count++;
    this.metrics.responseTime.average = this.metrics.responseTime.total / this.metrics.responseTime.count;
    this.metrics.responseTime.min = Math.min(this.metrics.responseTime.min, duration);
    this.metrics.responseTime.max = Math.max(this.metrics.responseTime.max, duration);
    
    // Update endpoint-specific metrics
    if (!this.metrics.responseTime.byEndpoint[endpoint]) {
      this.metrics.responseTime.byEndpoint[endpoint] = {
        total: 0,
        count: 0,
        average: 0,
      };
    }
    
    this.metrics.responseTime.byEndpoint[endpoint].total += duration;
    this.metrics.responseTime.byEndpoint[endpoint].count++;
    this.metrics.responseTime.byEndpoint[endpoint].average = 
      this.metrics.responseTime.byEndpoint[endpoint].total / 
      this.metrics.responseTime.byEndpoint[endpoint].count;
    
    // Track errors
    if (statusCode >= 400) {
      this.trackError(`HTTP${statusCode}`);
    }
    
    // Log slow responses (over 1000ms)
    if (duration > 1000) {
      logger.warn(`Slow response detected: ${endpoint} took ${duration}ms`, {
        endpoint,
        duration,
        statusCode,
      });
    }
  }

  /**
   * Track database operation performance
   * @param operation - Database operation type (find, update, etc.)
   * @param duration - Operation duration in milliseconds
   */
  trackDatabaseOperation(operation: string, duration: number): void {
    // Update overall database metrics
    this.metrics.database.operations++;
    this.metrics.database.queryTime.total += duration;
    this.metrics.database.queryTime.average = 
      this.metrics.database.queryTime.total / this.metrics.database.operations;
    
    // Update operation-specific metrics
    if (!this.metrics.database.byOperation[operation]) {
      this.metrics.database.byOperation[operation] = {
        total: 0,
        count: 0,
        average: 0,
      };
    }
    
    this.metrics.database.byOperation[operation].total += duration;
    this.metrics.database.byOperation[operation].count++;
    this.metrics.database.byOperation[operation].average = 
      this.metrics.database.byOperation[operation].total / 
      this.metrics.database.byOperation[operation].count;
    
    // Log slow database operations (over 500ms)
    if (duration > 500) {
      logger.warn(`Slow database operation detected: ${operation} took ${duration}ms`, {
        operation,
        duration,
      });
    }
  }

  /**
   * Track error occurrence
   * @param errorType - Type of error
   */
  trackError(errorType: string): void {
    this.metrics.errors.count++;
    
    if (!this.metrics.errors.byType[errorType]) {
      this.metrics.errors.byType[errorType] = 0;
    }
    
    this.metrics.errors.byType[errorType]++;
  }

  /**
   * Update system metrics (CPU, memory)
   */
  updateSystemMetrics(): void {
    // Update memory metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    this.metrics.memory.total = totalMemory;
    this.metrics.memory.free = freeMemory;
    this.metrics.memory.usage = usedMemory;
    this.metrics.memory.percentage = (usedMemory / totalMemory) * 100;
    
    // Update CPU metrics
    this.metrics.cpu.loadAvg = os.loadavg();
    this.metrics.cpu.usage = this.metrics.cpu.loadAvg[0] * 100 / os.cpus().length;
    
    // Update uptime
    this.metrics.uptime = (Date.now() - this.metrics.startTime) / 1000;
  }

  /**
   * Log current performance metrics
   */
  logPerformanceMetrics(): void {
    logger.info('Performance metrics', {
      responseTime: {
        average: this.metrics.responseTime.average,
        min: this.metrics.responseTime.min,
        max: this.metrics.responseTime.max,
        count: this.metrics.responseTime.count,
      },
      database: {
        operations: this.metrics.database.operations,
        averageQueryTime: this.metrics.database.queryTime.average,
      },
      memory: {
        usagePercentage: this.metrics.memory.percentage.toFixed(2) + '%',
        freeMemory: (this.metrics.memory.free / 1024 / 1024).toFixed(2) + 'MB',
      },
      cpu: {
        usage: this.metrics.cpu.usage.toFixed(2) + '%',
        loadAvg: this.metrics.cpu.loadAvg,
      },
      errors: {
        count: this.metrics.errors.count,
      },
      uptime: this.metrics.uptime,
    });
  }

  /**
   * Get all performance metrics
   * @returns Current performance metrics
   */
  getMetrics(): any {
    // Update system metrics before returning
    this.updateSystemMetrics();
    
    return {
      ...this.metrics,
      timestamp: new Date().toISOString(),
    };
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

/**
 * Express middleware to track request performance
 */
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Override end method to capture response time
  const originalEnd = res.end;
  
  // @ts-ignore - Ignoring type errors for res.end override to maintain compatibility
  res.end = function(this: any, chunk: any, encodingOrCallback?: any, callback?: any): any {
    const endTime = Date.now();
    const endpoint = req.originalUrl || req.url;
    
    // Track response time
    performanceMonitor.trackResponseTime(startTime, endTime, endpoint, res.statusCode);
    
    // Call original end method
    // @ts-ignore - Ignoring type errors for arguments to maintain compatibility
    return originalEnd.apply(this, arguments);
  };
  
  next();
};

/**
 * Track database operation performance
 * @param operation - Operation name
 * @param callback - Database operation callback
 * @returns Result of the callback
 */
export const trackDatabaseOperation = async <T>(operation: string, callback: () => Promise<T>): Promise<T> => {
  const startTime = Date.now();
  
  try {
    return await callback();
  } catch (error) {
    performanceMonitor.trackError(`DB:${operation}`);
    throw error;
  } finally {
    const endTime = Date.now();
    performanceMonitor.trackDatabaseOperation(operation, endTime - startTime);
  }
}

export default performanceMonitor;
