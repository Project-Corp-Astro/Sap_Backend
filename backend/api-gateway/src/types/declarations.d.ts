// Type declarations for modules without TypeScript definitions

/**
 * Compression middleware type definitions
 */
declare module 'compression' {
  import { RequestHandler } from 'express';
  
  interface CompressionOptions {
    threshold?: number;
    level?: number;
    memLevel?: number;
    strategy?: number;
    filter?: (req: any, res: any) => boolean;
    chunkSize?: number;
    windowBits?: number;
  }
  
  function compression(options?: CompressionOptions): RequestHandler;
  export = compression;
}

/**
 * Shared monitoring utilities type definitions
 */
declare module '../../shared/utils/monitoring' {
  import { RequestHandler } from 'express';
  
  export interface RequestStats {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    errorRate: number;
  }
  
  export interface ServiceDetails {
    name: string;
    description: string;
    version: string;
    endpoints: string[];
  }
  
  export interface ServiceHealth {
    status: 'ok' | 'degraded' | 'down';
    metrics: {
      responseTime: number;
      errorRate: number;
      cpuUsage: number;
      memoryUsage: number;
      [key: string]: any;
    };
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
  
  export class RequestTracker {
    constructor(logger: any);
    getStats(): RequestStats;
  }
  
  export const serviceHealth: {
    registerService(name: string, details: ServiceDetails): void;
    updateServiceHealth(name: string, health: ServiceHealth): void;
    getServiceHealth(name: string): ServiceHealth;
    getAllServicesHealth(): Array<{ name: string; health: ServiceHealth }>;
  };
  
  export const systemMetrics: {
    getSystemMetrics(): SystemMetrics;
  };
  
  export function requestTrackerMiddleware(tracker: RequestTracker): RequestHandler;
}

/**
 * Security middleware type definitions
 */
declare module '../../shared/middleware/security' {
  import { Express } from 'express';
  
  export interface SecurityOptions {
    enableCors?: boolean;
    enableHelmet?: boolean;
    enableRateLimit?: boolean;
    enableXss?: boolean;
    csrfProtection?: boolean;
  }
  
  export function applySecurityMiddleware(app: Express, options?: SecurityOptions): void;
}

/**
 * Swagger documentation type definitions
 */
declare module '../../shared/utils/swagger' {
  import { Express } from 'express';
  
  export interface SwaggerOptions {
    definition: {
      openapi?: string;
      info: {
        title: string;
        version: string;
        description?: string;
      };
      servers?: Array<{
        url: string;
        description?: string;
      }>;
      components?: any;
      security?: any[];
      tags?: Array<{
        name: string;
        description?: string;
      }>;
      paths?: Record<string, any>;
    };
    apis?: string[];
  }
  
  export function setupSwagger(app: Express, options: SwaggerOptions): void;
}

/**
 * Astrology-specific type definitions
 */
declare module '../../shared/types/astrology' {
  export interface AstrologyChart {
    id: string;
    userId: string;
    chartType: 'natal' | 'transit' | 'progression' | 'synastry' | 'composite';
    zodiacSystem: 'tropical' | 'sidereal';
    houseSystem: 'whole-sign' | 'placidus' | 'koch' | 'equal' | 'porphyry';
    ayanamsa?: 'lahiri' | 'raman' | 'krishnamurti';
    date: string;
    time: string;
    location: {
      latitude: number;
      longitude: number;
      timezone: string;
      city?: string;
      country?: string;
    };
    planets: Array<{
      name: string;
      sign: string;
      degree: number;
      house: number;
      retrograde: boolean;
    }>;
    houses: Array<{
      number: number;
      sign: string;
      degree: number;
    }>;
    aspects: Array<{
      planet1: string;
      planet2: string;
      type: 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile';
      orb: number;
    }>;
    createdAt: string;
    updatedAt: string;
  }
  
  export interface AstrologyPrediction {
    id: string;
    userId: string;
    chartId: string;
    type: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'transit';
    startDate: string;
    endDate: string;
    content: string;
    highlights: string[];
    challenges: string[];
    opportunities: string[];
    createdAt: string;
    updatedAt: string;
  }
}
