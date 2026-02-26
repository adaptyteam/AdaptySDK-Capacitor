export const mockParse = {
  parseMethodResult: jest.fn(),
  parseCommonEvent: jest.fn(),
  parseOnboardingEvent: jest.fn(),
};

export function createMockParseEvents(): {
  mockParseMethodResult: jest.Mock;
  mockParseCommonEvent: jest.Mock;
  mockParseOnboardingEvent: jest.Mock;
} {
  const mockParseMethodResult = jest.fn();
  const mockParseCommonEvent = jest.fn();
  const mockParseOnboardingEvent = jest.fn();

  return {
    mockParseMethodResult,
    mockParseCommonEvent,
    mockParseOnboardingEvent,
  };
}
