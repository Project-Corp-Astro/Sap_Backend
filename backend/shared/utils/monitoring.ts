/**
 * Monitoring and metrics collection for SAP backend services
 * This module provides centralized monitoring capabilities across all microservices
 */

import os from 'os';
import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from './logger';

// Create a dedicated logger for monitoring
const monitoringLogger = createServiceLogger('monitoring-service');

// Define interfaces
interface SystemMetricsData {
  timestamp: string;
  cpu: {
    loadAvg: number[];
    cpus: number;
    utilization: NodeJS.CpuUsage;
  };
  memory: {
    total: number;
    free: number;
    usage: NodeJS.MemoryUsage;
  };
  uptime: {
    system: number;
    process: number;
  };
  network: {
    interfaces: Record<string, {
      address: string;
      netmask: string;
      family: string;
      internal: boolean;
    }[]>;
  };
}

interface ServiceInfo {
  name: string;
  description?: string;
  version?: string;
  endpoints?: string[];
  [key: string]: any;
}

interface ServiceHealthData {
  status?: 'ok' | 'degraded' | 'down' | 'unknown';
  metrics?: Record<string, any>;
}

interface ServiceHealthRecord extends ServiceInfo {
  status: string;
  lastChecked: Date | null;
  metrics: Record<string, any>;
  alerts: Alert[];
}

interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  threshold: number;
  value: number;
}

interface AlertThresholds {
  responseTime: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  [key: string]: number;
}

interface RequestData {
  path?: string;
  method?: string;
  query?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  [key: string]: any;
}

interface ResponseData {
  statusCode: number;
  headers?: Record<string, any>;
  [key: string]: any;
}

interface TrackedRequest {
  id: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  data?: RequestData;
  response?: ResponseData;
  completed: boolean;
  success?: boolean;
}

interface RequestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  avgResponseTime?: number;
  errorRate?: number;
  activeRequests?: number;
  timestamp?: string;
}

interface ExtendedRequest extends Request {
  requestId?: string;
}

interface ExtendedResponse extends Response {
  originalEnd?: (...args: any[]) => void;
}

// Basic system metrics collection
class SystemMetrics {
  /**
   * Get current system metrics
   * @returns System metrics
   */
  static getSystemMetrics(): SystemMetricsData {
    return {
      timestamp: new Date().toISOString(),
      cpu: {
        loadAvg: os.loadavg(),
        cpus: os.cpus().length,
        utilization: process.cpuUsage(),
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        usage: process.memoryUsage(),
      },
      uptime: {
        system: os.uptime(),
        process: process.uptime(),
      },
      network: {
        interfaces: Object.entries(os.networkInterfaces()).reduce((acc, [name, interfaces]) => {
          if (interfaces) {
            acc[name] = interfaces.map(({ address, netmask, family, internal }) => ({
              address, 
              netmask, 
              family: family || '', 
              internal
            }));
          }
          return acc;
        }, {} as Record<string, { address: string; netmask: string; family: string; internal: boolean }[]>)
      }
    };
  }
}

// Service health monitoring
class ServiceHealth {
  private services: Map<string, ServiceHealthRecord>;
  private lastChecks: Map<string, Date>;
  private alertThresholds: AlertThresholds;

  constructor() {
    this.services = new Map();
    this.lastChecks = new Map();
    this.alertThresholds = {
      responseTime: 500, // ms
      errorRate: 0.05, // 5%
      cpuUsage: 80, // percentage
      memoryUsage: 80, // percentage
    };
  }

  /**
   * Register a service for health monitoring
   * @param serviceId - Unique service identifier
   * @param serviceInfo - Service information
   */
  registerService(serviceId: string, serviceInfo: ServiceInfo): void {
    this.services.set(serviceId, {
      ...serviceInfo,
      status: 'unknown',
      lastChecked: null,
      metrics: {},
      alerts: [],
    });
    monitoringLogger.info(`Service registered for health monitoring: ${serviceId}`, { serviceInfo });
  }

  /**
   * Update service health status
   * @param serviceId - Service identifier
   * @param healthData - Health data
   */
  updateServiceHealth(serviceId: string, healthData: ServiceHealthData): void {
    if (!this.services.has(serviceId)) {
      monitoringLogger.warn(`Attempted to update health for unregistered service: ${serviceId}`);
      return;
    }

    const service = this.services.get(serviceId);
    if (!service) return;
    
    const now = new Date();
    
    // Update service data
    this.services.set(serviceId, {
      ...service,
      status: healthData.status || 'unknown',
      lastChecked: now,
      metrics: {
        ...service.metrics,
        ...(healthData.metrics || {}),
      },
      alerts: this.checkAlerts(serviceId, healthData),
    });

    this.lastChecks.set(serviceId, now);
    
    // Log health update
    monitoringLogger.debug(`Health update for service ${serviceId}`, { 
      serviceId, 
      status: healthData.status,
      metrics: healthData.metrics 
    });
  }

