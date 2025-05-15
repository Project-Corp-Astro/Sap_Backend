import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Load environment variables
dotenv.config();

// Global variables
let mongoServer: MongoMemoryServer;

// Setup before all tests
beforeAll(async () => {
  // Create an in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Set environment variables for tests
  process.env.MONGO_URI = mongoUri;
  process.env.NODE_ENV = 'test';
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
  
  // Set strictQuery to false to suppress the deprecation warning
  mongoose.set('strictQuery', false);
  
  console.log(`Connected to in-memory MongoDB at ${mongoUri}`);
});

// Clean up after each test
afterEach(async () => {
  // Clear all collections after each test
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Clean up after all tests
afterAll(async () => {
  // Disconnect from the database
  await mongoose.disconnect();
  
  // Stop the in-memory server
  await mongoServer.stop();
  
  console.log('Disconnected from in-memory MongoDB');
});

// Global test timeout
jest.setTimeout(30000);

// Suppress console output during tests
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}
