import type { PluginListenerHandle } from '@capacitor/core';

import { AdaptyEmitter } from './adapty-emitter';
import { AdaptyCapacitorPlugin } from './bridge/plugin';
import { parseCommonEvent } from './coders/parse';
import { LogContext } from './logger';

const EVENT_NAMES = {
  didLoadLatestProfile: 'did_load_latest_profile',
  didReceivePromotedPurchase: 'did_receive_promoted_purchase',
  onInstallationDetailsSuccess: 'on_installation_details_success',
  onInstallationDetailsFail: 'on_installation_details_fail',
} as const;

/** Lets the pending promise chains inside the emitter settle. */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

const TEST_EVENT_DATA = {
  profile: `{"id":"${EVENT_NAMES.didLoadLatestProfile}","profile":{}}`,
  installationSuccess: `{"id":"${EVENT_NAMES.onInstallationDetailsSuccess}","details":{"payload":"","install_id":"8716c26f-2e95-482e-a441-14b06a67792d","install_time":"2025-08-22T16:36:43.533Z","app_launch_count":16}}`,
  installationFail: `{"id":"${EVENT_NAMES.onInstallationDetailsFail}","error":{}}`,
  promotedPurchase: `{"id":"${EVENT_NAMES.didReceivePromotedPurchase}","product":{}}`,
} as const;

jest.mock('./bridge/plugin', () => require('./bridge/plugin.mock').mockAdaptyCapacitorPlugin);
jest.mock('./logger', () => require('./logger/logger.mock').mockLogger);
jest.mock('./coders/parse', () => require('./coders/parse.mock').mockParse);

