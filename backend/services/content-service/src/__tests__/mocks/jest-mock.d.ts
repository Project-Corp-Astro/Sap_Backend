// Type declarations for Jest mocks in tests
declare namespace jest {
  interface Mock<T = any, Y extends any[] = any[]> {
    mockResolvedValue(value: T): this;
    mockRejectedValue(error: Error | string): this;
    mockImplementation(fn: (...args: Y) => T): this;
    mockReturnValue(value: T): this;
  }

  function fn<T = any, Y extends any[] = any[]>(): Mock<T, Y>;
}

// Allow any mock values for test files
declare type MockAny = any;
