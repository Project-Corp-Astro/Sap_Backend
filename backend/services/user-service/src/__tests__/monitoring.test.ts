/**
 * Tests for monitoring functionality
 */

import request from 'supertest';
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import app from '../index';
import performanceMonitor from '../utils/performance';

// Mock logger to prevent console output during tests
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  requestLogger: jest.fn().mockReturnValue((req: Request, res: Response, next: NextFunction) => next()),
  errorLogger: jest.fn().mockReturnValue((err: Error, req: Request, res: Response, next: NextFunction) => next(err)),
}));

// Mock mongoose connection
jest.mock('mongoose', () => {
  const originalModule = jest.requireActual('mongoose');
  return {
    ...originalModule,
    connect: jest.fn().mockResolvedValue({}),
    connection: {
      readyState: 1,
      name: 'test-db',
      host: 'localhost',
      port: 27017,
      close: jest.fn().mockImplementation(cb => typeof cb === 'function' ? cb() : undefined),
    },
  };
});

describe('Monitoring Endpoints', () => {
  // Close server and database connection after tests
  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('GET /api/monitoring/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/monitoring/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'user-service');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('database');
      expect(response.body.database).toHaveProperty('status', 'connected');
    });
  });

  describe('GET /api/monitoring/metrics', () => {
    it('should return performance metrics', async () => {
      const response = await request(app).get('/api/monitoring/metrics');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('metrics');
      expect(response.body.metrics).toHaveProperty('responseTime');
      expect(response.body.metrics).toHaveProperty('database');
      expect(response.body.metrics).toHaveProperty('memory');
      expect(response.body.metrics).toHaveProperty('cpu');
      expect(response.body.metrics).toHaveProperty('errors');
    });
  });

  describe('GET /api/monitoring/system', () => {
    it('should return system information', async () => {
      const response = await request(app).get('/api/monitoring/system');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('systemInfo');
      expect(response.body.systemInfo).toHaveProperty('hostname');
      expect(response.body.systemInfo).toHaveProperty('platform');
      expect(response.body.systemInfo).toHaveProperty('cpus');
      expect(response.body.systemInfo).toHaveProperty('totalMemory');
      expect(response.body.systemInfo).toHaveProperty('freeMemory');
    });
  });

  describe('POST /api/monitoring/metrics/reset', () => {
    it('should reset metrics in development environment', async () => {
      // Store original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;
      
      // Set to development for this test
      process.env.NODE_ENV = 'development';
      
      // Spy on resetMetrics method
      const resetSpy = jest.spyOn(performanceMonitor, 'resetMetrics');
      
      const response = await request(app).post('/api/monitoring/metrics/reset');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Performance metrics reset successfully');
      expect(resetSpy).toHaveBeenCalledTimes(1);
      
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
      
      // Restore original implementation
      resetSpy.mockRestore();
    });

    it('should require authentication in production environment', async () => {
      // Store original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;
      
      try {
        // Set to production for this test
        process.env.NODE_ENV = 'production';
        
        // Make sure we have a clean environment for this test
        jest.clearAllMocks();
        
        // Spy on resetMetrics to ensure it's not called
        const resetSpy = jest.spyOn(performanceMonitor, 'resetMetrics');
        
        const response = await request(app)
          .post('/api/monitoring/metrics/reset')
          .set('Accept', 'application/json');
        
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Unauthorized');
        expect(resetSpy).not.toHaveBeenCalled();
        
        // Restore spy
        resetSpy.mockRestore();
      } finally {
        // Ensure NODE_ENV is always restored even if test fails
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe('Performance Middleware', () => {
    it('should track response time for API requests', async () => {
      // Spy on trackResponseTime method
      const trackSpy = jest.spyOn(performanceMonitor, 'trackResponseTime');
      
      // Make a request to trigger the middleware
      await request(app).get('/api/monitoring/health');
      
      // Check if trackResponseTime was called
      expect(trackSpy).toHaveBeenCalled();
      expect(trackSpy.mock.calls[0][2]).toContain('/api/monitoring/health');
      expect(trackSpy.mock.calls[0][3]).toBe(200);
      
      // Restore original implementation
      trackSpy.mockRestore();
    });
  });
});
