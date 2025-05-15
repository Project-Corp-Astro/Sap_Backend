import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Define error rate metric
const errorRate = new Rate('errors');

// Define interfaces
interface SetupData {
  accessToken: string | null;
}

// Default test options
export const options = {
  stages: [
    { duration: '30s', target: 30 }, // Ramp up to 30 users over 30 seconds
    { duration: '1m', target: 30 },  // Stay at 30 users for 1 minute
    { duration: '30s', target: 0 },  // Ramp down to 0 users over 30 seconds
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests should be below 500ms
    'errors': ['rate<0.1'],             // Error rate should be less than 10%
  },
};

// Test data
const AUTH_URL = 'http://localhost:3001/api/auth';
const GATEWAY_URL = 'http://localhost:5001';
const TEST_USER = {
  username: `perftest_${Date.now()}`,
  email: `perftest_${Date.now()}@example.com`,
  password: 'Password123!',
  firstName: 'Performance',
  lastName: 'Test'
};

// Setup function - runs once per VU
export function setup(): SetupData {
  // Register a test user through Auth Service directly (not through gateway)
  const registerRes = http.post(`${AUTH_URL}/register`, JSON.stringify(TEST_USER), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(registerRes, {
    'register status is 200': (r) => r.status === 200,
    'register has user data': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && body.data.user;
    },
  });
  
  if (registerRes.status !== 200) {
    errorRate.add(1);
    console.error(`Failed to register test user: ${registerRes.body}`);
    return { accessToken: null };
  }
  
  // Login to get tokens
  const loginRes = http.post(`${AUTH_URL}/login`, JSON.stringify({
    email: TEST_USER.email,
    password: TEST_USER.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(loginRes, {
    'login status is 200': (r) => r.status === 200,
    'login has tokens': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && body.data.tokens;
    },
  });
  
  if (loginRes.status !== 200) {
    errorRate.add(1);
    console.error(`Failed to login test user: ${loginRes.body}`);
    return { accessToken: null };
  }
  
  const loginData = JSON.parse(loginRes.body as string).data;
  const accessToken = loginData.tokens.accessToken;
  
  return { accessToken };
}

// Default function - runs for each VU
export default function(data: SetupData): void {
  // Skip if setup failed
  if (!data.accessToken) {
    console.error('Skipping test because setup failed');
    errorRate.add(1);
    return;
  }
  
  // Test API Gateway root endpoint
  const rootRes = http.get(`${GATEWAY_URL}/`);
  
  check(rootRes, {
    'root status is 200': (r) => r.status === 200,
    'root has service info': (r) => {
      const body = JSON.parse(r.body as string);
      return body.message === 'SAP API Gateway';
    },
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test API Gateway health endpoint
  const healthRes = http.get(`${GATEWAY_URL}/health`);
  
  check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health has service status': (r) => {
      const body = JSON.parse(r.body as string);
      return body.status === 'ok' && body.service === 'api-gateway';
    },
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test API Gateway proxying to Auth Service
  const authProxyRes = http.get(`${GATEWAY_URL}/api/auth/profile`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(authProxyRes, {
    'auth proxy status is 200': (r) => r.status === 200,
    'auth proxy returns user data': (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return body.data && body.data.email === TEST_USER.email;
      } catch (e) {
        return false;
      }
    },
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test API Gateway proxying to User Service
  const userProxyRes = http.get(`${GATEWAY_URL}/api/users/profile`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  // This may return 200 or 404 depending on if the user service is running and has the profile endpoint
  check(userProxyRes, {
    'user proxy returns a response': (r) => r.status === 200 || r.status === 404 || r.status === 503,
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test API Gateway proxying to Content Service
  const contentProxyRes = http.get(`${GATEWAY_URL}/api/content?page=1&limit=10`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  // This may return 200 or 404 depending on if the content service is running and has this endpoint
  check(contentProxyRes, {
    'content proxy returns a response': (r) => r.status === 200 || r.status === 404 || r.status === 503,
  }) || errorRate.add(1);
  
  sleep(1);
}

// Teardown function - runs once per VU
export function teardown(data: SetupData): void {
  // Skip if setup failed
  if (!data.accessToken) {
    console.error('Skipping teardown because setup failed');
    return;
  }
  
  // Logout through Auth Service
  const logoutRes = http.post(`${AUTH_URL}/logout`, {}, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(logoutRes, {
    'logout status is 200': (r) => r.status === 200,
  });
  
  console.log('Performance test completed and test user logged out');
}
