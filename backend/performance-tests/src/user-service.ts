import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Define error rate metric
const errorRate = new Rate('errors');

// Define interfaces
interface TestUser {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface SetupData {
  userId: string | null;
  accessToken: string | null;
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
const AUTH_URL = 'http://localhost:3001/api/auth';
const USER_URL = 'http://localhost:3002/api/users';
const TEST_USER: TestUser = {
  username: `perftest_${Date.now()}`,
  email: `perftest_${Date.now()}@example.com`,
  password: 'Password123!',
  firstName: 'Performance',
  lastName: 'Test'
};

// Setup function - runs once per VU
export function setup(): SetupData {
  // Register a test user through Auth Service
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
    return { userId: null, accessToken: null };
  }
  
  const registerData = JSON.parse(registerRes.body as string).data;
  const userId = registerData.user._id;
  
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
    return { userId, accessToken: null };
  }
  
  const loginData = JSON.parse(loginRes.body as string).data;
  const accessToken = loginData.tokens.accessToken;
  
  return { userId, accessToken };
}

// Default function - runs for each VU
export default function(data: SetupData): void {
  // Skip if setup failed
  if (!data.accessToken || !data.userId) {
    console.error('Skipping test because setup failed');
    errorRate.add(1);
    return;
  }
  
  // Test get user by ID endpoint
  const getUserRes = http.get(`${USER_URL}/${data.userId}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(getUserRes, {
    'get user status is 200': (r) => r.status === 200,
    'get user has user data': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && body.data._id === data.userId;
    },
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test update user endpoint
  const updateData = {
    firstName: `Updated_${Date.now()}`,
    lastName: 'TestUser'
  };
  
  const updateUserRes = http.put(`${USER_URL}/${data.userId}`, JSON.stringify(updateData), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(updateUserRes, {
    'update user status is 200': (r) => r.status === 200,
    'update user has updated data': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && 
             body.data.firstName === updateData.firstName && 
             body.data.lastName === updateData.lastName;
    },
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test get user activity endpoint
  const activityRes = http.get(`${USER_URL}/${data.userId}/activity`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(activityRes, {
    'get activity status is 200': (r) => r.status === 200,
    'get activity has activities array': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && Array.isArray(body.data.activities);
    },
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test get user devices endpoint
  const devicesRes = http.get(`${USER_URL}/${data.userId}/devices`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(devicesRes, {
    'get devices status is 200': (r) => r.status === 200,
    'get devices has devices array': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && Array.isArray(body.data.devices);
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
