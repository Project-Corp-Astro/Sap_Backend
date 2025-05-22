/**
 * Health Check Controller
 * Provides endpoints to check the health of the application and its dependencies
 */

import { Request, Response } from 'express';
import { createServiceLogger } from '../../shared/utils/logger';
import dbManager from '../utils/DatabaseManager';
import redisClient from '../../shared/utils/redis';
import esClient from '../../shared/utils/elasticsearch';
import os from 'os';
import { version } from '../../package.json';

const logger = createServiceLogger('health-controller');

export class HealthController {
  /**
   * Simple health check endpoint
   * @param req - Express request
   * @param res - Express response
   */
  public check = async (req: Request, res: Response): Promise<Response> => {
    try {
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'sap-backend',
        version
      });
    } catch (error) {
      logger.error('Health check failed', { error: (error as Error).message });
      return res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Detailed health check endpoint
   * @param req - Express request
   * @param res - Express response
   */
  public detailed = async (req: Request, res: Response): Promise<Response> => {
    try {
      // Get database statuses
      const dbStatuses = dbManager.getAllStatuses();
      
      // Get Redis status from the database manager
      const redisStatus = dbStatuses.redis;
      
      // Add error property if not present
      if (!redisStatus.error) {
        redisStatus.error = null;
      }
      
      // Get Elasticsearch status
      const esStatus = esClient.getStatus();
      
      // Get system info
      const systemInfo = {
        uptime: process.uptime(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          process: process.memoryUsage()
        },
        cpu: {
          load: os.loadavg(),
          cores: os.cpus().length
        },
        hostname: os.hostname(),
        platform: os.platform(),
        nodeVersion: process.version
      };
      
      // Determine overall status
      const isMongoConnected = dbStatuses.mongo.isConnected;
      const isPgConnected = dbStatuses.postgres?.isConnected || false; // Handle case where postgres is not available
      const isRedisConnected = redisStatus.isConnected;
      
      // Check which databases are using mock implementations
      const mongoUsingMock = dbStatuses.mongo.usingMock;
      const pgUsingMock = dbStatuses.postgres?.usingMock || false;
      const redisUsingMock = redisStatus.usingMock;
      const esUsingMock = esStatus.usingMock;
      
      // MongoDB and Redis are required, PostgreSQL and Elasticsearch are optional
      const isHealthy = isMongoConnected && isRedisConnected;
      
      return res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        service: 'sap-backend',
        version,
        databases: {
          mongodb: {
            status: isMongoConnected ? 'connected' : 'disconnected',
            usingMock: dbStatuses.mongo.usingMock || false,
            details: dbStatuses.mongo
          },
          postgresql: {
            status: isPgConnected ? 'connected' : 'disconnected',
            usingMock: dbStatuses.postgres?.usingMock || false,
            details: dbStatuses.postgres || { isConnected: false, message: 'PostgreSQL support is disabled' }
          },
          redis: {
            status: isRedisConnected ? 'connected' : 'disconnected',
            usingMock: redisStatus.usingMock || false,
            details: redisStatus
          },
          elasticsearch: {
            status: esStatus.isConnected ? 'connected' : 'disconnected',
            usingMock: esStatus.usingMock || false,
            details: esStatus
          }
        },
        system: systemInfo
      });
    } catch (error) {
      logger.error('Detailed health check failed', { error: (error as Error).message });
      return res.status(500).json({
        status: 'error',
        message: 'Detailed health check failed',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      });
    }
  }

  /**
   * Database-specific health check endpoint
   * @param req - Express request
   * @param res - Express response
   */
  public database = async (req: Request, res: Response): Promise<Response> => {
    try {
      const dbType = req.params.type;
      
      if (!['mongo', 'postgres', 'redis', 'elasticsearch', 'all'].includes(dbType)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid database type',
          validTypes: ['mongo', 'postgres', 'redis', 'elasticsearch', 'all']
        });
      }
      
      if (dbType === 'all') {
        const dbStatuses = dbManager.getAllStatuses();
        
        return res.status(200).json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          databases: dbStatuses
        });
      }
      
      let status;
      
      switch (dbType) {
        case 'mongo':
          status = dbManager.getMongoStatus();
          break;
        // case 'postgres':
        //   status = dbManager.getPgStatus();
        //   break;
        case 'redis':
          try {
            await redisClient.getClient().ping();
            status = { isConnected: true };
          } catch (error) {
            status = { isConnected: false, error: (error as Error).message };
          }
          break;
        case 'elasticsearch':
          status = esClient.getStatus();
          break;
      }
      
      return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: dbType,
        details: status
      });
    } catch (error) {
      logger.error('Database health check failed', { error: (error as Error).message });
      return res.status(500).json({
        status: 'error',
        message: 'Database health check failed',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      });
    }
  }
}

// Create and export a singleton instance
const healthController = new HealthController();
export default healthController;
