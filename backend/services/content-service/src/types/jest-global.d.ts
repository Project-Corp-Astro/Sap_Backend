// Global type definitions for Jest in TypeScript

import '@jest/globals';

declare global {
  namespace jest {
    // Extend the Mock interface to properly handle any type of arguments
    interface Mock<T = any, Y extends any[] = any[]> {
      mockResolvedValue: (value: any) => jest.Mock<T, Y>;
      mockRejectedValue: (value: any) => jest.Mock<T, Y>;
      mockReturnValue: (value: any) => jest.Mock<T, Y>;
      mockImplementation: (fn: (...args: any[]) => any) => jest.Mock<T, Y>;
    }
  }
}

export {};
