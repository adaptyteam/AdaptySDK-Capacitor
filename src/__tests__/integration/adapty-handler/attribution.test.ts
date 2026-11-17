import { Capacitor } from '@capacitor/core';
import { Adapty } from 'adapty';
import type { components } from 'types/api';

import {
  ACTIVATE_RESPONSE_SUCCESS,
  REPORT_TRANSACTION_REQUEST,
  REPORT_TRANSACTION_REQUEST_WITH_JWS,
  REPORT_TRANSACTION_RESPONSE_SUCCESS,
  UPDATE_EXTERNAL_ATTRIBUTION_DATA_RESPONSE_SUCCESS,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  extractNativeRequest,
  expectNativeCall,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

describe('Adapty - Attribution (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;

  beforeEach(async () => {
    adapty = new Adapty();

    nativeMock = createNativeModuleMock({
      activate: ACTIVATE_RESPONSE_SUCCESS,
      report_transaction: REPORT_TRANSACTION_RESPONSE_SUCCESS,
      update_external_attribution_data: UPDATE_EXTERNAL_ATTRIBUTION_DATA_RESPONSE_SUCCESS,
    });

    await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });
    nativeMock.handleMethodCall.mockClear();
  });

  afterEach(() => {
    cleanupAdapty(adapty);
    resetNativeModuleMock(nativeMock);
  });

  describe('reportTransaction', () => {
    it('should send ReportTransaction.Request with transaction_id', async () => {
      await adapty.reportTransaction({ transactionId: 'transaction_12345' });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'report_transaction',
        expectedRequest: REPORT_TRANSACTION_REQUEST,
      });
    });

    it('should include variation_id when provided', async () => {
      await adapty.reportTransaction({
        transactionId: 'transaction_12345',
        variationId: 'variation_abc',
      });

      const request = extractNativeRequest<components['requests']['ReportTransaction.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('report_transaction');
      expect(request.transaction_id).toBe('transaction_12345');
      expect(request.variation_id).toBe('variation_abc');
    });

    describe('ios.jwsTransaction', () => {
      const originalGetPlatform = Capacitor.getPlatform;

      afterEach(() => {
        Capacitor.getPlatform = originalGetPlatform;
      });

      it('should send apple_jws_transaction on iOS', async () => {
        await adapty.reportTransaction({
          transactionId: 'transaction_12345',
          ios: { jwsTransaction: 'eyJhbGciOiJFUzI1NiJ9.jws.sig' },
        });

        const request = extractNativeRequest<components['requests']['ReportTransaction.Request']>({
          nativeModule: nativeMock,
        });

        expect(request).toStrictEqual(REPORT_TRANSACTION_REQUEST_WITH_JWS);
      });

      it('should omit apple_jws_transaction on Android', async () => {
        Capacitor.getPlatform = jest.fn(() => 'android');

        await adapty.reportTransaction({
          transactionId: 'transaction_12345',
          ios: { jwsTransaction: 'eyJhbGciOiJFUzI1NiJ9.jws.sig' },
        });

        const request = extractNativeRequest<components['requests']['ReportTransaction.Request']>({
          nativeModule: nativeMock,
        });

        expect(request).toStrictEqual(REPORT_TRANSACTION_REQUEST);
      });
    });

    it('should omit variation_id when variationId is empty', async () => {
      await adapty.reportTransaction({ transactionId: 'transaction_12345', variationId: '' });

      const request = extractNativeRequest<components['requests']['ReportTransaction.Request']>({
        nativeModule: nativeMock,
      });

      expect(request).not.toHaveProperty('variation_id');
    });
  });

  describe('updateExternalAttribution', () => {
    it('should send UpdateExternalAttributionData.Request with attribution data', async () => {
      const attribution = {
        campaign: 'summer_sale',
        source: 'google',
      };

      await adapty.updateExternalAttribution({ attribution, provider: 'appsflyer' });

      const request = extractNativeRequest<components['requests']['UpdateExternalAttributionData.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('update_external_attribution_data');
      expect(request.provider).toBe('appsflyer');
      // Attribution is serialized as JSON string
      expect(request.attribution).toBeDefined();
      const parsedAttribution = JSON.parse(request.attribution);
      expect(parsedAttribution.campaign).toBe('summer_sale');
      expect(parsedAttribution.source).toBe('google');
    });
  });
});
