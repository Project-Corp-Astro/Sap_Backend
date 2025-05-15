/**
 * Mock Redis client for testing
 */

const redisClient = {
  set: jest.fn().mockImplementation((key, value) => Promise.resolve('OK')),
  get: jest.fn().mockImplementation((key) => Promise.resolve(null)),
  del: jest.fn().mockImplementation((key) => Promise.resolve(1)),
  exists: jest.fn().mockImplementation((key) => Promise.resolve(0)),
  expire: jest.fn().mockImplementation((key, seconds) => Promise.resolve(1)),
  quit: jest.fn().mockImplementation(() => Promise.resolve('OK')),
};

export default redisClient;
