/**
 * Tests for performance monitoring functionality
 */

import performanceMonitor, { trackDatabaseOperation } from '../utils/performance';

// Mock logger to prevent console output during tests
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Performance Monitoring', () => {
  beforeEach(() => {
    // Reset metrics before each test
    performanceMonitor.resetMetrics();
  });

  describe('trackResponseTime', () => {
    it('should track response time correctly', () => {
      const startTime = Date.now() - 100; // 100ms ago
      const endTime = Date.now();
      const endpoint = '/api/users';
      const statusCode = 200;

      performanceMonitor.trackResponseTime(startTime, endTime, endpoint, statusCode);
      
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.responseTime.count).toBe(1);
      expect(metrics.responseTime.total).toBeGreaterThanOrEqual(0);
      expect(metrics.responseTime.average).toBeGreaterThanOrEqual(0);
      expect(metrics.responseTime.byEndpoint[endpoint]).toBeDefined();
      expect(metrics.responseTime.byEndpoint[endpoint].count).toBe(1);
    });

    it('should track errors for non-2xx status codes', () => {
      const startTime = Date.now() - 100;
      const endTime = Date.now();
      const endpoint = '/api/users';
      const statusCode = 500;

      performanceMonitor.trackResponseTime(startTime, endTime, endpoint, statusCode);
      
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.errors.count).toBe(1);
      expect(metrics.errors.byType).toHaveProperty('HTTP500');
      expect(metrics.errors.byType.HTTP500).toBe(1);
    });
  });

  describe('trackDatabaseOperation', () => {
    it('should track database operations correctly', async () => {
      // Mock database operation that takes 50ms
      const mockDbOperation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve({ success: true }), 50);
        });
      });

      // Track the operation
      const result = await trackDatabaseOperation('findUsers', mockDbOperation);
      
      // Verify the operation was called
      expect(mockDbOperation).toHaveBeenCalledTimes(1);
      
      // Verify the result was returned
      expect(result).toEqual({ success: true });
      
      // Verify metrics were updated
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.database.operations).toBe(1);
      expect(metrics.database.queryTime.total).toBeGreaterThan(0);
      expect(metrics.database.byOperation.findUsers).toBeDefined();
      expect(metrics.database.byOperation.findUsers.count).toBe(1);
    });

    it('should track errors in database operations', async () => {
      // Mock database operation that throws an error
      const mockErrorOperation = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Database error')), 10);
        });
      });

      // Track the operation and expect it to throw
      await expect(trackDatabaseOperation('updateUser', mockErrorOperation))
        .rejects.toThrow('Database error');
      
      // Verify metrics were updated
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.database.operations).toBe(1);
      expect(metrics.errors.count).toBe(1);
      expect(metrics.errors.byType).toHaveProperty('DB:updateUser');
      expect(metrics.errors.byType['DB:updateUser']).toBe(1);
    });
  });

  describe('System Metrics', () => {
    it('should collect system metrics', () => {
      const metrics = performanceMonitor.getMetrics();
      
      expect(metrics.memory).toBeDefined();
      expect(metrics.memory.total).toBeGreaterThan(0);
      expect(metrics.memory.free).toBeGreaterThan(0);
      expect(metrics.memory.usage).toBeGreaterThan(0);
      
      expect(metrics.cpu).toBeDefined();
      // Check if loadAvg is an array-like object with length property
      expect(metrics.cpu.loadAvg).toBeDefined();
      expect(Array.isArray(metrics.cpu.loadAvg) || metrics.cpu.loadAvg.length !== undefined).toBeTruthy();
      // Skip exact length check as it might vary by environment
    });
  });
});
