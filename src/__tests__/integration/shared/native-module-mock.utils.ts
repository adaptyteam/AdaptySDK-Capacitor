import { AdaptyCapacitorPlugin } from 'bridge/plugin';
import type { components } from 'shared/types/api';

/**
 * Native Module Mock Utilities
 *
 * Provides utilities for configuring AdaptyCapacitorPlugin mock in integration tests.
 * Enables spy-based assertions on bridge communication.
 *
 * The plugin is already mocked via jest.setup.js (@capacitor/core registerPlugin
 * returns an object with handleMethodCall and addListener as jest.fn()).
 * These utilities configure mock behavior per-test.
 */

/**
 * Type for handleMethodCall function
 * Matches the Capacitor bridge interface: ({ methodName, args }) => Promise<{ crossPlatformJson }>
 */
type HandleMethodCallFn = (options: { methodName: string; args: string }) => Promise<{ crossPlatformJson: string }>;

/**
 * Mock implementation of AdaptyCapacitorPlugin
 * Provides jest spy capabilities for assertions
 */
export interface MockNativeModule {
  handleMethodCall: jest.MockedFunction<HandleMethodCallFn>;
  addListener: jest.MockedFunction<
    (eventName: string, listenerFunc: (data: { data: string }) => void) => Promise<{ remove: () => Promise<void> }>
  >;
}

/**
 * Response registry for mapping method names to their typed responses.
 * Uses api.d.ts types for compile-time validation against the cross-platform schema.
 */
interface ResponseRegistry {
  activate?: components['requests']['Activate.Response'];
  is_activated?: components['requests']['IsActivated.Response'];
  get_profile?: components['requests']['GetProfile.Response'];
  get_paywall?: components['requests']['GetPaywall.Response'];
  get_paywall_for_default_audience?: components['requests']['GetPaywallForDefaultAudience.Response'];
  get_paywall_products?: components['requests']['GetPaywallProducts.Response'];
  log_show_paywall?: components['requests']['LogShowPaywall.Response'];
  make_purchase?: components['requests']['MakePurchase.Response'];
  get_onboarding?: components['requests']['GetOnboarding.Response'];
  get_onboarding_for_default_audience?: components['requests']['GetOnboardingForDefaultAudience.Response'];
  identify?: components['requests']['Identify.Response'];
  logout?: components['requests']['Logout.Response'];
  restore_purchases?: components['requests']['RestorePurchases.Response'];
  set_log_level?: components['requests']['SetLogLevel.Response'];
  set_fallback?: components['requests']['SetFallback.Response'];
  update_profile?: components['requests']['UpdateProfile.Response'];
}

/**
 * Options for extractNativeRequest function
 */
interface ExtractNativeRequestOptions {
  nativeModule: MockNativeModule;
  callIndex?: number;
}

/**
 * Options for expectNativeCall function
 */
interface ExpectNativeCallOptions<T extends { method: string }> {
  nativeModule: MockNativeModule;
  method: string;
  expectedRequest: T;
  callIndex?: number;
}

/**
 * Configures the mocked AdaptyCapacitorPlugin with typed responses.
 *
 * The mock intercepts calls to AdaptyCapacitorPlugin.handleMethodCall()
 * and returns predefined responses wrapped in { crossPlatformJson } format.
 *
 * @param responses - Registry mapping method names to their typed responses
 * @returns Mocked plugin with spy capabilities
 *
 * @example
 * ```typescript
 * const nativeMock = createNativeModuleMock({
 *   activate: { success: true },
 *   is_activated: { success: true },
 * });
 *
 * await adapty.activate({ apiKey: 'test_key' });
 *
 * expect(nativeMock.handleMethodCall).toHaveBeenCalledWith({
 *   methodName: 'activate',
 *   args: expect.any(String),
 * });
 * ```
 */
export function createNativeModuleMock(responses: ResponseRegistry = {}): MockNativeModule {
  const nativeModule = AdaptyCapacitorPlugin as unknown as MockNativeModule;

  nativeModule.handleMethodCall.mockImplementation(({ methodName }) => {
    const response = responses[methodName as keyof ResponseRegistry];

    if (!response) {
      return Promise.reject(new Error(`No mock response registered for method: ${methodName}`));
    }

    return Promise.resolve({
      crossPlatformJson: JSON.stringify(response),
    });
  });

  return nativeModule;
}

/**
 * Extracts and parses the request sent to the Capacitor plugin.
 *
 * @param options.nativeModule - Mocked Capacitor plugin
 * @param options.callIndex - Which call to inspect (default: 0 = first call)
 * @returns Parsed request object with type safety
 *
 * @example
 * ```typescript
 * const request = extractNativeRequest<
 *   components['requests']['Activate.Request']
 * >({ nativeModule: nativeMock });
 *
 * expect(request.configuration.api_key).toBe('test_key');
 * ```
 */
export function extractNativeRequest<T>(options: ExtractNativeRequestOptions): T {
  const { nativeModule, callIndex = 0 } = options;

  const calls = nativeModule.handleMethodCall.mock.calls;

  if (calls.length <= callIndex) {
    throw new Error(`No call at index ${callIndex}. Total calls: ${calls.length}`);
  }

  const call = calls[callIndex];
  if (!call) {
    throw new Error(`Call at index ${callIndex} is undefined`);
  }

  const [{ args }] = call;
  return JSON.parse(args) as T;
}

/**
 * Verifies that the Capacitor plugin was called with the correct request format.
 *
 * Uses toMatchObject for partial matching — SDK adds default fields like
 * cross_platform_sdk_name, observer_mode, media_cache, etc.
 *
 * @param options.nativeModule - Mocked Capacitor plugin
 * @param options.method - Expected method name (e.g., 'activate')
 * @param options.expectedRequest - Expected request structure
 * @param options.callIndex - Which call to verify (default: 0 = first call)
 */
export function expectNativeCall<T extends { method: string }>(options: ExpectNativeCallOptions<T>): void {
  const { nativeModule, method: expectedMethod, expectedRequest, callIndex = 0 } = options;

  const calls = nativeModule.handleMethodCall.mock.calls;

  if (calls.length <= callIndex) {
    throw new Error(`No call at index ${callIndex}. Total calls: ${calls.length}`);
  }

  const call = calls[callIndex];
  if (!call) {
    throw new Error(`Call at index ${callIndex} is undefined`);
  }

  const [{ methodName, args }] = call;
  const actualRequest = JSON.parse(args) as T;

  expect(methodName).toBe(expectedMethod);
  expect(actualRequest).toMatchObject(expectedRequest);
}

/**
 * Resets Capacitor plugin mock for next test.
 * Clears call history and mock implementations.
 */
export function resetNativeModuleMock(mock: MockNativeModule): void {
  mock.handleMethodCall.mockReset();
  mock.addListener.mockReset();
  mock.addListener.mockResolvedValue({
    remove: jest.fn().mockResolvedValue(undefined),
  });
}