  /**
   * Check for alerts based on health data
   * @param serviceId - Service identifier
   * @param healthData - Health data
   * @returns Active alerts
   */
  checkAlerts(serviceId: string, healthData: ServiceHealthData): Alert[] {
    const alerts: Alert[] = [];
    const metrics = healthData.metrics || {};

    // Check response time
    if (metrics.responseTime && metrics.responseTime > this.alertThresholds.responseTime) {
      const alert: Alert = {
        id: `${serviceId}-high-response-time-${Date.now()}`,
        type: 'high-response-time',
        severity: 'warning',
        message: `High response time detected: ${metrics.responseTime}ms`,
        timestamp: new Date().toISOString(),
        threshold: this.alertThresholds.responseTime,
        value: metrics.responseTime,
      };
      alerts.push(alert);
      monitoringLogger.warn(alert.message, { serviceId, alert });
    }

    // Check error rate
    if (metrics.errorRate && metrics.errorRate > this.alertThresholds.errorRate) {
      const alert: Alert = {
        id: `${serviceId}-high-error-rate-${Date.now()}`,
        type: 'high-error-rate',
        severity: 'warning',
        message: `High error rate detected: ${(metrics.errorRate * 100).toFixed(2)}%`,
        timestamp: new Date().toISOString(),
        threshold: this.alertThresholds.errorRate,
        value: metrics.errorRate,
      };
      alerts.push(alert);
      monitoringLogger.warn(alert.message, { serviceId, alert });
    }

    // Check CPU usage
    if (metrics.cpuUsage && metrics.cpuUsage > this.alertThresholds.cpuUsage) {
      const alert: Alert = {
        id: `${serviceId}-high-cpu-usage-${Date.now()}`,
        type: 'high-cpu-usage',
        severity: 'warning',
        message: `High CPU usage detected: ${metrics.cpuUsage.toFixed(2)}%`,
        timestamp: new Date().toISOString(),
        threshold: this.alertThresholds.cpuUsage,
        value: metrics.cpuUsage,
      };
      alerts.push(alert);
      monitoringLogger.warn(alert.message, { serviceId, alert });
    }

    // Check memory usage
    if (metrics.memoryUsage && metrics.memoryUsage > this.alertThresholds.memoryUsage) {
      const alert: Alert = {
        id: `${serviceId}-high-memory-usage-${Date.now()}`,
        type: 'high-memory-usage',
        severity: 'warning',
        message: `High memory usage detected: ${metrics.memoryUsage.toFixed(2)}%`,
        timestamp: new Date().toISOString(),
        threshold: this.alertThresholds.memoryUsage,
        value: metrics.memoryUsage,
      };
      alerts.push(alert);
      monitoringLogger.warn(alert.message, { serviceId, alert });
    }

    return alerts;
  }

  /**
   * Get health status for all services
   * @returns Health status for all services
   */
  getAllServicesHealth(): Record<string, ServiceHealthRecord> {
    const result: Record<string, ServiceHealthRecord> = {};
    
    this.services.forEach((service, id) => {
      result[id] = { ...service };
    });
    
    return result;
  }

  /**
   * Get health status for a specific service
   * @param serviceId - Service identifier
   * @returns Health status for the service or null if not found
   */
  getServiceHealth(serviceId: string): ServiceHealthRecord | null {
    if (!this.services.has(serviceId)) {
      return null;
    }
    
    const service = this.services.get(serviceId);
    return service ? { ...service } : null;
  }

  /**
   * Set alert thresholds
   * @param thresholds - Alert thresholds
   */
  setAlertThresholds(thresholds: Partial<AlertThresholds>): void {
    // Create a new object with all properties from both objects
    const newThresholds: AlertThresholds = {
      responseTime: thresholds.responseTime || this.alertThresholds.responseTime,
      errorRate: thresholds.errorRate || this.alertThresholds.errorRate,
      cpuUsage: thresholds.cpuUsage || this.alertThresholds.cpuUsage,
      memoryUsage: thresholds.memoryUsage || this.alertThresholds.memoryUsage
    };
    
    // Assign the new object to alertThresholds
    this.alertThresholds = newThresholds;
    
    monitoringLogger.info('Alert thresholds updated', { thresholds: this.alertThresholds });
  }
}

