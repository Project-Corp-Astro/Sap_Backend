/**
 * Database Monitoring Script
 * Monitors the health of all databases in the hybrid architecture
 * and provides insights into their performance and usage
 */

import { createServiceLogger } from '../../shared/utils/logger';
import dbManager from '../utils/DatabaseManager';
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const logger = createServiceLogger('monitor-databases');

interface DatabaseMetrics {
  name: string;
  status: 'connected' | 'disconnected' | 'degraded';
  connectionTime?: number;
  queryCount?: number;
  slowQueries?: number;
  errors?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  details?: any;
}

/**
 * Get MongoDB metrics
 */
async function getMongoMetrics(): Promise<DatabaseMetrics> {
  try {
    const status = dbManager.getMongoStatus();
    
    return {
      name: 'MongoDB',
      status: status.isConnected ? 'connected' : 'disconnected',
      connectionTime: status.details?.connectionTime,
      queryCount: status.details?.queryCount,
      slowQueries: status.details?.slowQueries?.length || 0,
      errors: status.details?.errors || 0,
      details: status
    };
  } catch (error) {
    logger.error('Error getting MongoDB metrics', { error: (error as Error).message });
    
    return {
      name: 'MongoDB',
      status: 'disconnected',
      errors: 1,
      details: { error: (error as Error).message }
    };
  }
}

/**
 * Get PostgreSQL metrics
 */
async function getPgMetrics(): Promise<DatabaseMetrics> {
  try {
    const status = dbManager.getPgStatus();
    
    return {
      name: 'PostgreSQL',
      status: status.isConnected ? 'connected' : 'disconnected',
      connectionTime: status.details?.connectionTime,
      queryCount: status.details?.queryCount,
      slowQueries: status.details?.slowQueries?.length || 0,
      errors: status.details?.errors || 0,
      details: status
    };
  } catch (error) {
    logger.error('Error getting PostgreSQL metrics', { error: (error as Error).message });
    
    return {
      name: 'PostgreSQL',
      status: 'disconnected',
      errors: 1,
      details: { error: (error as Error).message }
    };
  }
}

/**
 * Get Redis metrics
 */
async function getRedisMetrics(): Promise<DatabaseMetrics> {
  try {
    const isConnected = dbManager.getRedisStatus();
    
    return {
      name: 'Redis',
      status: isConnected ? 'connected' : 'disconnected',
      details: { isConnected }
    };
  } catch (error) {
    logger.error('Error getting Redis metrics', { error: (error as Error).message });
    
    return {
      name: 'Redis',
      status: 'disconnected',
      errors: 1,
      details: { error: (error as Error).message }
    };
  }
}

/**
 * Get Elasticsearch metrics
 */
async function getEsMetrics(): Promise<DatabaseMetrics> {
  try {
    const status = dbManager.getEsStatus();
    
    return {
      name: 'Elasticsearch',
      status: status.isConnected ? 'connected' : 'disconnected',
      details: status
    };
  } catch (error) {
    logger.error('Error getting Elasticsearch metrics', { error: (error as Error).message });
    
    return {
      name: 'Elasticsearch',
      status: 'disconnected',
      errors: 1,
      details: { error: (error as Error).message }
    };
  }
}

/**
 * Get system metrics
 */
function getSystemMetrics(): any {
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    loadAvg: os.loadavg(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    usedMemory: os.totalmem() - os.freemem(),
    uptime: os.uptime(),
    processMemory: process.memoryUsage(),
    nodeVersion: process.version
  };
}

/**
 * Write metrics to file
 */
function writeMetricsToFile(metrics: any, filename: string): void {
  try {
    const metricsDir = path.join(__dirname, '../../logs/metrics');
    
    // Create metrics directory if it doesn't exist
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }
    
    const filePath = path.join(metricsDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2));
    
    logger.info(`Metrics written to ${filePath}`);
  } catch (error) {
    logger.error('Error writing metrics to file', { error: (error as Error).message });
  }
}

/**
 * Main monitoring function
 */
async function monitorDatabases(): Promise<void> {
  logger.info('Starting database monitoring...');
  
  try {
    // Initialize database connections
    await dbManager.initializeAll();
    logger.info('Database connections initialized');
    
    // Get metrics
    const mongoMetrics = await getMongoMetrics();
    const pgMetrics = await getPgMetrics();
    const redisMetrics = await getRedisMetrics();
    const esMetrics = await getEsMetrics();
    const systemMetrics = getSystemMetrics();
    
    // Combine metrics
    const allMetrics = {
      timestamp: new Date().toISOString(),
      databases: {
        mongodb: mongoMetrics,
        postgresql: pgMetrics,
        redis: redisMetrics,
        elasticsearch: esMetrics
      },
      system: systemMetrics
    };
    
    // Log metrics summary
    logger.info('Database metrics collected', {
      mongodb: mongoMetrics.status,
      postgresql: pgMetrics.status,
      redis: redisMetrics.status,
      elasticsearch: esMetrics.status
    });
    
    // Write metrics to file
    const filename = `metrics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeMetricsToFile(allMetrics, filename);
    
    logger.info('Database monitoring completed successfully');
  } catch (error) {
    logger.error('Error during database monitoring', { error: (error as Error).message });
    process.exit(1);
  } finally {
    // Close database connections
    await dbManager.closeAll();
    logger.info('Database connections closed');
  }
}

// Run monitoring
monitorDatabases();
