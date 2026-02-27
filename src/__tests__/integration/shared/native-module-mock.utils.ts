import { AdaptyCapacitorPlugin } from 'bridge/plugin';
import type { components } from 'types/api';

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
  set_integration_identifiers?: components['requests']['SetIntegrationIdentifier.Response'];
  report_transaction?: components['requests']['ReportTransaction.Response'];
  set_log_level?: components['requests']['SetLogLevel.Response'];
  set_fallback?: components['requests']['SetFallback.Response'];
  update_attribution_data?: components['requests']['UpdateAttributionData.Response'];
  update_profile?: components['requests']['UpdateProfile.Response'];
  get_current_installation_status?: components['requests']['GetCurrentInstallationStatus.Response'];
  present_code_redemption_sheet?: components['requests']['PresentCodeRedemptionSheet.Response'];
  update_collecting_refund_data_consent?: components['requests']['UpdateCollectingRefundDataConsent.Response'];
  update_refund_preference?: components['requests']['UpdateRefundPreference.Response'];
  open_web_paywall?: components['requests']['OpenWebPaywall.Response'];
  create_web_paywall_url?: components['requests']['CreateWebPaywallUrl.Response'];
  adapty_ui_create_paywall_view?: components['requests']['AdaptyUICreatePaywallView.Response'];
  adapty_ui_present_paywall_view?: components['requests']['AdaptyUIPresentPaywallView.Response'];
  adapty_ui_dismiss_paywall_view?: components['requests']['AdaptyUIDismissPaywallView.Response'];
  adapty_ui_show_dialog?: components['requests']['AdaptyUIShowDialog.Response'];
  adapty_ui_create_onboarding_view?: components['requests']['AdaptyUICreateOnboardingView.Response'];
  adapty_ui_present_onboarding_view?: components['requests']['AdaptyUIPresentOnboardingView.Response'];
  adapty_ui_dismiss_onboarding_view?: components['requests']['AdaptyUIDismissOnboardingView.Response'];
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
interface ExpectNativeCallOptions<T> {
  nativeModule: MockNativeModule;
  method: string;
  expectedRequest: T;
  callIndex?: number;
}

/**
 * Create a native module mock with pre-configured method responses
 *
 * @example
 * ```ts
 * const mock = createNativeModuleMock({
 *   activate: ACTIVATE_RESPONSE_SUCCESS,
 *   get_profile: GET_PROFILE_RESPONSE,
 * });
 * ```
 */
export function createNativeModuleMock(responses: ResponseRegistry): MockNativeModule {
  const mockImplementation: HandleMethodCallFn = jest.fn(({ methodName, args: _args }) => {
    const response = responses[methodName as keyof ResponseRegistry];

    if (!response) {
      return Promise.reject(
        new Error(
          `No mock response configured for method '${methodName}'. ` +
            `Available methods: ${Object.keys(responses).join(', ')}`,
        ),
      );
    }

    return Promise.resolve({ crossPlatformJson: JSON.stringify(response) });
  });

  (AdaptyCapacitorPlugin.handleMethodCall as jest.MockedFunction<HandleMethodCallFn>).mockImplementation(
    mockImplementation,
  );

  // Configure addListener to use TestEventEmitter
  (AdaptyCapacitorPlugin.addListener as jest.MockedFunction<any>).mockImplementation(
    (eventName: string, listenerFunc: (data: { data: string }) => void) => {
      const emitter = getTestEmitter();
      return Promise.resolve(emitter.addListener(eventName, listenerFunc));
    },
  );

  return {
    handleMethodCall: AdaptyCapacitorPlugin.handleMethodCall as jest.MockedFunction<HandleMethodCallFn>,
    addListener: AdaptyCapacitorPlugin.addListener as jest.MockedFunction<
      (eventName: string, listenerFunc: (data: { data: string }) => void) => Promise<{ remove: () => Promise<void> }>
    >,
  };
}

/**
 * Extract native request from mock call for detailed assertions
 *
 * @example
 * ```ts
 * const request = extractNativeRequest<components['requests']['Activate.Request']>({
 *   nativeModule: mock,
 *   callIndex: 0,
 * });
 * expect(request.configuration.log_level).toBe('error');
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
 * Assert native call matches expected request
 *
 * @example
 * ```ts
 * expectNativeCall({
 *   nativeModule: mock,
 *   method: 'activate',
 *   expectedRequest: ACTIVATE_REQUEST_MINIMAL,
 * });
 * ```
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
 * Reset mock state (call history and implementation)
 */
export function resetNativeModuleMock(mock: MockNativeModule): void {
  mock.handleMethodCall.mockReset();
  mock.addListener.mockReset();
  resetTestEmitter();
}

/**
 * Options for emitNativeEvent function
 */
interface EmitNativeEventOptions {
  eventName: string;
  eventData: any;
}

/**
 * Simple event emitter for testing
 */
class TestEventEmitter {
  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  addListener(eventName: string, listener: (data: any) => void): { remove: () => Promise<void> } {
    const listeners = this.listeners.get(eventName) || [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);

    return {
      remove: async () => {
        const currentListeners = this.listeners.get(eventName) || [];
        const index = currentListeners.indexOf(listener);
        if (index !== -1) {
          currentListeners.splice(index, 1);
        }
      },
    };
  }

  emit(eventName: string, data: any): void {
    const listeners = this.listeners.get(eventName) || [];
    listeners.forEach((listener) => listener(data));
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

let globalTestEmitter: TestEventEmitter | null = null;

/**
 * Get or create global test emitter for event testing
 */
export function getTestEmitter(): TestEventEmitter {
  if (!globalTestEmitter) {
    globalTestEmitter = new TestEventEmitter();
  }
  return globalTestEmitter;
}

/**
 * Reset the global test emitter
 * Should be called in afterEach to ensure clean state between tests
 */
export function resetTestEmitter(): void {
  if (globalTestEmitter) {
    globalTestEmitter.removeAllListeners();
    globalTestEmitter = null;
  }
}

/**
 * Emit a native event for testing
 *
 * Simulates native → JS event flow by emitting events through the test emitter.
 *
 * @param options.eventName - Native event name (e.g., 'on_installation_details_success')
 * @param options.eventData - Event data as object (will be JSON.stringified)
 *
 * @example
 * ```typescript
 * emitNativeEvent({
 *   eventName: 'on_installation_details_success',
 *   eventData: INSTALLATION_DETAILS_SUCCESS
 * });
 * ```
 */
export function emitNativeEvent(options: EmitNativeEventOptions): void {
  const { eventName, eventData } = options;
  const emitter = getTestEmitter();
  emitter.emit(eventName, { data: JSON.stringify(eventData) });
}
