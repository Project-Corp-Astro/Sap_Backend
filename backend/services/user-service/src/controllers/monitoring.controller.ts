/**
 * Monitoring Controller
 * Provides endpoints for monitoring service health and performance
 */

import { Request, Response } from 'express';
import mongoose from 'mongoose';
import os from 'os';
import performanceMonitor from '../utils/performance';
import logger from '../utils/logger';
import redisUtils from '../utils/redis';

/**
 * Get service health status
 * @param req - Express request
 * @param res - Express response
 */
export const getHealth = async (req: Request, res: Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  // Check Redis health
  let redisStatus = 'disconnected';
  try {
    const redisConnected = await redisUtils.redisUtils.pingRedis();
    redisStatus = redisConnected ? 'connected' : 'disconnected';
  } catch (error) {
    logger.error('Redis health check failed', { error });
  }
  
  res.status(200).json({ 
    status: dbStatus === 'connected' && redisStatus === 'connected' ? 'ok' : 'degraded', 
    service: 'user-service',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      name: mongoose.connection.name,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
    },
    cache: {
      status: redisStatus,
      type: 'redis',
      name: 'userCache'
    },
    uptime: process.uptime(),
  });
};

/**
 * Get detailed performance metrics
 * @param req - Express request
 * @param res - Express response
 */
export const getMetrics = (req: Request, res: Response) => {
  try {
    const metrics = performanceMonitor.getMetrics();
    
    res.status(200).json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Error retrieving metrics', { error });
    res.status(500).json({
      success: false,
      message: 'Error retrieving metrics',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * Get system information
 * @param req - Express request
 * @param res - Express response
 */
export const getSystemInfo = (req: Request, res: Response) => {
  try {
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAvg: os.loadavg(),
      uptime: os.uptime(),
      processUptime: process.uptime(),
      nodeVersion: process.version,
      pid: process.pid,
    };
    
    res.status(200).json({
      success: true,
      systemInfo
    });
  } catch (error) {
    logger.error('Error retrieving system info', { error });
    res.status(500).json({
      success: false,
      message: 'Error retrieving system info',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

/**
 * Reset performance metrics
 * @param req - Express request
 * @param res - Express response
 */
export const resetMetrics = (req: Request, res: Response) => {
  try {
    // Only allow in development or with admin authorization
    if (process.env.NODE_ENV !== 'development') {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
      
      // In production, would verify admin token here
    }
    
    // Reset metrics
    performanceMonitor.resetMetrics();
    
    res.status(200).json({
      success: true,
      message: 'Performance metrics reset successfully'
    });
  } catch (error) {
    logger.error('Error resetting metrics', { error });
    res.status(500).json({
      success: false,
      message: 'Error resetting metrics',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};
