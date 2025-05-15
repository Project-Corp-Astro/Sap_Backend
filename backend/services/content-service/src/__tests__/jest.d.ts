// This file extends Jest's type definitions to better support TypeScript in our tests

// Extend Jest's Mock interface to allow any type for mockResolvedValue and mockRejectedValue
declare namespace jest {
  interface MockInstance<T, Y extends any[]> {
    mockResolvedValue: (value: any) => this;
    mockRejectedValue: (value: any) => this;
  }
}

export {};
