import request from 'supertest';
import app from '../index';

describe('API Gateway', () => {
  // Root endpoint test
  describe('GET /', () => {
    it('should return 200 and basic service info', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'SAP API Gateway');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('documentation');
    });
  });

  // Health check test
  describe('GET /health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('service', 'api-gateway');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('metrics');
    });
  });

  // Proxy routes tests (mocked)
  describe('Proxy Routes', () => {
    // Auth Service proxy test
    it('should proxy requests to auth service', async () => {
      // This is a basic test that just checks the route exists
      // In a real test, you would mock the proxy target
      const response = await request(app).get('/api/auth');
      // We expect a 503 because the auth service is not running in tests
      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('message', 'Auth Service unavailable');
    });

    // User Service proxy test
    it('should proxy requests to user service', async () => {
      const response = await request(app).get('/api/users');
      // We expect a 503 because the user service is not running in tests
      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('message', 'User Service unavailable');
    });

    // Content Service proxy test
    it('should proxy requests to content service', async () => {
      const response = await request(app).get('/api/content');
      // We expect a 503 because the content service is not running in tests
      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('message', 'Content Service unavailable');
    });
  });
});
