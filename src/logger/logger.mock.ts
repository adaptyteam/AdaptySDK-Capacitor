export const mockLogger = {
  LogContext: jest.fn().mockImplementation(() => ({
    call: jest.fn().mockReturnValue({
      start: jest.fn(),
      success: jest.fn(),
      failed: jest.fn(),
    }),
    event: jest.fn().mockReturnValue({
      start: jest.fn(),
      success: jest.fn(),
      failed: jest.fn(),
    }),
  })),
  // `Log` is used via static methods (e.g. `Log.setVersion`, `Log.warn`), so the
  // mock must expose them as jest.fn()s rather than being a bare function.
  Log: {
    logLevel: null,
    setVersion: jest.fn(),
    configure: jest.fn(),
    addSink: jest.fn(),
    removeSink: jest.fn(),
    clearSinks: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
  },
  LogScope: jest.fn(),
  consoleLogSink: jest.fn(),
};

export function createMockLogContext(): {
  mockLog: { start: jest.Mock; success: jest.Mock; failed: jest.Mock };
  mockLogContext: { call: jest.Mock; event: jest.Mock };
} {
  const mockLog = {
    start: jest.fn(),
    success: jest.fn(),
    failed: jest.fn(),
  };

  const mockLogContextInstance = {
    call: jest.fn().mockReturnValue(mockLog),
    event: jest.fn().mockReturnValue(mockLog),
  };

  return {
    mockLog,
    mockLogContext: mockLogContextInstance,
  };
}
