/**
 * Monitoring Controller
 * 
 * This controller provides endpoints for monitoring the performance and health of the Content Service.
 * It exposes metrics such as cache hit rates, response times, and memory usage.
 */

import { Request, Response } from 'express';
import performanceMonitor from '../utils/performance';
import { cacheService } from '../utils/cache';
import { contentCache } from '../utils/redis';
import mongoose from 'mongoose';
import os from 'os';

class MonitoringController {
  /**
   * Get performance metrics
   * @param req - Express request object
   * @param res - Express response object
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    // Get performance metrics
    const metrics = performanceMonitor.getMetrics();
    
    // Get cache statistics
    const cacheStats = cacheService.getStats();
    
    // Get system information
    const systemInfo = {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuCount: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024),
      freeMemory: Math.round(os.freemem() / 1024 / 1024),
      loadAverage: os.loadavg()
    };
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics,
      cache: cacheStats,
      system: systemInfo
    });
  }
  
  /**
   * Reset performance metrics
   * @param req - Express request object
   * @param res - Express response object
   */
  async resetMetrics(req: Request, res: Response): Promise<void> {
    performanceMonitor.resetMetrics();
    
    res.status(200).json({
      success: true,
      message: 'Performance metrics reset successfully',
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Get health status
   * @param req - Express request object
   * @param res - Express response object
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    // Get system information
    const systemInfo = {
      uptime: process.uptime(),
      memory: {
        total: Math.round(os.totalmem() / 1024 / 1024),
        free: Math.round(os.freemem() / 1024 / 1024),
        used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024)
      },
      cpu: {
        count: os.cpus().length,
        loadAverage: os.loadavg()
      }
    };
    
    // Check if memory usage is critical (less than 10% free)
    const memoryUsagePercent = (os.freemem() / os.totalmem()) * 100;
    const memoryStatus = memoryUsagePercent < 10 ? 'critical' : 'healthy';
    
    // Check if CPU load is critical (load average > CPU count)
    const cpuStatus = os.loadavg()[0] > os.cpus().length ? 'critical' : 'healthy';
    
    // Check Redis health
    const redisConnected = await contentCache.ping();
    const redisStatus = redisConnected ? 'healthy' : 'critical';
    
    // Check Database health
    const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'critical';
    
    // Overall status is the worst of the individual statuses
    const status = [
      memoryStatus,
      cpuStatus,
      redisStatus,
      dbStatus
    ].includes('critical') ? 'critical' : 'healthy';
    
    res.status(status === 'healthy' ? 200 : 503).json({
      success: true,
      status,
      components: {
        memory: {
          status: memoryStatus,
          usagePercent: 100 - memoryUsagePercent
        },
        cpu: {
          status: cpuStatus,
          loadAverage: os.loadavg()[0],
          cpuCount: os.cpus().length
        },
        redis: {
          status: redisStatus,
          connected: redisConnected,
          caches: ['contentCache']
        },
        database: {
          status: dbStatus,
          name: mongoose.connection.name || 'undefined',
          host: mongoose.connection.host || 'undefined',
          readyState: mongoose.connection.readyState
        }
      },
      system: systemInfo,
      timestamp: new Date().toISOString()
    });
  }
}

export default new MonitoringController();
