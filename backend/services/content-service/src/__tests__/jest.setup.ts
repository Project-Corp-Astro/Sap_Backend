// This file extends Jest's global types to better support TypeScript

// Allow any type for mock functions to avoid TypeScript errors
declare namespace jest {
  interface Mock<T = any, Y extends any[] = any[]> {
    mockResolvedValue(value: T): this;
    mockRejectedValue(value: any): this;
  }
}

// Make TypeScript happy with the test environment
declare global {
  namespace NodeJS {
    interface Global {
      __MONGO_URI__: string;
      __MONGO_DB_NAME__: string;
    }
  }
}

export {};
