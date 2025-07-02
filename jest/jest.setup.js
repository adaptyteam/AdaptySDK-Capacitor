// Mock Capacitor core
jest.mock('@capacitor/core', () => ({
  registerPlugin: jest.fn(() => ({
    // Mock plugin methods that will be defined in tests
  })),
}));

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore specific log levels in tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};
