import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Define error rate metric
const errorRate = new Rate('errors');

// Define test user interface
interface TestUser {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// Define token interface
interface Tokens {
  accessToken: string;
  refreshToken: string;
}

// Define setup data interface
interface SetupData {
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
}

// Default test options
export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users over 30 seconds
    { duration: '1m', target: 20 },  // Stay at 20 users for 1 minute
    { duration: '30s', target: 0 },  // Ramp down to 0 users over 30 seconds
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // 95% of requests should be below 500ms
    'errors': ['rate<0.1'],             // Error rate should be less than 10%
  },
};

// Test data
const BASE_URL = 'http://localhost:3001/api/auth';
const TEST_USER: TestUser = {
  username: `perftest_${Date.now()}`,
  email: `perftest_${Date.now()}@example.com`,
  password: 'Password123!',
  firstName: 'Performance',
  lastName: 'Test'
};

// Setup function - runs once per VU
export function setup(): SetupData {
  // Register a test user
  const registerRes = http.post(`${BASE_URL}/register`, JSON.stringify(TEST_USER), {
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
    return { userId: null, accessToken: null, refreshToken: null };
  }
  
  const registerData = JSON.parse(registerRes.body as string).data;
  const userId = registerData.user._id;
  
  // Login to get tokens
  const loginRes = http.post(`${BASE_URL}/login`, JSON.stringify({
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
    return { userId, accessToken: null, refreshToken: null };
  }
  
  const loginData = JSON.parse(loginRes.body as string).data;
  const accessToken = loginData.tokens.accessToken;
  const refreshToken = loginData.tokens.refreshToken;
  
  return { userId, accessToken, refreshToken };
}

// Default function - runs for each VU
export default function(data: SetupData): void {
  // Skip if setup failed
  if (!data.accessToken) {
    console.error('Skipping test because setup failed');
    errorRate.add(1);
    return;
  }
  
  // Test login endpoint
  const loginRes = http.post(`${BASE_URL}/login`, JSON.stringify({
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
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test get profile endpoint
  const profileRes = http.get(`${BASE_URL}/profile`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(profileRes, {
    'profile status is 200': (r) => r.status === 200,
    'profile has user data': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && body.data._id;
    },
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test refresh token endpoint
  const refreshRes = http.post(`${BASE_URL}/refresh-token`, JSON.stringify({
    refreshToken: data.refreshToken,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(refreshRes, {
    'refresh token status is 200': (r) => r.status === 200,
    'refresh token has new tokens': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && body.data.accessToken;
    },
  }) || errorRate.add(1);
  
  sleep(1);
}

// Teardown function - runs once per VU
export function teardown(data: SetupData): void {
  // Skip if setup failed
  if (!data.accessToken || !data.userId) {
    console.error('Skipping teardown because setup failed');
    return;
  }
  
  // Logout
  const logoutRes = http.post(`${BASE_URL}/logout`, {}, {
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