describe('AdaptyEmitter', () => {
  let emitter: AdaptyEmitter;
  let mockBridgeAddListener: jest.MockedFunction<typeof AdaptyCapacitorPlugin.addListener>;
  let mockParseCommonEvent: jest.MockedFunction<typeof parseCommonEvent>;
  let mockPluginHandle: PluginListenerHandle;
  let mockLogContext: any;
  let mockLog: any;

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
    };

    jest.mocked(LogContext).mockImplementation(() => mockLogContext as any);

    mockBridgeAddListener = AdaptyCapacitorPlugin.addListener as jest.MockedFunction<
      typeof AdaptyCapacitorPlugin.addListener
    >;
    mockBridgeAddListener.mockResolvedValue(mockPluginHandle);

    mockParseCommonEvent = parseCommonEvent as jest.MockedFunction<typeof parseCommonEvent>;

    emitter = new AdaptyEmitter();
  });

  describe('addListener', () => {
    it('should create native event listener for the first handler', async () => {
      const mockListener = jest.fn();
      const mockProfile = { profileId: 'test-profile' };
      mockParseCommonEvent.mockReturnValue(mockProfile);

      await emitter.addListener('onLatestProfileLoad', mockListener);

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(1);
      expect(mockBridgeAddListener).toHaveBeenCalledWith(EVENT_NAMES.didLoadLatestProfile, expect.any(Function));
    });

    it('should reuse existing native event listener for subsequent handlers', async () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      await emitter.addListener('onLatestProfileLoad', mockListener1);
      await emitter.addListener('onLatestProfileLoad', mockListener2);

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(1);
    });

    it('should return unique wrapper handles for each listener', async () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      const handle1 = await emitter.addListener('onLatestProfileLoad', mockListener1);
      const handle2 = await emitter.addListener('onLatestProfileLoad', mockListener2);

      expect(handle1).not.toBe(handle2);
      expect(handle1.remove).toBeInstanceOf(Function);
      expect(handle2.remove).toBeInstanceOf(Function);
    });

    it('should throw error for unsupported event', async () => {
      const mockListener = jest.fn();

      await expect(emitter.addListener('invalidEvent' as any, mockListener)).rejects.toThrow(
        '[Adapty] Unsupported event: invalidEvent',
      );
    });

    it('should not subscribe natively when event is unsupported', async () => {
      const mockListener = jest.fn();

      await expect(emitter.addListener('invalidEvent' as any, mockListener)).rejects.toThrow(
        '[Adapty] Unsupported event: invalidEvent',
      );

      expect(mockBridgeAddListener).not.toHaveBeenCalled();
    });

    it('should call all registered handlers when native event fires', async () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();
      const mockProfile = { profileId: 'test-profile' };
      mockParseCommonEvent.mockReturnValue(mockProfile);

      await emitter.addListener('onLatestProfileLoad', mockListener1);
      await emitter.addListener('onLatestProfileLoad', mockListener2);

      // Get the native listener callback
      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      // Simulate native event
      nativeCallback({ data: TEST_EVENT_DATA.profile });

      expect(mockListener1).toHaveBeenCalledWith({ profile: mockProfile });
      expect(mockListener2).toHaveBeenCalledWith({ profile: mockProfile });
    });

    it('should preserve handler invocation order', async () => {
      const callOrder: string[] = [];
      const mockListener1 = jest.fn(() => callOrder.push('first'));
      const mockListener2 = jest.fn(() => callOrder.push('second'));
      mockParseCommonEvent.mockReturnValue({});

      await emitter.addListener('onLatestProfileLoad', mockListener1);
      await emitter.addListener('onLatestProfileLoad', mockListener2);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.profile });

      expect(callOrder).toEqual(['first', 'second']);
    });

    it('should pass correct native methodName into parser and logger', async () => {
      const mockListener = jest.fn();

      mockParseCommonEvent.mockImplementation((native, raw, ctx) => {
        expect(native).toBe(EVENT_NAMES.didLoadLatestProfile);
        expect(typeof raw).toBe('string');
        expect(ctx).toBe(mockLogContext);
        return {} as any;
      });

      await emitter.addListener('onLatestProfileLoad', mockListener);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.profile });

      expect(mockLogContext.event).toHaveBeenCalledWith({ methodName: EVENT_NAMES.didLoadLatestProfile });
    });

    it('should handle parsing errors gracefully', async () => {
      const mockListener = jest.fn();
      mockParseCommonEvent.mockImplementation(() => {
        throw new Error('Parse error');
      });

      await emitter.addListener('onLatestProfileLoad', mockListener);

      // Get the native listener callback
      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      // Simulate native event with invalid data
      nativeCallback({ data: 'invalid-json' });

      expect(mockListener).not.toHaveBeenCalled();
      expect(mockLog.failed).toHaveBeenCalled();
    });

    it('should handle invalid event data format', async () => {
      const mockListener = jest.fn();

      await emitter.addListener('onLatestProfileLoad', mockListener);

      // Get the native listener callback
      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      // Simulate native event with invalid format
      nativeCallback({ data: 123 as any });

      expect(mockListener).not.toHaveBeenCalled();
      expect(mockLog.failed).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should handle missing data field on native event', async () => {
      const mockListener = jest.fn();

      await emitter.addListener('onLatestProfileLoad', mockListener);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({} as any);

      expect(mockListener).not.toHaveBeenCalled();

      const failedFactory = mockLog.failed.mock.calls[0]?.[0];
      expect(typeof failedFactory).toBe('function');
      const failedPayload = failedFactory?.();
      expect(failedPayload?.error).toBeInstanceOf(Error);
      expect(String(failedPayload?.error?.message || failedPayload?.error)).toContain('Expected event data');
    });

    it('should handle null parsed payload', async () => {
      const mockListener = jest.fn();
      mockParseCommonEvent.mockReturnValue(null);

      await emitter.addListener('onLatestProfileLoad', mockListener);

      // Get the native listener callback
      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      // Simulate native event
      nativeCallback({ data: TEST_EVENT_DATA.profile });

      expect(mockListener).not.toHaveBeenCalled();
      expect(mockLog.failed).toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', async () => {
      const mockListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const mockProfile = { profileId: 'test-profile' };
      mockParseCommonEvent.mockReturnValue(mockProfile);

      await emitter.addListener('onLatestProfileLoad', mockListener);

      // Get the native listener callback
      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      // Simulate native event
      nativeCallback({ data: TEST_EVENT_DATA.profile });

      expect(mockListener).toHaveBeenCalled();
      expect(mockLog.failed).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('removeHandler (via wrapper handle)', () => {
    it('should remove specific handler and keep others', async () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();
      const mockProfile = { profileId: 'test-profile' };
      mockParseCommonEvent.mockReturnValue(mockProfile);

      const handle1 = await emitter.addListener('onLatestProfileLoad', mockListener1);
      await emitter.addListener('onLatestProfileLoad', mockListener2);

      // Remove first handler
      await handle1.remove();

      // Simulate native event
      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.profile });

      expect(mockListener1).not.toHaveBeenCalled();
      expect(mockListener2).toHaveBeenCalledWith({ profile: mockProfile });
    });

    it('should remove native subscription when removing last handler', async () => {
      const mockListener = jest.fn();

      const handle = await emitter.addListener('onLatestProfileLoad', mockListener);
      await handle.remove();

      expect(mockPluginHandle.remove).toHaveBeenCalledTimes(1);
    });

    it('should not remove native subscription when other handlers exist', async () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      const handle1 = await emitter.addListener('onLatestProfileLoad', mockListener1);
      await emitter.addListener('onLatestProfileLoad', mockListener2);

      await handle1.remove();

      expect(mockPluginHandle.remove).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent handler gracefully', async () => {
      const mockListener = jest.fn();

      const handle = await emitter.addListener('onLatestProfileLoad', mockListener);

      // Remove the same handler twice
      await handle.remove();
      await handle.remove();

      expect(mockLog.success).toHaveBeenCalled();
    });

    it('should call native remove only once when removing same handle twice', async () => {
      const mockListener = jest.fn();

      const handle = await emitter.addListener('onLatestProfileLoad', mockListener);
      await handle.remove();
      await handle.remove();

      expect(mockPluginHandle.remove).toHaveBeenCalledTimes(1);
    });

    it('should handle native subscription removal error', async () => {
      const mockListener = jest.fn();
      mockPluginHandle.remove = jest.fn().mockRejectedValue(new Error('Remove failed'));

      const handle = await emitter.addListener('onLatestProfileLoad', mockListener);
      await handle.remove();

      expect(mockLog.failed).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all native subscriptions', async () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      await emitter.addListener('onLatestProfileLoad', mockListener1);
      await emitter.addListener('onInstallationDetailsSuccess', mockListener2);

      await emitter.removeAllListeners();

      expect(mockPluginHandle.remove).toHaveBeenCalledTimes(2);
      expect(mockLog.success).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should clear all internal state', async () => {
      const mockListener = jest.fn();
      const mockProfile = { profileId: 'test-profile' };
      mockParseCommonEvent.mockReturnValue(mockProfile);

      await emitter.addListener('onLatestProfileLoad', mockListener);
      await emitter.removeAllListeners();

      // Try to add listener again - should create new native subscription
      await emitter.addListener('onLatestProfileLoad', mockListener);

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(2);
    });

    it('should handle removal errors gracefully', async () => {
      const mockListener = jest.fn();
      mockPluginHandle.remove = jest.fn().mockRejectedValue(new Error('Remove failed'));

      await emitter.addListener('onLatestProfileLoad', mockListener);
      await emitter.removeAllListeners();

      // Internal state must be cleared even if native removal fails
      expect((emitter as any).nativeEventListeners.size).toBe(0);
      expect((emitter as any).externalHandlers.size).toBe(0);

      expect(mockLog.failed).toHaveBeenCalled();
      expect(mockLog.success).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('event type handling', () => {
    it('should handle onInstallationDetailsSuccess event', async () => {
      const mockListener = jest.fn();
      const mockDetails = { installationStatus: 'active' };
      mockParseCommonEvent.mockReturnValue(mockDetails);

      await emitter.addListener('onInstallationDetailsSuccess', mockListener);

      expect(mockBridgeAddListener).toHaveBeenCalledWith(
        EVENT_NAMES.onInstallationDetailsSuccess,
        expect.any(Function),
      );

      // Simulate native event
      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.installationSuccess });

      expect(mockListener).toHaveBeenCalledWith({ details: mockDetails });
    });

    it('should handle onInstallationDetailsFail event', async () => {
      const mockListener = jest.fn();
      const mockError = { message: 'Installation failed' };
      mockParseCommonEvent.mockReturnValue(mockError);

      await emitter.addListener('onInstallationDetailsFail', mockListener);

      expect(mockBridgeAddListener).toHaveBeenCalledWith(EVENT_NAMES.onInstallationDetailsFail, expect.any(Function));

      // Simulate native event
      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.installationFail });

      expect(mockListener).toHaveBeenCalledWith({ error: mockError });
    });

    it('should isolate handlers across different events (cross-event isolation)', async () => {
      const profileListener = jest.fn();
      const detailsListener = jest.fn();

      mockParseCommonEvent.mockImplementation((native) => {
        if (native === EVENT_NAMES.didLoadLatestProfile) return { id: 'p' } as any;
        if (native === EVENT_NAMES.onInstallationDetailsSuccess) return { id: 'd' } as any;
        return {} as any;
      });

      await emitter.addListener('onLatestProfileLoad', profileListener);
      await emitter.addListener('onInstallationDetailsSuccess', detailsListener);

      const profileCb = mockBridgeAddListener.mock.calls[0][1];
      const detailsCb = mockBridgeAddListener.mock.calls[1][1];

      profileCb({ data: TEST_EVENT_DATA.profile });
      expect(profileListener).toHaveBeenCalled();
      expect(detailsListener).not.toHaveBeenCalled();

      profileListener.mockClear();
      detailsListener.mockClear();

      detailsCb({ data: TEST_EVENT_DATA.installationSuccess });
      expect(detailsListener).toHaveBeenCalled();
      expect(profileListener).not.toHaveBeenCalled();
    });
  });

  describe('logging', () => {
    it('should log addListener operations', async () => {
      const mockListener = jest.fn();

      await emitter.addListener('onLatestProfileLoad', mockListener);

      expect(mockLogContext.call).toHaveBeenCalledWith({ methodName: 'addListener' });
      expect(mockLog.start).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should log removeHandler operations', async () => {
      const mockListener = jest.fn();

      const handle = await emitter.addListener('onLatestProfileLoad', mockListener);
      await handle.remove();

      expect(mockLogContext.call).toHaveBeenCalledWith({ methodName: 'removeHandler' });
      expect(mockLog.start).toHaveBeenCalled();
    });

    it('should log removeAllListeners operations', async () => {
      await emitter.removeAllListeners();

      expect(mockLogContext.call).toHaveBeenCalledWith({ methodName: 'removeAllListeners' });
      expect(mockLog.start).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should mark success when removeAllListeners is called without any listeners', async () => {
      await emitter.removeAllListeners();

      const successFactory = mockLog.success.mock.calls[0]?.[0];
      expect(typeof successFactory).toBe('function');
      const successPayload = successFactory?.();
      expect(successPayload?.message).toContain('All listeners removed successfully');
    });
  });

  describe('Memory leak prevention', () => {
    it('should not accumulate handlers with repeated add/remove cycles', async () => {
      const initialNativeSize = (emitter as any).nativeEventListeners.size;
      const initialHandlersSize = (emitter as any).externalHandlers.size;

      // Simulate multiple add/remove cycles
      for (let i = 0; i < 10; i++) {
        const mockListener = jest.fn();
        const handle = await emitter.addListener('onLatestProfileLoad', mockListener);
        await handle.remove();
      }

      // Verify no memory accumulation
      expect((emitter as any).nativeEventListeners.size).toBe(initialNativeSize);
      expect((emitter as any).externalHandlers.size).toBe(initialHandlersSize);
    });

    it('should handle concurrent add/remove operations without memory leaks', async () => {
      const listeners: (() => void)[] = [];
      const handles: { remove: () => Promise<void> }[] = [];

      // Add multiple listeners concurrently
      const addPromises = Array.from({ length: 5 }, async () => {
        const listener = jest.fn();
        listeners.push(listener);
        const handle = await emitter.addListener('onLatestProfileLoad', listener);
        handles.push(handle);
        return handle;
      });

      await Promise.all(addPromises);

      // Verify all handlers are tracked
      const profileHandlers = (emitter as any).externalHandlers.get('did_load_latest_profile');
      expect(profileHandlers).toHaveLength(5);

      // Remove all handlers concurrently
      const removePromises = handles.map((handle) => handle.remove());
      await Promise.all(removePromises);

      // Verify complete cleanup
      expect((emitter as any).nativeEventListeners.has('did_load_latest_profile')).toBe(false);
      expect((emitter as any).externalHandlers.has('did_load_latest_profile')).toBe(false);
    });

    it('should generate unique handler IDs to prevent collisions', async () => {
      const listeners = Array.from({ length: 20 }, () => jest.fn());

      // Add many listeners
      for (const listener of listeners) {
        await emitter.addListener('onLatestProfileLoad', listener);
      }

      // Verify all handlers have unique IDs
      const profileHandlers = (emitter as any).externalHandlers.get('did_load_latest_profile');
      const handlerIds = profileHandlers.map((h: any) => h.id);
      const uniqueIds = new Set(handlerIds);

      expect(uniqueIds.size).toBe(handlerIds.length);
      expect(uniqueIds.size).toBe(20);
    });
  });
  describe('SDK-owned events', () => {
    it('should subscribe natively without any app handler', async () => {
      await emitter.addInternalListener('onPromotedPurchaseReceived', jest.fn());

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(1);
      expect(mockBridgeAddListener).toHaveBeenCalledWith('did_receive_promoted_purchase', expect.any(Function));
    });

    it('should subscribe only once across repeated calls', async () => {
      await emitter.addInternalListener('onPromotedPurchaseReceived', jest.fn());
      await emitter.addInternalListener('onPromotedPurchaseReceived', jest.fn());

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(1);
    });

    it('should run the fallback when no app handler is registered', async () => {
      const fallback = jest.fn();
      mockParseCommonEvent.mockReturnValue({ vendorProductId: 'yearly.premium.6999' });

      await emitter.addInternalListener('onPromotedPurchaseReceived', fallback);

      const nativeHandler = mockBridgeAddListener.mock.calls[0]![1];
      nativeHandler({ data: '{"id":"did_receive_promoted_purchase","product":{}}' });

      expect(fallback).toHaveBeenCalledTimes(1);
      expect(fallback).toHaveBeenCalledWith({ product: { vendorProductId: 'yearly.premium.6999' } });
    });

    it('should skip the fallback while an app handler is registered', async () => {
      const fallback = jest.fn();
      const listener = jest.fn();
      mockParseCommonEvent.mockReturnValue({ vendorProductId: 'yearly.premium.6999' });

      await emitter.addInternalListener('onPromotedPurchaseReceived', fallback);
      await emitter.addListener('onPromotedPurchaseReceived', listener);

      const nativeHandler = mockBridgeAddListener.mock.calls[0]![1];
      nativeHandler({ data: '{"id":"did_receive_promoted_purchase","product":{}}' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(fallback).not.toHaveBeenCalled();
    });

    it('should keep the native subscription when the last app handler is removed', async () => {
      await emitter.addInternalListener('onPromotedPurchaseReceived', jest.fn());
      const handle = await emitter.addListener('onPromotedPurchaseReceived', jest.fn());

      await handle.remove();

      expect(mockPluginHandle.remove).not.toHaveBeenCalled();
    });

    it('should re-subscribe an observed event after removeAllListeners', async () => {
      await emitter.addInternalListener('onPromotedPurchaseReceived', jest.fn());

      await emitter.removeAllListeners();

      expect(mockPluginHandle.remove).toHaveBeenCalledTimes(1);
      expect(mockBridgeAddListener).toHaveBeenCalledTimes(2);
    });

    it('should not re-subscribe an event that was never observed', async () => {
      await emitter.addListener('onLatestProfileLoad', jest.fn());

      await emitter.removeAllListeners();

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(1);
    });

    it('should issue a single native subscription for concurrent addInternalListener calls', async () => {
      // Neither call is awaited before the other starts, and the native
      // subscription stays unresolved until both are past the idempotency check
      // — the exact window in which a plain `has()` guard would let both through
      // and leave two live subscriptions dispatching every event twice.
      let resolveSubscription!: (handle: PluginListenerHandle) => void;
      mockBridgeAddListener.mockImplementationOnce(
        () =>
          new Promise<PluginListenerHandle>((resolve) => {
            resolveSubscription = resolve;
          }),
      );

      const first = emitter.addInternalListener('onPromotedPurchaseReceived', jest.fn());
      const second = emitter.addInternalListener('onPromotedPurchaseReceived', jest.fn());

      resolveSubscription(mockPluginHandle);
      await Promise.all([first, second]);

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(1);
      expect((emitter as any).nativeEventListeners.size).toBe(1);
    });

    it('should dispatch a concurrently observed event to the fallback exactly once', async () => {
      const fallback = jest.fn();
      mockParseCommonEvent.mockReturnValue({ vendorProductId: 'yearly.premium.6999' });

      let resolveSubscription!: (handle: PluginListenerHandle) => void;
      mockBridgeAddListener.mockImplementationOnce(
        () =>
          new Promise<PluginListenerHandle>((resolve) => {
            resolveSubscription = resolve;
          }),
      );

      const first = emitter.addInternalListener('onPromotedPurchaseReceived', fallback);
      const second = emitter.addInternalListener('onPromotedPurchaseReceived', fallback);
      resolveSubscription(mockPluginHandle);
      await Promise.all([first, second]);

      // Every registered native handler would receive the event; only one exists.
      for (const call of mockBridgeAddListener.mock.calls) {
        call[1]({ data: TEST_EVENT_DATA.promotedPurchase });
      }

      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('should retry the subscription after a failed attempt', async () => {
      // A rejected request must not poison the in-flight cache: the next call
      // has to be able to try again.
      mockBridgeAddListener.mockRejectedValueOnce(new Error('bridge unavailable'));

      await expect(emitter.addInternalListener('onPromotedPurchaseReceived', jest.fn())).rejects.toThrow(
        'bridge unavailable',
      );

      await emitter.addInternalListener('onPromotedPurchaseReceived', jest.fn());

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(2);
      expect((emitter as any).nativeEventListeners.has('did_receive_promoted_purchase')).toBe(true);
    });

    it('should dispatch once when removeAllListeners races an in-flight subscribe', async () => {
      // The cold-launch shape: activate()'s own subscribe has not been
      // acknowledged yet when the app tears its listeners down, and the promoted
      // purchase arrives inside that window. A teardown that drops the in-flight
      // request neither removes it nor waits for it, so the re-subscribe leaves
      // TWO live native subscriptions dispatching the same event — and with no
      // app handler each one runs the fallback, i.e. buys the product twice.
      const fallback = jest.fn();
      mockParseCommonEvent.mockReturnValue({ vendorProductId: 'yearly.premium.6999' });

      // Stands in for the native side: a callback is live from the moment the
      // bridge receives it, only the acknowledgement is late.
      const liveHandlers = new Set<(arg: { data: string }) => void>();
      let releaseFirstSubscribe!: () => void;
      const firstSubscribeAcknowledged = new Promise<void>((resolve) => {
        releaseFirstSubscribe = resolve;
      });
      let subscribeCount = 0;

      mockBridgeAddListener.mockImplementation(async (_eventName, listenerFunc) => {
        liveHandlers.add(listenerFunc);
        subscribeCount += 1;

        if (subscribeCount === 1) {
          await firstSubscribeAcknowledged;
        }

        return {
          remove: async () => {
            liveHandlers.delete(listenerFunc);
          },
        } as PluginListenerHandle;
      });

      const emitNative = () => {
        for (const handler of Array.from(liveHandlers)) {
          handler({ data: TEST_EVENT_DATA.promotedPurchase });
        }
      };

      const observing = emitter.addInternalListener('onPromotedPurchaseReceived', fallback);
      const teardown = emitter.removeAllListeners();
      await flushMicrotasks();

      emitNative();
      expect(fallback).toHaveBeenCalledTimes(1);

      releaseFirstSubscribe();
      await Promise.all([observing, teardown]);

      // And once everything has settled exactly one subscription may remain:
      // the second delivery must not be doubled either.
      emitNative();
      expect(fallback).toHaveBeenCalledTimes(2);
      expect(liveHandlers.size).toBe(1);
      expect((emitter as any).nativeEventListeners.size).toBe(1);
    });

    it('should not reject when the re-subscribe after removeAllListeners fails', async () => {
      // Apps call removeAllListeners() unawaited from effect cleanups, where a
      // rejection surfaces as an unhandled one. activate() treats the identical
      // subscribe as best-effort; so must the teardown.
      await emitter.addInternalListener('onPromotedPurchaseReceived', jest.fn());
      mockBridgeAddListener.mockRejectedValueOnce(new Error('bridge unavailable'));

      await expect(emitter.removeAllListeners()).resolves.toBeUndefined();

      expect(mockLog.failed).toHaveBeenCalled();
      expect((emitter as any).nativeEventListeners.size).toBe(0);
    });

    it('should still reach the fallback after removeAllListeners re-subscribes', async () => {
      const fallback = jest.fn();
      mockParseCommonEvent.mockReturnValue({ vendorProductId: 'yearly.premium.6999' });

      await emitter.addInternalListener('onPromotedPurchaseReceived', fallback);

      await emitter.removeAllListeners();

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(2);

      const nativeHandler = mockBridgeAddListener.mock.calls[1]![1];
      nativeHandler({ data: TEST_EVENT_DATA.promotedPurchase });

      expect(fallback).toHaveBeenCalledTimes(1);
      expect(fallback).toHaveBeenCalledWith({ product: { vendorProductId: 'yearly.premium.6999' } });
    });

    it('should re-subscribe an SDK-owned event registered while the teardown was waiting', async () => {
      // The cold-launch shape: the app tears its listeners down from an effect
      // cleanup while its own subscribe and activate() are both still in
      // flight, so the SDK's registration lands after the teardown took its
      // snapshot. Dropping it kills promoted purchases for the rest of the
      // process — activate() runs once.
      const fallback = jest.fn();
      mockParseCommonEvent.mockReturnValue({ vendorProductId: 'yearly.premium.6999' });

      // An app subscription left unacknowledged, so the teardown has something
      // to wait on and the SDK's registration can slot into that window.
      let releaseAppSubscribe!: (handle: PluginListenerHandle) => void;
      mockBridgeAddListener.mockImplementationOnce(
        () =>
          new Promise<PluginListenerHandle>((resolve) => {
            releaseAppSubscribe = resolve;
          }),
      );

      const appSubscribe = emitter.addListener('onLatestProfileLoad', jest.fn());
      const teardown = emitter.removeAllListeners();
      await flushMicrotasks();

      const observing = emitter.addInternalListener('onPromotedPurchaseReceived', fallback);
      releaseAppSubscribe(mockPluginHandle);
      await Promise.all([appSubscribe, observing, teardown]);

      expect((emitter as any).nativeEventListeners.has('did_receive_promoted_purchase')).toBe(true);
      expect((emitter as any).nativeEventListeners.size).toBe(1);

      const promotedCalls = mockBridgeAddListener.mock.calls.filter(
        (call) => call[0] === 'did_receive_promoted_purchase',
      );
      const liveHandler = promotedCalls[promotedCalls.length - 1]![1];
      liveHandler({ data: TEST_EVENT_DATA.promotedPurchase });

      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it('should replace the internal handler on a repeated addInternalListener', async () => {
      // One entry per event is the whole point of the merged map: ownership and
      // the default handler cannot drift apart, and re-registering is a
      // replacement rather than a second consumer.
      const first = jest.fn();
      const second = jest.fn();
      mockParseCommonEvent.mockReturnValue({ vendorProductId: 'yearly.premium.6999' });

      await emitter.addInternalListener('onPromotedPurchaseReceived', first);
      await emitter.addInternalListener('onPromotedPurchaseReceived', second);

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(1);
      expect((emitter as any).internalHandlers.size).toBe(1);

      const nativeHandler = mockBridgeAddListener.mock.calls[0]![1];
      nativeHandler({ data: TEST_EVENT_DATA.promotedPurchase });

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });
});
