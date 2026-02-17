// Mock Capacitor core
const mockCapacitorPlugin = {
  handleMethodCall: jest.fn(),
  addListener: jest.fn().mockResolvedValue({ remove: jest.fn() }),
};

jest.mock('@capacitor/core', () => ({
  registerPlugin: jest.fn(() => mockCapacitorPlugin),
  Capacitor: {
    getPlatform: jest.fn(() => 'ios'),
  },
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
