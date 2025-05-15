// This file extends Jest's functionality for TypeScript tests

// Make TypeScript happy with mock functions
global.mockFn = (returnValue) => {
  const mockFunction = jest.fn();
  if (returnValue !== undefined) {
    mockFunction.mockReturnValue(returnValue);
  }
  return mockFunction;
};

// Utility for creating mock resolved promises
global.mockResolvedFn = (returnValue) => {
  const mockFunction = jest.fn();
  mockFunction.mockResolvedValue(returnValue);
  return mockFunction;
};

// Utility for creating mock rejected promises
global.mockRejectedFn = (error) => {
  const mockFunction = jest.fn();
  mockFunction.mockRejectedValue(error);
  return mockFunction;
};
