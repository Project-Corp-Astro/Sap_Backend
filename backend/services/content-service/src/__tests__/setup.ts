import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { jest, beforeAll, afterAll, afterEach } from '@jest/globals';

// Define types for global mocks
type MockRequest = {
  body: Record<string, any>;
  params: Record<string, any>;
  query: Record<string, any>;
  user?: { _id: string };
  [key: string]: any;
};

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
  [key: string]: any;
};

declare global {
  var mockRequest: () => MockRequest;
  var mockResponse: () => MockResponse;
  var mockNext: jest.Mock;
}

// Explicitly type the mongoServer variable
let mongoServer: any;

// Increase timeout for MongoDB operations
jest.setTimeout(30000);

// Setup before all tests
beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
      // Add connection options to avoid deprecation warnings
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10
    });
    console.log('Connected to MongoDB memory server');
  } catch (error) {
    console.error('Error connecting to MongoDB memory server:', error);
    throw error;
  }
});

// Clean up after each test
afterEach(async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      const collections = mongoose.connection.collections;
      for (const key in collections) {
        try {
          await collections[key].deleteMany({});
        } catch (error) {
          console.error(`Error cleaning up collection ${key}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error in afterEach cleanup:', error);
  }
});

// Clean up after all tests
afterAll(async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
    if (mongoServer) {
      await mongoServer.stop();
      console.log('Stopped MongoDB memory server');
    }
  } catch (error) {
    console.error('Error in afterAll cleanup:', error);
  }
});

// Define global test helpers
global.mockRequest = () => {
  const req: MockRequest = {
    body: {},
    params: {},
    query: {},
    user: { _id: 'mockUserId' }
  };
  req.body = jest.fn().mockReturnValue(req);
  req.params = jest.fn().mockReturnValue(req);
  req.query = jest.fn().mockReturnValue(req);
  return req;
};

global.mockResponse = () => {
  const mockRes: MockResponse = {} as MockResponse;
  mockRes.status = jest.fn().mockReturnValue(mockRes);
  mockRes.json = jest.fn().mockReturnValue(mockRes);
  mockRes.send = jest.fn().mockReturnValue(mockRes);
  return mockRes;
};

global.mockNext = jest.fn();
