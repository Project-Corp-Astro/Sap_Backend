// This file extends Jest's type definitions to better support TypeScript in our tests

declare namespace jest {
  // Extend the Mock interface to allow any return type for mockResolvedValue and mockRejectedValue
  interface Mock<T = any, Y extends any[] = any[]> {
    mockResolvedValue(value: any): this;
    mockRejectedValue(value: any): this;
    mockReturnValue(value: any): this;
    mockImplementation(fn: (...args: any[]) => any): this;
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
