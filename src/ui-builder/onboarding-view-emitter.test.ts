import type { PluginListenerHandle } from '@capacitor/core';

import { AdaptyCapacitorPlugin } from '../bridge/plugin';
import { parseOnboardingEvent } from '../shared/coders/parse-onboarding';
import { LogContext } from '../shared/logger';
import { OnboardingEventId } from '../shared/types/onboarding-events';

import { OnboardingViewEmitter } from './onboarding-view-emitter';

const NATIVE_EVENT_NAMES = {
  error: 'onboarding_did_fail_with_error',
  analytics: 'onboarding_on_analytics_action',
  finishedLoading: 'onboarding_did_finish_loading',
  close: 'onboarding_on_close_action',
  custom: 'onboarding_on_custom_action',
  paywall: 'onboarding_on_paywall_action',
  stateUpdated: 'onboarding_on_state_updated_action',
} as const;

const TEST_VIEW_ID = 'test-onboarding-view-id';
const WRONG_VIEW_ID = 'different-view-id';

const TEST_EVENT_DATA = {
  error: `{"error":{"message":"Test error"},"view":{"id":"${TEST_VIEW_ID}"}}`,
  errorWrongView: `{"error":{"message":"Test error"},"view":{"id":"${WRONG_VIEW_ID}"}}`,
  analytics: `{"id":"analytics_event","event":{"name":"screen_view","element_id":"btn1"},"meta":{"onboardingId":"test","screenClientId":"screen1","screenIndex":0,"totalScreens":3},"view":{"id":"${TEST_VIEW_ID}"}}`,
  finishedLoading: `{"meta":{"onboardingId":"test","screenClientId":"screen1","screenIndex":0,"totalScreens":3},"view":{"id":"${TEST_VIEW_ID}"}}`,
  close: `{"id":"close_action","meta":{"onboardingId":"test","screenClientId":"screen1","screenIndex":0,"totalScreens":3},"view":{"id":"${TEST_VIEW_ID}"}}`,
  custom: `{"id":"custom_action","meta":{"onboardingId":"test","screenClientId":"screen1","screenIndex":0,"totalScreens":3},"view":{"id":"${TEST_VIEW_ID}"}}`,
  paywall: `{"id":"paywall_action","meta":{"onboardingId":"test","screenClientId":"screen1","screenIndex":0,"totalScreens":3},"view":{"id":"${TEST_VIEW_ID}"}}`,
  stateUpdated: `{"action":{"elementId":"input1","elementType":"input","value":{"type":"text","value":"test"}},"meta":{"onboardingId":"test","screenClientId":"screen1","screenIndex":0,"totalScreens":3},"view":{"id":"${TEST_VIEW_ID}"}}`,
} as const;

jest.mock('../bridge/plugin', () => require('../bridge/plugin.mock').mockAdaptyCapacitorPlugin);
jest.mock('../shared/logger', () => require('../shared/logger/logger.mock').mockLogger);
jest.mock('../shared/coders/parse-onboarding', () => require('../shared/coders/parse.mock').mockParse);

