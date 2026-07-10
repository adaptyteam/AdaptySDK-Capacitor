import { Adapty } from 'adapty';
import type { components } from 'types/api';

import {
  ACTIVATE_RESPONSE_SUCCESS,
  GET_FLOW_RESPONSE,
  OPEN_WEB_PAYWALL_RESPONSE_SUCCESS,
  CREATE_WEB_PAYWALL_URL_RESPONSE,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  extractNativeRequest,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

describe('Adapty - Web Paywall (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;

  beforeEach(() => {
    adapty = new Adapty();
  });

  afterEach(async () => {
    await cleanupAdapty(adapty);

    if (nativeMock) {
      resetNativeModuleMock(nativeMock);
    }
  });

  describe('openWebPaywall', () => {
    it('should send OpenWebPaywall.Request with flow paywall', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        get_flow: GET_FLOW_RESPONSE,
        open_web_paywall: OPEN_WEB_PAYWALL_RESPONSE_SUCCESS,
      });

      await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });

      // First, get a flow and use its paywall variation
      const flow = await adapty.getFlow({ placementId: 'test_placement' });
      const paywall = flow.paywalls[0]!;

      await adapty.openWebPaywall({ paywallOrProduct: paywall, openIn: 'browser_out_app' });

      const request = extractNativeRequest<components['requests']['OpenWebPaywall.Request']>({
        nativeModule: nativeMock,
        callIndex: 2,
      });

      expect(request.method).toBe('open_web_paywall');
      expect(request.open_in).toBe('browser_out_app');
      expect(request.paywall).toBeDefined();
      expect(request.paywall?.paywall_id).toBe('paywall_test_placement');
    });
  });

  describe('createWebPaywallUrl', () => {
    it('should send CreateWebPaywallUrl.Request and return URL', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        get_flow: GET_FLOW_RESPONSE,
        create_web_paywall_url: CREATE_WEB_PAYWALL_URL_RESPONSE,
      });

      await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });

      // First, get a flow and use its paywall variation
      const flow = await adapty.getFlow({ placementId: 'test_placement' });
      const paywall = flow.paywalls[0]!;

      const url = await adapty.createWebPaywallUrl({ paywallOrProduct: paywall });

      const request = extractNativeRequest<components['requests']['CreateWebPaywallUrl.Request']>({
        nativeModule: nativeMock,
        callIndex: 2,
      });

      expect(request.method).toBe('create_web_paywall_url');
      expect(request.paywall).toBeDefined();
      expect(request.paywall?.paywall_id).toBe('paywall_test_placement');
      expect(url).toBe('https://example.adapty.io/web-paywall-url');
    });
  });

  describe('openWebUrl', () => {
    it('should send AdaptyUIOpenUrl.Request', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        adapty_ui_open_url: { success: true },
      });

      await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });

      await adapty.openWebUrl({ url: 'https://example.com/offer', openIn: 'browser_out_app' });

      const request = extractNativeRequest<components['requests']['AdaptyUIOpenUrl.Request']>({
        nativeModule: nativeMock,
        callIndex: 1,
      });

      expect(request.method).toBe('adapty_ui_open_url');
      expect(request.url).toBe('https://example.com/offer');
      expect(request.open_in).toBe('browser_out_app');
    });
  });

  describe('requestAppReview', () => {
    it('should send AdaptyUIRequestAppReview.Request', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        adapty_ui_request_app_review: { success: true },
      });

      await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });

      await adapty.requestAppReview();

      const request = extractNativeRequest<components['requests']['AdaptyUIRequestAppReview.Request']>({
        nativeModule: nativeMock,
        callIndex: 1,
      });

      expect(request.method).toBe('adapty_ui_request_app_review');
    });
  });
});
