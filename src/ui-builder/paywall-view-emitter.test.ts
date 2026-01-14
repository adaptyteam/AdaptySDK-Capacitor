import type { PluginListenerHandle } from '@capacitor/core';

import { AdaptyCapacitorPlugin } from '../bridge/plugin';
import { parsePaywallEvent } from '../shared/coders/parse-paywall';
import { LogContext } from '../shared/logger';
import type { AdaptyPaywallProduct, AdaptyPurchaseResult } from '../shared/types';

import { PaywallViewEmitter } from './paywall-view-emitter';

const NATIVE_EVENT_NAMES = {
  action: 'paywall_view_did_perform_action',
  selectProduct: 'paywall_view_did_select_product',
  startPurchase: 'paywall_view_did_start_purchase',
  finishPurchase: 'paywall_view_did_finish_purchase',
  failPurchase: 'paywall_view_did_fail_purchase',
  startRestore: 'paywall_view_did_start_restore',
  finishRestore: 'paywall_view_did_finish_restore',
  failRestore: 'paywall_view_did_fail_restore',
  appear: 'paywall_view_did_appear',
  disappear: 'paywall_view_did_disappear',
  failRendering: 'paywall_view_did_fail_rendering',
  failLoadingProducts: 'paywall_view_did_fail_loading_products',
  finishWebPaymentNavigation: 'paywall_view_did_finish_web_payment_navigation',
} as const;

const TEST_VIEW_ID = 'test-paywall-view-id';
const WRONG_VIEW_ID = 'different-view-id';

const TEST_EVENT_DATA = {
  closeAction: `{"id":"${NATIVE_EVENT_NAMES.action}","view":{"id":"${TEST_VIEW_ID}"},"action":{"type":"close"}}`,
  closeActionWrongView: `{"id":"${NATIVE_EVENT_NAMES.action}","view":{"id":"${WRONG_VIEW_ID}"},"action":{"type":"close"}}`,
  systemBackAction: `{"id":"${NATIVE_EVENT_NAMES.action}","view":{"id":"${TEST_VIEW_ID}"},"action":{"type":"system_back"}}`,
  urlAction: `{"id":"${NATIVE_EVENT_NAMES.action}","view":{"id":"${TEST_VIEW_ID}"},"action":{"type":"open_url","value":"https://example.com"}}`,
  customAction: `{"id":"${NATIVE_EVENT_NAMES.action}","view":{"id":"${TEST_VIEW_ID}"},"action":{"type":"custom","value":"test-action"}}`,
  productSelected: `{"id":"${NATIVE_EVENT_NAMES.selectProduct}","view":{"id":"${TEST_VIEW_ID}"},"product_id":"com.example.premium"}`,
  purchaseStarted: `{"id":"${NATIVE_EVENT_NAMES.startPurchase}","view":{"id":"${TEST_VIEW_ID}"},"product":{"id":"com.example.premium"}}`,
  purchaseCompleted: `{"id":"${NATIVE_EVENT_NAMES.finishPurchase}","view":{"id":"${TEST_VIEW_ID}"},"purchased_result":{"type":"success"},"product":{"id":"com.example.premium"}}`,
  purchaseFailed: `{"id":"${NATIVE_EVENT_NAMES.failPurchase}","view":{"id":"${TEST_VIEW_ID}"},"error":{"message":"Purchase failed"},"product":{"id":"com.example.premium"}}`,
  restoreStarted: `{"id":"${NATIVE_EVENT_NAMES.startRestore}","view":{"id":"${TEST_VIEW_ID}"}}`,
  restoreCompleted: `{"id":"${NATIVE_EVENT_NAMES.finishRestore}","view":{"id":"${TEST_VIEW_ID}"},"profile":{"profileId":"test-profile"}}`,
  restoreFailed: `{"id":"${NATIVE_EVENT_NAMES.failRestore}","view":{"id":"${TEST_VIEW_ID}"},"error":{"message":"Restore failed"}}`,
  paywallShown: `{"id":"${NATIVE_EVENT_NAMES.appear}","view":{"id":"${TEST_VIEW_ID}"}}`,
  paywallClosed: `{"id":"${NATIVE_EVENT_NAMES.disappear}","view":{"id":"${TEST_VIEW_ID}"}}`,
  renderingFailed: `{"id":"${NATIVE_EVENT_NAMES.failRendering}","view":{"id":"${TEST_VIEW_ID}"},"error":{"message":"Rendering failed"}}`,
  loadingProductsFailed: `{"id":"${NATIVE_EVENT_NAMES.failLoadingProducts}","view":{"id":"${TEST_VIEW_ID}"},"error":{"message":"Loading products failed"}}`,
  webPaymentFinished: `{"id":"${NATIVE_EVENT_NAMES.finishWebPaymentNavigation}","view":{"id":"${TEST_VIEW_ID}"},"product":{"id":"com.example.premium"},"error":null}`,
} as const;

