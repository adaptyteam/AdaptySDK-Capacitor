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
  Log: jest.fn(),
  LogScope: jest.fn(),
  consoleLogSink: jest.fn(),
};

export function createMockLogContext() {
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
