import { Request, Response } from 'express';

export interface ServiceHealth {
  status: 'ok' | 'degraded' | 'down';
  metrics?: {
    responseTime?: number;
    errorRate?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    [key: string]: any;
  };
}

export interface RequestStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  errorRate: number;
}

export interface SystemMetrics {
  cpu: {
    loadAvg: number[];
    cpus: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
  };
  uptime: number;
}

export interface ProxyErrorHandler {
  (err: Error, req: Request, res: Response): void;
}