jest.mock('../bridge/plugin', () => require('../bridge/plugin.mock').mockAdaptyCapacitorPlugin);
jest.mock('../shared/logger', () => require('../shared/logger/logger.mock').mockLogger);
jest.mock('../shared/coders/parse-paywall', () => require('../shared/coders/parse-paywall.mock').mockParsePaywall);

describe('PaywallViewEmitter', () => {
  let emitter: PaywallViewEmitter;
  let mockBridgeAddListener: jest.MockedFunction<any>;
  let mockParsePaywallEvent: jest.MockedFunction<typeof parsePaywallEvent>;
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

    // Cast to any to match the PaywallViewEmitter implementation which casts to (AdaptyCapacitorPlugin as any)
    mockBridgeAddListener = jest.fn() as any;
    (AdaptyCapacitorPlugin as any).addListener = mockBridgeAddListener;
    mockBridgeAddListener.mockResolvedValue(mockPluginHandle);

    mockParsePaywallEvent = parsePaywallEvent as jest.MockedFunction<typeof parsePaywallEvent>;

    mockOnRequestClose = jest.fn().mockResolvedValue(undefined);

    emitter = new PaywallViewEmitter(TEST_VIEW_ID);
  });

  describe('constructor', () => {
    it('should initialize with provided viewId', async () => {
      const testViewId = 'custom-view-id';
      const customEmitter = new PaywallViewEmitter(testViewId);
      expect(customEmitter).toBeInstanceOf(PaywallViewEmitter);
    });
  });

  describe('addListener', () => {
    it('should create native event listener for the first handler', async () => {
      const mockListener = jest.fn();
      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.action,
        view: { id: TEST_VIEW_ID },
        action: { type: 'close' },
      });

      const handle = await await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(1);
      expect(mockBridgeAddListener).toHaveBeenCalledWith(NATIVE_EVENT_NAMES.action, expect.any(Function));
      expect(handle).toBe(mockPluginHandle);
    });

    it('should reuse existing native event listener for subsequent handlers of same native event', async () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      await await emitter.addListener('onCloseButtonPress', mockListener1, mockOnRequestClose);
      await await emitter.addListener('onAndroidSystemBack', mockListener2, mockOnRequestClose);

      // Both handlers map to same native event
      expect(mockBridgeAddListener).toHaveBeenCalledTimes(1);
    });

    it('should create separate native listeners for different native events', async () => {
      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      await await emitter.addListener('onCloseButtonPress', mockListener1, mockOnRequestClose);
      await await emitter.addListener('onProductSelected', mockListener2, mockOnRequestClose);

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(2);
      expect(mockBridgeAddListener).toHaveBeenNthCalledWith(1, NATIVE_EVENT_NAMES.action, expect.any(Function));
      expect(mockBridgeAddListener).toHaveBeenNthCalledWith(2, NATIVE_EVENT_NAMES.selectProduct, expect.any(Function));
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
      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.action,
        view: { id: WRONG_VIEW_ID },
        action: { type: 'close' },
      });

      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);

      // Get the native listener callback
      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      // Simulate native event with wrong view ID
      nativeCallback({ data: TEST_EVENT_DATA.closeActionWrongView });

      expect(mockListener).not.toHaveBeenCalled();
      expect(mockOnRequestClose).not.toHaveBeenCalled();
    });

    it('should call handler when viewId matches and action type matches', async () => {
      const mockListener = jest.fn().mockReturnValue(false);
      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.action,
        view: { id: TEST_VIEW_ID },
        action: { type: 'close' },
      });

      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);

      // Get the native listener callback
      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      // Simulate native event
      nativeCallback({ data: TEST_EVENT_DATA.closeAction });

      expect(mockListener).toHaveBeenCalledWith();
      expect(mockOnRequestClose).not.toHaveBeenCalled();
    });

    it('should call onRequestClose when handler returns true', async () => {
      const mockListener = jest.fn().mockReturnValue(true);
      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.action,
        view: { id: TEST_VIEW_ID },
        action: { type: 'close' },
      });

      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.closeAction });

      expect(mockListener).toHaveBeenCalledWith();
      expect(mockOnRequestClose).toHaveBeenCalledTimes(1);
    });

    it('should filter by action type for events with propertyMap', async () => {
      const closeListener = jest.fn();
      const backListener = jest.fn();

      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.action,
        view: { id: TEST_VIEW_ID },
        action: { type: 'system_back' },
      });

      await emitter.addListener('onCloseButtonPress', closeListener, mockOnRequestClose);
      await emitter.addListener('onAndroidSystemBack', backListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.systemBackAction });

      expect(closeListener).not.toHaveBeenCalled(); // Filtered out by action type
      expect(backListener).toHaveBeenCalledWith(); // Matches system_back action
    });

    it('should pass correct arguments to handlers based on event type', async () => {
      const productSelectedListener = jest.fn();
      const urlPressListener = jest.fn();
      const purchaseCompletedListener = jest.fn();

      // Test onProductSelected
      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.selectProduct,
        view: { id: TEST_VIEW_ID },
        productId: 'com.example.premium',
      });

      await emitter.addListener('onProductSelected', productSelectedListener, mockOnRequestClose);

      let nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.productSelected });

      expect(productSelectedListener).toHaveBeenCalledWith('com.example.premium');

      // Test onUrlPress
      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.action,
        view: { id: TEST_VIEW_ID },
        action: { type: 'open_url', value: 'https://example.com' },
      });

      await emitter.addListener('onUrlPress', urlPressListener, mockOnRequestClose);

      nativeCallback = mockBridgeAddListener.mock.calls[1][1];
      nativeCallback({ data: TEST_EVENT_DATA.urlAction });

      expect(urlPressListener).toHaveBeenCalledWith('https://example.com');

      // Test onPurchaseCompleted
      const mockPurchaseResult: AdaptyPurchaseResult = { type: 'pending' };
      const mockProduct: AdaptyPaywallProduct = {
        localizedDescription: 'desc',
        localizedTitle: 'title',
        paywallABTestName: 'ab',
        paywallName: 'pw',
        price: undefined,
        adaptyId: 'adapty-id',
        accessLevelId: 'access',
        productType: 'type',
        variationId: 'variation',
        vendorProductId: 'com.example.premium',
        paywallProductIndex: 0,
      };
      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.finishPurchase,
        view: { id: TEST_VIEW_ID },
        purchaseResult: mockPurchaseResult,
        product: mockProduct,
      });

      await emitter.addListener('onPurchaseCompleted', purchaseCompletedListener, mockOnRequestClose);

      nativeCallback = mockBridgeAddListener.mock.calls[2][1];
      nativeCallback({ data: TEST_EVENT_DATA.purchaseCompleted });

      expect(purchaseCompletedListener).toHaveBeenCalledWith(mockPurchaseResult, mockProduct);
    });

    it('should handle parsing errors gracefully', async () => {
      const mockListener = jest.fn();
      mockParsePaywallEvent.mockImplementation(() => {
        throw new Error('Parse error');
      });

      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      expect(() => {
        nativeCallback({ data: 'invalid-json' });
      }).toThrow('Parse error');

      expect(mockListener).not.toHaveBeenCalled();
      expect(mockLog.failed).toHaveBeenCalled();
    });

    it('should handle invalid event data format', async () => {
      const mockListener = jest.fn();

      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      expect(() => {
        nativeCallback({ data: 123 as any });
      }).toThrow('Expected event data to be JSON string');

      expect(mockListener).not.toHaveBeenCalled();
      expect(mockLog.failed).toHaveBeenCalled();
    });

    it('should handle missing data field on native event', async () => {
      const mockListener = jest.fn();

      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);

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
      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.action,
        view: { id: TEST_VIEW_ID },
        action: { type: 'close' },
      });

      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];

      nativeCallback({ data: TEST_EVENT_DATA.closeAction });

      expect(mockListener).toHaveBeenCalled();
      expect(mockLog.failed).toHaveBeenCalled();
    });

    it('should handle onRequestClose errors gracefully', async () => {
      const mockListener = jest.fn().mockReturnValue(true);
      const mockOnRequestCloseWithError = jest.fn().mockRejectedValue(new Error('Close error'));
      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.action,
        view: { id: TEST_VIEW_ID },
        action: { type: 'close' },
      });

      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestCloseWithError);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.closeAction });

      expect(mockListener).toHaveBeenCalledWith();
      expect(mockOnRequestCloseWithError).toHaveBeenCalledTimes(1);

      // Wait for the async error handling
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockLog.failed).toHaveBeenCalled();
    });

    it('should pass parsePaywallEvent context correctly', async () => {
      const mockListener = jest.fn();

      mockParsePaywallEvent.mockImplementation((input, ctx) => {
        expect(typeof input).toBe('string');
        expect(ctx).toBe(mockLogContext);
        return {
          id: NATIVE_EVENT_NAMES.action,
          view: { id: TEST_VIEW_ID },
          action: { type: 'close' },
        };
      });

      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.closeAction });

      expect(mockLogContext.event).toHaveBeenCalledWith({ methodName: NATIVE_EVENT_NAMES.action });
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all native subscriptions', async () => {
      const mockHandle1 = { remove: jest.fn().mockResolvedValue(undefined) };
      const mockHandle2 = { remove: jest.fn().mockResolvedValue(undefined) };
      mockBridgeAddListener.mockReturnValueOnce(mockHandle1).mockReturnValueOnce(mockHandle2);

      const mockListener1 = jest.fn();
      const mockListener2 = jest.fn();

      await emitter.addListener('onCloseButtonPress', mockListener1, mockOnRequestClose);
      await emitter.addListener('onProductSelected', mockListener2, mockOnRequestClose);

      emitter.removeAllListeners();

      expect(mockHandle1.remove).toHaveBeenCalledTimes(1);
      expect(mockHandle2.remove).toHaveBeenCalledTimes(1);
    });

    it('should clear all internal state', async () => {
      const mockHandle1 = { remove: jest.fn().mockResolvedValue(undefined) };
      const mockHandle2 = { remove: jest.fn().mockResolvedValue(undefined) };
      mockBridgeAddListener.mockReturnValueOnce(mockHandle1).mockReturnValueOnce(mockHandle2);

      const mockListener = jest.fn();
      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.action,
        view: { id: TEST_VIEW_ID },
        action: { type: 'close' },
      });

      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);
      emitter.removeAllListeners();

      // Try to add listener again - should create new native subscription
      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(2);
    });

    it('should handle removal errors gracefully', async () => {
      const mockHandle = { remove: jest.fn().mockRejectedValue(new Error('Remove failed')) };
      mockBridgeAddListener.mockReturnValue(mockHandle);

      const mockListener = jest.fn();

      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);

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
        onCloseButtonPress: jest.fn(),
        onAndroidSystemBack: jest.fn(),
        onUrlPress: jest.fn(),
        onCustomAction: jest.fn(),
        onProductSelected: jest.fn(),
        onPurchaseStarted: jest.fn(),
        onPurchaseCompleted: jest.fn(),
        onPurchaseFailed: jest.fn(),
        onRestoreStarted: jest.fn(),
        onRestoreCompleted: jest.fn(),
        onRestoreFailed: jest.fn(),
        onPaywallShown: jest.fn(),
        onPaywallClosed: jest.fn(),
        onRenderingFailed: jest.fn(),
        onLoadingProductsFailed: jest.fn(),
        onWebPaymentNavigationFinished: jest.fn(),
      };

      // Add all listeners
      for (const [eventName, handler] of Object.entries(handlers)) {
        await emitter.addListener(eventName as any, handler as any, mockOnRequestClose);
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

      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.action,
        view: { id: TEST_VIEW_ID },
        action: { type: 'close' },
      });

      // Add first handler
      await emitter.addListener('onCloseButtonPress', handler1, onRequestClose1);
      // Add second handler - should replace first
      await emitter.addListener('onCloseButtonPress', handler2, onRequestClose2);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.closeAction });

      expect(handler1).not.toHaveBeenCalled(); // handler1 was replaced
      expect(handler2).toHaveBeenCalledWith(); // only handler2 should be called
      expect(onRequestClose1).not.toHaveBeenCalled(); // handler1 was not called
      expect(onRequestClose2).toHaveBeenCalled(); // handler2 returned true
    });

    it('should isolate handlers across different views (cross-view isolation)', async () => {
      const viewEmitter1 = new PaywallViewEmitter('view-1');
      const viewEmitter2 = new PaywallViewEmitter('view-2');

      const listener1 = jest.fn();
      const listener2 = jest.fn();

      mockParsePaywallEvent.mockImplementation((input) => {
        const data = JSON.parse(input);
        return data;
      });

      await viewEmitter1.addListener('onCloseButtonPress', listener1, mockOnRequestClose);
      await viewEmitter2.addListener('onCloseButtonPress', listener2, mockOnRequestClose);

      // Simulate event for view-1
      const callback1 = mockBridgeAddListener.mock.calls[0][1];
      callback1({ data: `{"id":"${NATIVE_EVENT_NAMES.action}","view":{"id":"view-1"},"action":{"type":"close"}}` });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();

      listener1.mockClear();
      listener2.mockClear();

      // Simulate event for view-2
      const callback2 = mockBridgeAddListener.mock.calls[1][1];
      callback2({ data: `{"id":"${NATIVE_EVENT_NAMES.action}","view":{"id":"view-2"},"action":{"type":"close"}}` });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('addInternalListener', () => {
    it('should subscribe natively even without client handlers', async () => {
      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.disappear,
        view: { id: TEST_VIEW_ID },
      });

      await emitter.addInternalListener('onPaywallClosed', jest.fn());

      expect(mockBridgeAddListener).toHaveBeenCalledTimes(1);
      expect(mockBridgeAddListener).toHaveBeenCalledWith(NATIVE_EVENT_NAMES.disappear, expect.any(Function));
    });

    it('should call internal handler after client handler for same event', async () => {
      const callOrder: string[] = [];

      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.disappear,
        view: { id: TEST_VIEW_ID },
      });

      const clientHandler = jest.fn(() => {
        callOrder.push('client');
        return false;
      });
      const internalHandler = jest.fn(() => {
        callOrder.push('internal');
      });

      await emitter.addListener('onPaywallClosed', clientHandler, mockOnRequestClose);
      await emitter.addInternalListener('onPaywallClosed', internalHandler);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.paywallClosed });

      expect(callOrder).toEqual(['client', 'internal']);
      expect(clientHandler).toHaveBeenCalledTimes(1);
      expect(internalHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('logging', () => {
    it('should log native event processing', async () => {
      const mockListener = jest.fn();
      mockParsePaywallEvent.mockReturnValue({
        id: NATIVE_EVENT_NAMES.action,
        view: { id: TEST_VIEW_ID },
        action: { type: 'close' },
      });

      await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);

      const nativeCallback = mockBridgeAddListener.mock.calls[0][1];
      nativeCallback({ data: TEST_EVENT_DATA.closeAction });

      expect(mockLogContext.event).toHaveBeenCalledWith({ methodName: NATIVE_EVENT_NAMES.action });
      expect(mockLog.start).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('Memory leak prevention', () => {
    it('should not accumulate handlers with repeated add/remove cycles', async () => {
      const initialListenersSize = (emitter as any).eventListeners.size;
      const initialHandlersSize = (emitter as any).handlers.size;

      for (let i = 0; i < 10; i++) {
        const mockListener = jest.fn();
        await emitter.addListener('onCloseButtonPress', mockListener, mockOnRequestClose);
        await emitter.addInternalListener('onPaywallClosed', jest.fn());
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
        return emitter.addListener('onCloseButtonPress', listener as any, mockOnRequestClose);
      });

      await Promise.all(addPromises);

      // Should have only 1 handler (the last one added replaces previous ones)
      const handlerData = (emitter as any).handlers.get('onCloseButtonPress');
      expect(handlerData).toBeDefined();
      expect((emitter as any).handlers.size).toBe(1);

      emitter.removeAllListeners();

      expect((emitter as any).eventListeners.has(NATIVE_EVENT_NAMES.action)).toBe(false);
      expect((emitter as any).handlers.has('onCloseButtonPress')).toBe(false);
      expect((emitter as any).internalHandlers.has('onCloseButtonPress')).toBe(false);
    });

    it('should cleanup handlers even when some subscription removals fail', async () => {
      const failingHandle = { remove: jest.fn().mockRejectedValue(new Error('Remove failed')) } as any;
      mockBridgeAddListener.mockReturnValueOnce(failingHandle);

      await emitter.addListener('onCloseButtonPress', jest.fn(), mockOnRequestClose);

      emitter.removeAllListeners();

      expect((emitter as any).eventListeners.size).toBe(0);
      expect((emitter as any).handlers.size).toBe(0);
      expect((emitter as any).internalHandlers.size).toBe(0);
    });
  });
});
