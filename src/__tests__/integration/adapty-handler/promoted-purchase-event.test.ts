/**
 * Integration test for the App Store promoted purchase event.
 *
 * Covers the three properties the feature rests on: the SDK holds its own
 * subscription from activate() onward, it completes the purchase when the app
 * registered no handler, and any registered handler replaces that default.
 */
import { Adapty } from 'adapty';
import type { AdaptyPromotedProduct } from 'types';
import type { components } from 'types/api';

import {
  ACTIVATE_RESPONSE_SUCCESS,
  EVENT_DID_RECEIVE_PROMOTED_PURCHASE,
  MAKE_PROMOTED_PURCHASE_RESPONSE_SUCCESS,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  emitNativeEvent,
  extractNativeRequest,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

/** Lets the dispatcher's un-awaited promise chain settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 10));

const calledMethods = (nativeMock: MockNativeModule): string[] =>
  nativeMock.handleMethodCall.mock.calls.map(([{ methodName }]) => methodName);

describe('Adapty - Promoted Purchase Event (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;

  beforeEach(async () => {
    adapty = new Adapty();

    nativeMock = createNativeModuleMock({
      activate: ACTIVATE_RESPONSE_SUCCESS,
      make_promoted_purchase: MAKE_PROMOTED_PURCHASE_RESPONSE_SUCCESS,
    });

    await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });
    // extractNativeRequest defaults to callIndex 0, which would otherwise be
    // the activate call rather than the method under test.
    nativeMock.handleMethodCall.mockClear();
  });

  afterEach(async () => {
    await cleanupAdapty(adapty);
    resetNativeModuleMock(nativeMock);
  });

  it('should auto-purchase the promoted product when no listener is registered', async () => {
    emitNativeEvent({
      eventName: 'did_receive_promoted_purchase',
      eventData: EVENT_DID_RECEIVE_PROMOTED_PURCHASE,
    });

    await flush();

    const request = extractNativeRequest<components['requests']['MakePromotedPurchase.Request']>({
      nativeModule: nativeMock,
    });

    expect(request.method).toBe('make_promoted_purchase');
    expect(request.product.vendor_product_id).toBe('yearly.premium.6999');
  });

  it('should decode the promoted product for a registered listener', async () => {
    const received: AdaptyPromotedProduct[] = [];

    await adapty.addListener('onPromotedPurchaseReceived', ({ product }) => {
      received.push(product);
    });

    emitNativeEvent({
      eventName: 'did_receive_promoted_purchase',
      eventData: EVENT_DID_RECEIVE_PROMOTED_PURCHASE,
    });

    await flush();

    expect(received).toHaveLength(1);
    const product = received[0]!;

    expect(product.vendorProductId).toBe('yearly.premium.6999');
    expect(product.localizedTitle).toBe('Yearly Premium Plan');
    expect(product.price?.amount).toBe(69.99);
  });

  it('should not auto-purchase when a listener is registered', async () => {
    // A registered handler REPLACES the default. If it also ran, a handler that
    // purchases — the documented thing to do — would buy twice.
    await adapty.addListener('onPromotedPurchaseReceived', jest.fn());

    emitNativeEvent({
      eventName: 'did_receive_promoted_purchase',
      eventData: EVENT_DID_RECEIVE_PROMOTED_PURCHASE,
    });

    await flush();

    expect(calledMethods(nativeMock)).not.toContain('make_promoted_purchase');
  });

  it('should restore the default when the app removes its subscription', async () => {
    // The per-screen useEffect cleanup idiom. A one-way flag would leave the
    // default suppressed here with no listener left, silently dropping every
    // later promoted purchase.
    const handle = await adapty.addListener('onPromotedPurchaseReceived', jest.fn());
    await handle.remove();

    emitNativeEvent({
      eventName: 'did_receive_promoted_purchase',
      eventData: EVENT_DID_RECEIVE_PROMOTED_PURCHASE,
    });

    await flush();

    expect(calledMethods(nativeMock)).toContain('make_promoted_purchase');
  });

  it('should keep handling promoted purchases after removeAllListeners', async () => {
    // removeAllListeners() drops the SDK's own subscription too, so it has to be
    // reinstalled — activate() runs once per process and will not do it again.
    await adapty.removeAllListeners();

    emitNativeEvent({
      eventName: 'did_receive_promoted_purchase',
      eventData: EVENT_DID_RECEIVE_PROMOTED_PURCHASE,
    });

    await flush();

    expect(calledMethods(nativeMock)).toContain('make_promoted_purchase');
  });

  it('should not resume the default while another listener is still registered', async () => {
    // Removing one handler twice must not free the slot held by a live one.
    const first = await adapty.addListener('onPromotedPurchaseReceived', jest.fn());
    await adapty.addListener('onPromotedPurchaseReceived', jest.fn());

    await first.remove();
    await first.remove();

    emitNativeEvent({
      eventName: 'did_receive_promoted_purchase',
      eventData: EVENT_DID_RECEIVE_PROMOTED_PURCHASE,
    });

    await flush();

    expect(calledMethods(nativeMock)).not.toContain('make_promoted_purchase');
  });

  it('should not let a rejecting async handler escape as an unhandled rejection, and must not auto-purchase', async () => {
    // The documented usage is an async handler. If it rejects — a declined
    // purchase, a network error — the rejection must be caught and logged, not
    // escape. And the app still owns completion: a throwing handler must not
    // fall back to the SDK auto-purchasing on its behalf.
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);

    try {
      await adapty.addListener('onPromotedPurchaseReceived', async () => {
        throw new Error('declined');
      });

      emitNativeEvent({
        eventName: 'did_receive_promoted_purchase',
        eventData: EVENT_DID_RECEIVE_PROMOTED_PURCHASE,
      });

      await flush();

      expect(unhandledRejections).toHaveLength(0);
      expect(calledMethods(nativeMock)).not.toContain('make_promoted_purchase');
    } finally {
      process.removeListener('unhandledRejection', onUnhandledRejection);
    }
  });

  it('should keep dispatching to remaining handlers when one throws synchronously, and must not auto-purchase', async () => {
    // Sync handlers are explicitly permitted by the callback type. A sync throw
    // would otherwise escape before Promise.resolve().catch() is attached and
    // abort dispatch to the handlers after it.
    const secondHandlerRan: boolean[] = [];

    await adapty.addListener('onPromotedPurchaseReceived', () => {
      throw new Error('sync error');
    });

    await adapty.addListener('onPromotedPurchaseReceived', () => {
      secondHandlerRan.push(true);
    });

    emitNativeEvent({
      eventName: 'did_receive_promoted_purchase',
      eventData: EVENT_DID_RECEIVE_PROMOTED_PURCHASE,
    });

    await flush();

    expect(secondHandlerRan).toHaveLength(1);
    expect(calledMethods(nativeMock)).not.toContain('make_promoted_purchase');
  });
});
