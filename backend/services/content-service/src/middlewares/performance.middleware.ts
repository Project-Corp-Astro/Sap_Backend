/**
 * Performance Monitoring Middleware
 * 
 * This middleware tracks response times for all API requests and logs them
 * to help identify performance bottlenecks.
 */

import { Request, Response, NextFunction } from 'express';
import performanceMonitor from '../utils/performance.js';
import logger from '../utils/logger.js';

/**
 * Middleware to track response time for all API requests
 */
export function trackResponseTime(req: Request, res: Response, next: NextFunction): void {
  // Record start time
  const startTime = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to calculate response time
  // @ts-ignore - We need to override the end function to track response time
  res.end = function(this: Response, chunk?: any, encoding?: any, callback?: any): Response {
    // Calculate response time
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // Track response time in performance monitor
    performanceMonitor.trackResponseTime(
      startTime,
      endTime,
      req.originalUrl || req.url,
      res.statusCode
    );
    
    // Log slow responses (over 500ms)
    if (responseTime > 500) {
      logger.warn(`Slow response: ${req.method} ${req.originalUrl || req.url} (${responseTime}ms)`, {
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        responseTime,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress
      });
    }
    
    // Call original end function
    if (typeof encoding === 'function') {
      // Handle overload where encoding is actually the callback
      return originalEnd.call(this, chunk, encoding);
    } else {
      return originalEnd.call(this, chunk, encoding as BufferEncoding, callback);
    }
  };
  
  next();
}

/**
 * Middleware to track database query performance
 * This middleware should be applied to routes that make database queries
 */
export function trackDatabasePerformance(req: Request, res: Response, next: NextFunction): void {
  // Store the original mongoose exec function
  const mongoose = require('mongoose');
  const originalExec = mongoose.Query.prototype.exec;
  
  // Override the exec function to track query time
  mongoose.Query.prototype.exec = async function(...args: any[]) {
    const startTime = Date.now();
    const collection = this.model.collection.name;
    const operation = this.op;
    
    try {
      // Execute the original query
      const result = await originalExec.apply(this, args);
      
      // Track query time
      const endTime = Date.now();
      performanceMonitor.trackDbQuery(startTime, endTime, operation, collection);
      
      return result;
    } catch (error) {
      // Still track query time even if it fails
      const endTime = Date.now();
      performanceMonitor.trackDbQuery(startTime, endTime, operation, collection);
      
      throw error;
    }
  };
  
  next();
  
  // Restore original exec function after request is complete
  res.on('finish', () => {
    mongoose.Query.prototype.exec = originalExec;
  });
}

export default {
  trackResponseTime,
  trackDatabasePerformance
};