describe('OnboardingViewEmitter', () => {
  let emitter: OnboardingViewEmitter;
  let mockBridgeAddListener: jest.MockedFunction<any>;
  let mockParseOnboardingEvent: jest.MockedFunction<typeof parseOnboardingEvent>;
  let mockPluginHandle: PluginListenerHandle;
  let mockLogContext: any;
  let mockLog: any;
  let mockOnRequestClose: jest.MockedFunction<() => Promise<void>>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock plugin handle
    mockPluginHandle = {
      remove: jest.fn().mockResolvedValue(undefined),
    };

    // Setup mock log context
    mockLog = {
      start: jest.fn(),
      success: jest.fn(),
      failed: jest.fn(),
    };

    mockLogContext = {
      call: jest.fn().mockReturnValue(mockLog),
      event: jest.fn().mockReturnValue(mockLog),
      decode: jest.fn().mockReturnValue(mockLog),
    };

    jest.mocked(LogContext).mockImplementation(() => mockLogContext as any);

    // Mock AdaptyCapacitorPlugin
    mockBridgeAddListener = jest.fn() as any;
    (AdaptyCapacitorPlugin as any).addListener = mockBridgeAddListener;
    mockBridgeAddListener.mockResolvedValue(mockPluginHandle);

    mockParseOnboardingEvent = parseOnboardingEvent as jest.MockedFunction<typeof parseOnboardingEvent>;

    mockOnRequestClose = jest.fn().mockResolvedValue(undefined);

    emitter = new OnboardingViewEmitter(TEST_VIEW_ID);
  });

  describe('constructor', () => {
    it('should initialize with provided viewId', async () => {
      const testViewId = 'custom-onboarding-view-id';
      const customEmitter = new OnboardingViewEmitter(testViewId);
      expect(customEmitter).toBeInstanceOf(OnboardingViewEmitter);
    });
  });

  describe('addListener', () => {
    it('should create native event listener for the first handler', async () => {
      const mockListener = jest.fn();
      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.Error,
        error: { message: 'Test error', adaptyCode: 0 },
        view: { id: TEST_VIEW_ID },
      });

      const handle = await await emitter.addListener('onError', mockListener, mockOnRequestClose);

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(1);
      expect(mockBridgeAddListener).toHaveBeenCalledWith(NATIVE_EVENT_NAMES.error, expect.any(Function));
      expect(handle).toBe(mockPluginHandle);
    });

    it('should reuse existing native event listener for subsequent handlers of same native event', async () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      await await emitter.addListener('onError', mockListener1, mockOnRequestClose);
      await await emitter.addListener('onError', mockListener2, mockOnRequestClose);

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(1);
    });

    it('should create separate native listeners for different native events', async () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      await await emitter.addListener('onError', mockListener1, mockOnRequestClose);
      await await emitter.addListener('onAnalytics', mockListener2, mockOnRequestClose);

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(2);
      expect(mockBridgeAddListener).toHaveBeenNthCalledWith(1, NATIVE_EVENT_NAMES.error, expect.any(Function));
      expect(mockBridgeAddListener).toHaveBeenNthCalledWith(2, NATIVE_EVENT_NAMES.analytics, expect.any(Function));
    });

    it('should throw error for unsupported event', async () => {
      const mockListener = jest.fn();

      await expect(emitter.addListener('invalidEvent' as any, mockListener, mockOnRequestClose)).rejects.toThrow(
        'No event config found for handler: invalidEvent',
      );
    });

    it('should not subscribe natively when event is unsupported', async () => {
      const mockListener = jest.fn();

      await expect(emitter.addListener('invalidEvent' as any, mockListener, mockOnRequestClose)).rejects.toThrow();

      expect(mockBridgeAddListener).not.toHaveBeenCalled();
    });

    it('should filter events by viewId and only call handlers for matching view', async () => {
      const mockListener = jest.fn();
      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.Error,
        error: { message: 'Test error', adaptyCode: 0 },
        view: { id: WRONG_VIEW_ID },
      });

      await await emitter.addListener('onError', mockListener, mockOnRequestClose);

      // Get the native listener callback
      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      // Simulate native event with wrong view ID
      nativeCallback({ data: TEST_EVENT_DATA.errorWrongView });

      expect(mockListener).not.toHaveBeenCalled();
      expect(mockOnRequestClose).not.toHaveBeenCalled();
    });

    it('should call handler when viewId matches', async () => {
      const mockListener = jest.fn().mockReturnValue(false);
      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.Error,
        error: { message: 'Test error', adaptyCode: 0 },
        view: { id: TEST_VIEW_ID },
      });

      await await emitter.addListener('onError', mockListener, mockOnRequestClose);

      // Get the native listener callback
      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      // Simulate native event
      nativeCallback({ data: TEST_EVENT_DATA.error });

      expect(mockListener).toHaveBeenCalledWith({ message: 'Test error', adaptyCode: 0 });
      expect(mockOnRequestClose).not.toHaveBeenCalled();
    });

    it('should call onRequestClose when handler returns true', async () => {
      const mockListener = jest.fn().mockReturnValue(true);
      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.FinishedLoading,
        meta: { onboardingId: 'test', screenClientId: 'screen1', screenIndex: 0, totalScreens: 3 },
        view: { id: TEST_VIEW_ID },
      });

      await await emitter.addListener('onFinishedLoading', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.finishedLoading });

      expect(mockListener).toHaveBeenCalledWith({
        onboardingId: 'test',
        screenClientId: 'screen1',
        screenIndex: 0,
        totalScreens: 3,
      });
      expect(mockOnRequestClose).toHaveBeenCalledTimes(1);
    });

    it('should pass correct arguments to handlers based on event type', async () => {
      const errorListener = jest.fn();
      const analyticsListener = jest.fn();
      const closeListener = jest.fn();
      const stateUpdatedListener = jest.fn();

      // Test onError
      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.Error,
        error: { message: 'Test error', adaptyCode: 0 },
        view: { id: TEST_VIEW_ID },
      });

      await await emitter.addListener('onError', errorListener, mockOnRequestClose);

      let nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.error });

      expect(errorListener).toHaveBeenCalledWith({ message: 'Test error', adaptyCode: 0 });

      // Test onAnalytics
      const mockEvent = { name: 'screen_view', element_id: 'btn1', elementId: 'btn1' };
      const mockMeta = { onboardingId: 'test', screenClientId: 'screen1', screenIndex: 0, totalScreens: 3 };
      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.Analytics,
        event: mockEvent,
        meta: mockMeta,
        view: { id: TEST_VIEW_ID },
      });

      await await emitter.addListener('onAnalytics', analyticsListener, mockOnRequestClose);

      nativeCallback = mockBridgeAddListener.mock.calls[1][1];
      nativeCallback({ data: TEST_EVENT_DATA.analytics });

      expect(analyticsListener).toHaveBeenCalledWith(mockEvent, mockMeta);

      // Test onClose
      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.Close,
        actionId: 'close_action',
        meta: mockMeta,
        view: { id: TEST_VIEW_ID },
      });

      await await emitter.addListener('onClose', closeListener, mockOnRequestClose);

      nativeCallback = mockBridgeAddListener.mock.calls[2][1];
      nativeCallback({ data: TEST_EVENT_DATA.close });

      expect(closeListener).toHaveBeenCalledWith('close_action', mockMeta);

      // Test onStateUpdated
      const mockAction = {
        elementId: 'input1',
        elementType: 'input' as const,
        value: { type: 'text' as const, value: 'test' },
      };
      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.StateUpdated,
        action: mockAction,
        meta: mockMeta,
        view: { id: TEST_VIEW_ID },
      });

      await await emitter.addListener('onStateUpdated', stateUpdatedListener, mockOnRequestClose);

      nativeCallback = mockBridgeAddListener.mock.calls[3][1];
      nativeCallback({ data: TEST_EVENT_DATA.stateUpdated });

      expect(stateUpdatedListener).toHaveBeenCalledWith(mockAction, mockMeta);
    });

    it('should handle parsing errors gracefully', async () => {
      const mockListener = jest.fn();
      mockParseOnboardingEvent.mockImplementation(() => {
        throw new Error('Parse error');
      });

      await await emitter.addListener('onError', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      expect(() => {
        nativeCallback({ data: 'invalid-json' });
      }).toThrow('Parse error');

      expect(mockListener).not.toHaveBeenCalled();
      expect(mockLog.failed).toHaveBeenCalled();
    });

    it('should handle invalid event data format', async () => {
      const mockListener = jest.fn();

      await await emitter.addListener('onError', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      expect(() => {
        nativeCallback({ data: 123 as any });
      }).toThrow('Expected event data to be JSON string');

      expect(mockListener).not.toHaveBeenCalled();
      expect(mockLog.failed).toHaveBeenCalled();
    });

    it('should handle missing data field on native event', async () => {
      const mockListener = jest.fn();

      await await emitter.addListener('onError', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      expect(() => {
        nativeCallback({} as any);
      }).toThrow('Invalid event format received');

      expect(mockListener).not.toHaveBeenCalled();
      expect(mockLog.failed).toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      const mockListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.Error,
        error: { message: 'Test error', adaptyCode: 0 },
        view: { id: TEST_VIEW_ID },
      });

      await await emitter.addListener('onError', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      nativeCallback({ data: TEST_EVENT_DATA.error });

      expect(mockListener).toHaveBeenCalled();
      expect(mockLog.failed).toHaveBeenCalled();
    });

    it('should handle onRequestClose errors gracefully', async () => {
      const mockListener = jest.fn().mockReturnValue(true);
      const mockOnRequestCloseWithError = jest.fn().mockRejectedValue(new Error('Close error'));
      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.FinishedLoading,
        meta: { onboardingId: 'test', screenClientId: 'screen1', screenIndex: 0, totalScreens: 3 },
        view: { id: TEST_VIEW_ID },
      });

      await await emitter.addListener('onFinishedLoading', mockListener, mockOnRequestCloseWithError);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.finishedLoading });

      expect(mockListener).toHaveBeenCalled();
      expect(mockOnRequestCloseWithError).toHaveBeenCalledTimes(1);

      // Wait for the async error handling
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLog.failed).toHaveBeenCalled();
    });

    it('should pass parseOnboardingEvent context correctly', async () => {
      const mockListener = jest.fn();

      mockParseOnboardingEvent.mockImplementation((input, ctx) => {
        expect(typeof input).toBe('string');
        expect(ctx).toBe(mockLogContext);
        return {
          id: OnboardingEventId.Error,
          error: { message: 'Test error', adaptyCode: 0 },
          view: { id: TEST_VIEW_ID },
        };
      });

      await await emitter.addListener('onError', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.error });

      expect(mockLogContext.event).toHaveBeenCalledWith({ methodName: NATIVE_EVENT_NAMES.error });
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all native subscriptions', async () => {
      const mockHandle1 = { remove: jest.fn().mockResolvedValue(undefined) };
      const mockHandle2 = { remove: jest.fn().mockResolvedValue(undefined) };
      mockBridgeAddListener.mockReturnValueOnce(mockHandle1).mockReturnValueOnce(mockHandle2);

      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      await emitter.addListener('onError', mockListener1, mockOnRequestClose);
      await emitter.addListener('onAnalytics', mockListener2, mockOnRequestClose);

      emitter.removeAllListeners();

      expect(mockHandle1.remove).toHaveBeenCalledTimes(1);
      expect(mockHandle2.remove).toHaveBeenCalledTimes(1);
    });

    it('should clear all internal state', async () => {
      const mockHandle1 = { remove: jest.fn().mockResolvedValue(undefined) };
      const mockHandle2 = { remove: jest.fn().mockResolvedValue(undefined) };
      mockBridgeAddListener.mockReturnValueOnce(mockHandle1).mockReturnValueOnce(mockHandle2);

      const mockListener = jest.fn();
      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.Error,
        error: { message: 'Test error', adaptyCode: 0 },
        view: { id: TEST_VIEW_ID },
      });

      await emitter.addListener('onError', mockListener, mockOnRequestClose);
      emitter.removeAllListeners();

      // Try to add listener again - should create new native subscription
      await emitter.addListener('onError', mockListener, mockOnRequestClose);

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(2);
    });

    it('should handle removal errors gracefully', async () => {
      const mockHandle = { remove: jest.fn().mockRejectedValue(new Error('Remove failed')) };
      mockBridgeAddListener.mockReturnValue(mockHandle);

      const mockListener = jest.fn();

      await emitter.addListener('onError', mockListener, mockOnRequestClose);

      expect(() => {
        emitter.removeAllListeners();
      }).not.toThrow();

      expect(mockHandle.remove).toHaveBeenCalledTimes(1);
    });

    it('should work when called without any listeners', async () => {
      expect(() => {
        emitter.removeAllListeners();
      }).not.toThrow();

      expect(mockBridgeAddListener).not.toHaveBeenCalled();
    });
  });

  describe('event type handling', () => {
    it('should handle all supported event types correctly', async () => {
      const handlers = {
        onError: jest.fn(),
        onAnalytics: jest.fn(),
        onFinishedLoading: jest.fn(),
        onClose: jest.fn(),
        onCustom: jest.fn(),
        onPaywall: jest.fn(),
        onStateUpdated: jest.fn(),
      };

      // Add all listeners
      for (const [eventName, handler] of Object.entries(handlers)) {
        await await emitter.addListener(eventName as any, handler as any, mockOnRequestClose);
      }

      // Should have registered listeners for unique native events
      const expectedNativeEvents = new Set(Object.values(NATIVE_EVENT_NAMES)).size;
      expect(mockBridgeAddListener).toHaveBeenCalledTimes(expectedNativeEvents);
    });

    it('should replace handlers for same event type (new replaces old)', async () => {
      const handler1 = jest.fn().mockReturnValue(false);
      const handler2 = jest.fn().mockReturnValue(true);
      const onRequestClose1 = jest.fn().mockResolvedValue(undefined);
      const onRequestClose2 = jest.fn().mockResolvedValue(undefined);

      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.Error,
        error: { message: 'Test error', adaptyCode: 0 },
        view: { id: TEST_VIEW_ID },
      });

      // Add first handler
      await await emitter.addListener('onError', handler1, onRequestClose1);
      // Add second handler - should replace first
      await await emitter.addListener('onError', handler2, onRequestClose2);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.error });

      expect(handler1).not.toHaveBeenCalled(); // handler1 was replaced
      expect(handler2).toHaveBeenCalledWith({ message: 'Test error', adaptyCode: 0 }); // only handler2 should be called
      expect(onRequestClose1).not.toHaveBeenCalled(); // handler1 was not called
      expect(onRequestClose2).toHaveBeenCalled(); // handler2 returned true
    });

    it('should isolate handlers across different views (cross-view isolation)', async () => {
      const viewEmitter1 = new OnboardingViewEmitter('view-1');
      const viewEmitter2 = new OnboardingViewEmitter('view-2');

      const listener1 = jest.fn();
      const listener2 = jest.fn();

      mockParseOnboardingEvent.mockImplementation((input) => {
        const data = JSON.parse(input);
        return {
          id: OnboardingEventId.Error,
          error: data.error || { message: 'Test error', adaptyCode: 0 },
          view: data.view,
        };
      });

      await await viewEmitter1.addListener('onError', listener1, mockOnRequestClose);
      await await viewEmitter2.addListener('onError', listener2, mockOnRequestClose);

      // Simulate event for view-1
      const callback1 = mockBridgeAddListener.mock.calls[0][1];
      callback1({ data: `{"error":{"message":"Test error","adaptyCode":0},"view":{"id":"view-1"}}` });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();

      listener1.mockClear();
      listener2.mockClear();

      // Simulate event for view-2
      const callback2 = mockBridgeAddListener.mock.calls[1][1];
      callback2({ data: `{"error":{"message":"Test error","adaptyCode":0},"view":{"id":"view-2"}}` });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('logging', () => {
    it('should log native event processing', async () => {
      const mockListener = jest.fn();
      mockParseOnboardingEvent.mockReturnValue({
        id: OnboardingEventId.Error,
        error: { message: 'Test error', adaptyCode: 0 },
        view: { id: TEST_VIEW_ID },
      });

      await await emitter.addListener('onError', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.error });

      expect(mockLogContext.event).toHaveBeenCalledWith({ methodName: NATIVE_EVENT_NAMES.error });
      expect(mockLog.start).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Memory leak prevention', () => {
    it('should not accumulate handlers with repeated add/remove cycles', async () => {
      const initialListenersSize = (emitter as any).eventListeners.size;
      const initialHandlersSize = (emitter as any).handlers.size;

      for (let i = 0; i < 10; i++) {
        const mockListener = jest.fn();
        await emitter.addListener('onError', mockListener as any, mockOnRequestClose);
        emitter.removeAllListeners();
      }

      expect((emitter as any).eventListeners.size).toBe(initialListenersSize);
      expect((emitter as any).handlers.size).toBe(initialHandlersSize);
    });

    it('should handle concurrent add/remove operations without memory leaks', async () => {
      const listeners: (() => boolean)[] = [];

      // Add 5 concurrent handlers for the same event type - only the last should remain
      const addPromises = Array.from({ length: 5 }, async () => {
        const listener = jest.fn().mockReturnValue(false);
        listeners.push(listener);
        return emitter.addListener('onError', listener as any, mockOnRequestClose);
      });

      await Promise.all(addPromises);

      // Should have only 1 handler (the last one added replaces previous ones)
      const handlerData = (emitter as any).handlers.get('onError');
      expect(handlerData).toBeDefined();
      expect((emitter as any).handlers.size).toBe(1);

      emitter.removeAllListeners();

      expect((emitter as any).eventListeners.has(NATIVE_EVENT_NAMES.error)).toBe(false);
      expect((emitter as any).handlers.has('onError')).toBe(false);
    });

    it('should cleanup handlers even when some subscription removals fail', async () => {
      const failingHandle = { remove: jest.fn().mockRejectedValue(new Error('Remove failed')) } as any;
      mockBridgeAddListener.mockReturnValueOnce(failingHandle);

      await emitter.addListener('onError', jest.fn() as any, mockOnRequestClose);

      emitter.removeAllListeners();

      expect((emitter as any).eventListeners.size).toBe(0);
      expect((emitter as any).handlers.size).toBe(0);
    });
  });
});
