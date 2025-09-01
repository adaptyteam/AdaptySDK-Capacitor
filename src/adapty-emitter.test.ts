import type { PluginListenerHandle } from '@capacitor/core';

import { AdaptyEmitter } from './adapty-emitter';
import { AdaptyCapacitorPlugin } from './bridge/plugin';
import { parseCommonEvent } from './shared/coders/parse';
import { LogContext } from './shared/logger';

const EVENT_NAMES = {
  didLoadLatestProfile: 'did_load_latest_profile',
  onInstallationDetailsSuccess: 'on_installation_details_success',
  onInstallationDetailsFail: 'on_installation_details_fail',
} as const;

const TEST_EVENT_DATA = {
  profile: `{"id":"${EVENT_NAMES.didLoadLatestProfile}","profile":{}}`,
  installationSuccess: `{"id":"${EVENT_NAMES.onInstallationDetailsSuccess}","details":{"payload":"","install_id":"8716c26f-2e95-482e-a441-14b06a67792d","install_time":"2025-08-22T16:36:43.533Z","app_launch_count":16}}`,
  installationFail: `{"id":"${EVENT_NAMES.onInstallationDetailsFail}","error":{}}`,
} as const;

jest.mock('./bridge/plugin', () => require('./bridge/plugin.mock').mockAdaptyCapacitorPlugin);
jest.mock('./shared/logger', () => require('./shared/logger/logger.mock').mockLogger);
jest.mock('./shared/coders/parse', () => require('./shared/coders/parse.mock').mockParse);

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
});
