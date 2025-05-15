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

interface TestContent {
  title: string;
  body: string;
  type: string;
  tags: string[];
  category: string;
  isPublished: boolean;
}

interface SetupData {
  userId: string | null;
  accessToken: string | null;
  contentId: string | null;
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
const CONTENT_URL = 'http://localhost:3003/api/content';
const TEST_USER: TestUser = {
  username: `perftest_${Date.now()}`,
  email: `perftest_${Date.now()}@example.com`,
  password: 'Password123!',
  firstName: 'Performance',
  lastName: 'Test'
};

const TEST_CONTENT: TestContent = {
  title: `Performance Test Content ${Date.now()}`,
  body: 'This is a test content item created during performance testing.',
  type: 'article',
  tags: ['test', 'performance', 'typescript'],
  category: 'testing',
  isPublished: true
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
    return { userId: null, accessToken: null, contentId: null };
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
    return { userId, accessToken: null, contentId: null };
  }
  
  const loginData = JSON.parse(loginRes.body as string).data;
  const accessToken = loginData.tokens.accessToken;
  
  // Create a test content item
  const createContentRes = http.post(CONTENT_URL, JSON.stringify(TEST_CONTENT), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  check(createContentRes, {
    'create content status is 201': (r) => r.status === 201,
    'create content has content data': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && body.data._id;
    },
  });
  
  if (createContentRes.status !== 201) {
    errorRate.add(1);
    console.error(`Failed to create test content: ${createContentRes.body}`);
    return { userId, accessToken, contentId: null };
  }
  
  const contentData = JSON.parse(createContentRes.body as string).data;
  const contentId = contentData._id;
  
  return { userId, accessToken, contentId };
}

// Default function - runs for each VU
export default function(data: SetupData): void {
  // Skip if setup failed
  if (!data.accessToken || !data.contentId) {
    console.error('Skipping test because setup failed');
    errorRate.add(1);
    return;
  }
  
  // Test get content items endpoint
  const getContentsRes = http.get(`${CONTENT_URL}?page=1&limit=10`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(getContentsRes, {
    'get contents status is 200': (r) => r.status === 200,
    'get contents has results array': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && Array.isArray(body.data.results);
    },
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test get content by ID endpoint
  const getContentRes = http.get(`${CONTENT_URL}/${data.contentId}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(getContentRes, {
    'get content status is 200': (r) => r.status === 200,
    'get content has content data': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && body.data._id === data.contentId;
    },
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test track content view endpoint
  const trackViewRes = http.post(`${CONTENT_URL}/${data.contentId}/view`, {}, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(trackViewRes, {
    'track view status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test get content analytics endpoint
  const analyticsRes = http.get(`${CONTENT_URL}/${data.contentId}/analytics`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(analyticsRes, {
    'get analytics status is 200': (r) => r.status === 200,
    'get analytics has views count': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && typeof body.data.views === 'number';
    },
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test update content endpoint
  const updateData = {
    title: `Updated Performance Test Content ${Date.now()}`,
    body: 'This content has been updated during performance testing.'
  };
  
  const updateContentRes = http.put(`${CONTENT_URL}/${data.contentId}`, JSON.stringify(updateData), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(updateContentRes, {
    'update content status is 200': (r) => r.status === 200,
    'update content has updated data': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && 
             body.data.title === updateData.title && 
             body.data.body === updateData.body;
    },
  }) || errorRate.add(1);
  
  sleep(1);
  
  // Test search content endpoint
  const searchRes = http.get(`${CONTENT_URL}/search?q=performance`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(searchRes, {
    'search content status is 200': (r) => r.status === 200,
    'search content has results array': (r) => {
      const body = JSON.parse(r.body as string);
      return body.data && Array.isArray(body.data.results);
    },
  }) || errorRate.add(1);
  
  sleep(1);
}

// Teardown function - runs once per VU
export function teardown(data: SetupData): void {
  // Skip if setup failed
  if (!data.accessToken || !data.contentId) {
    console.error('Skipping teardown because setup failed');
    return;
  }
  
  // Delete the test content
  const deleteContentRes = http.del(`${CONTENT_URL}/${data.contentId}`, null, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.accessToken}`,
    },
  });
  
  check(deleteContentRes, {
    'delete content status is 200': (r) => r.status === 200,
  });
  
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
  
  console.log('Performance test completed, test content deleted, and test user logged out');
}
