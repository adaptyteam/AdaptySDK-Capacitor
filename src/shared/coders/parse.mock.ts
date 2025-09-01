export const mockParse = {
  parseMethodResult: jest.fn(),
  parseCommonEvent: jest.fn(),
  parsePaywallEvent: jest.fn(),
  parseOnboardingEvent: jest.fn(),
};

export function createMockParseEvents() {
  const mockParseMethodResult = jest.fn();
  const mockParseCommonEvent = jest.fn();
  const mockParsePaywallEvent = jest.fn();
  const mockParseOnboardingEvent = jest.fn();

  return {
    mockParseMethodResult,
    mockParseCommonEvent,
    mockParsePaywallEvent,
    mockParseOnboardingEvent,
  };
}
