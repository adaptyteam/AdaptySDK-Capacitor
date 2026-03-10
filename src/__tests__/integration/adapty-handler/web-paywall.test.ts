import { Adapty } from 'adapty';
import type { components } from 'types/api';

import {
  ACTIVATE_RESPONSE_SUCCESS,
  GET_PAYWALL_RESPONSE,
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
    it('should send OpenWebPaywall.Request with paywall', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        get_paywall: GET_PAYWALL_RESPONSE,
        open_web_paywall: OPEN_WEB_PAYWALL_RESPONSE_SUCCESS,
      });

      await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });

      // First, get a paywall
      const paywall = await adapty.getPaywall({ placementId: 'test_placement' });

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
        get_paywall: GET_PAYWALL_RESPONSE,
        create_web_paywall_url: CREATE_WEB_PAYWALL_URL_RESPONSE,
      });

      await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });

      // First, get a paywall
      const paywall = await adapty.getPaywall({ placementId: 'test_placement' });

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
});