// Request tracking for performance monitoring
class RequestTracker {
  private logger: any;
  private requests: Map<string, TrackedRequest>;
  private stats: RequestStats;

  constructor(logger?: any) {
    this.logger = logger || monitoringLogger;
    this.requests = new Map();
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
    };
  }

  /**
   * Start tracking a request
   * @param requestId - Request identifier
   * @param requestData - Request data
   * @returns Request identifier
   */
  startRequest(requestId?: string, requestData?: RequestData): string {
    const id = requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.requests.set(id, {
      id,
      startTime: Date.now(),
      data: requestData,
      completed: false,
    });
    
    return id;
  }

  /**
   * End tracking a request
   * @param requestId - Request identifier
   * @param responseData - Response data
   */
  endRequest(requestId: string, responseData: ResponseData): void {
    if (!this.requests.has(requestId)) {
      this.logger.warn(`Attempted to end tracking for unknown request: ${requestId}`);
      return;
    }
    
    const request = this.requests.get(requestId);
    if (!request) return;
    
    const endTime = Date.now();
    const duration = endTime - request.startTime;
    const success = responseData.statusCode < 400;
    
    // Update request data
    this.requests.set(requestId, {
      ...request,
      endTime,
      duration,
      response: responseData,
      completed: true,
      success,
    });
    
    // Update stats
    this.stats.totalRequests++;
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }
    this.stats.totalResponseTime += duration;
    
    // Log request completion
    const logMethod = success ? 'info' : 'warn';
    this.logger[logMethod](`Request completed: ${requestId}`, {
      requestId,
      duration,
      statusCode: responseData.statusCode,
      path: request.data?.path,
      method: request.data?.method,
    });
    
    // Clean up old requests periodically
    if (this.stats.totalRequests % 100 === 0) {
      this.cleanupOldRequests();
    }
  }

  /**
   * Clean up old requests
   * @param maxAge - Maximum age in milliseconds (default: 1 hour)
   */
  cleanupOldRequests(maxAge = 60 * 60 * 1000): void {
    const now = Date.now();
    let cleaned = 0;
    
    this.requests.forEach((request, id) => {
      const age = now - (request.endTime || request.startTime);
      if (age > maxAge) {
        this.requests.delete(id);
        cleaned++;
      }
    });
    
    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} old requests`);
    }
  }

  /**
   * Get request tracking stats
   * @returns Request tracking stats
   */
  getStats(): RequestStats {
    const avgResponseTime = this.stats.totalRequests > 0
      ? this.stats.totalResponseTime / this.stats.totalRequests
      : 0;
    
    const errorRate = this.stats.totalRequests > 0
      ? this.stats.failedRequests / this.stats.totalRequests
      : 0;
    
    return {
      ...this.stats,
      avgResponseTime,
      errorRate,
      activeRequests: Array.from(this.requests.values()).filter(r => !r.completed).length,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Express middleware for request tracking
 * @param tracker - Request tracker instance
 * @returns Express middleware
 */
const requestTrackerMiddleware = (tracker: RequestTracker) => {
  return (req: ExtendedRequest, res: ExtendedResponse, next: NextFunction): void => {
    // Generate request ID or use existing one from headers
    const requestId = (req.headers['x-request-id'] as string) || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;
    
    // Add request ID to response headers
    res.setHeader('x-request-id', requestId);
    
    // Start tracking request
    tracker.startRequest(requestId, {
      path: req.path,
      method: req.method,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    // Track response
    const originalEnd = res.end;
    // @ts-ignore - Ignoring type errors for res.end override to maintain compatibility
    res.end = function(this: any, chunk: any, encodingOrCallback?: any, callback?: any): any {
      // End tracking
      tracker.endRequest(requestId, {
        statusCode: res.statusCode,
        headers: res.getHeaders(),
      });
      
      // Call original end method
      // @ts-ignore - Ignoring type errors for arguments to maintain compatibility
      return originalEnd.apply(this, arguments);
    };
    
    next();
  };
};

// Create instances
const serviceHealth = new ServiceHealth();
const systemMetrics = SystemMetrics;

export {
  serviceHealth,
  systemMetrics,
  RequestTracker,
  requestTrackerMiddleware,
  SystemMetricsData,
  ServiceInfo,
  ServiceHealthData,
  ServiceHealthRecord,
  Alert,
  AlertThresholds,
  RequestData,
  ResponseData,
  TrackedRequest,
  RequestStats
};
