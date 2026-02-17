import { Capacitor } from '@capacitor/core';
import { Adapty } from 'adapty';

import {
  ACTIVATE_RESPONSE_SUCCESS,
  PRESENT_CODE_REDEMPTION_SHEET_REQUEST,
  PRESENT_CODE_REDEMPTION_SHEET_RESPONSE,
  UPDATE_COLLECTING_REFUND_DATA_CONSENT_REQUEST,
  UPDATE_COLLECTING_REFUND_DATA_CONSENT_RESPONSE_SUCCESS,
  UPDATE_REFUND_PREFERENCE_REQUEST,
  UPDATE_REFUND_PREFERENCE_RESPONSE_SUCCESS,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  expectNativeCall,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

// Save original getPlatform
const originalGetPlatform = Capacitor.getPlatform;

describe('Adapty - iOS-specific methods (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;

  describe('iOS behavior', () => {
    beforeAll(() => {
      // Mock getPlatform to return 'ios'
      Capacitor.getPlatform = jest.fn(() => 'ios');
    });

    afterAll(() => {
      // Restore original
      Capacitor.getPlatform = originalGetPlatform;
    });

    beforeEach(async () => {
      adapty = new Adapty();

      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        present_code_redemption_sheet: PRESENT_CODE_REDEMPTION_SHEET_RESPONSE,
        update_collecting_refund_data_consent: UPDATE_COLLECTING_REFUND_DATA_CONSENT_RESPONSE_SUCCESS,
        update_refund_preference: UPDATE_REFUND_PREFERENCE_RESPONSE_SUCCESS,
      });

      await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });
      nativeMock.handleMethodCall.mockClear();
    });

    afterEach(() => {
      cleanupAdapty(adapty);
      resetNativeModuleMock(nativeMock);
    });

    it('presentCodeRedemptionSheet should call native on iOS', async () => {
      await adapty.presentCodeRedemptionSheet();

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'present_code_redemption_sheet',
        expectedRequest: PRESENT_CODE_REDEMPTION_SHEET_REQUEST,
      });
    });

    it('updateCollectingRefundDataConsent should call native on iOS', async () => {
      await adapty.updateCollectingRefundDataConsent({ consent: true });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'update_collecting_refund_data_consent',
        expectedRequest: UPDATE_COLLECTING_REFUND_DATA_CONSENT_REQUEST,
      });
    });

    it('updateRefundPreference should call native on iOS', async () => {
      await adapty.updateRefundPreference({ refundPreference: 'grant' });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'update_refund_preference',
        expectedRequest: UPDATE_REFUND_PREFERENCE_REQUEST,
      });
    });
  });

  describe('Android behavior for iOS-only methods', () => {
    beforeAll(() => {
      Capacitor.getPlatform = jest.fn(() => 'android');
    });

    afterAll(() => {
      Capacitor.getPlatform = originalGetPlatform;
    });

    beforeEach(async () => {
      adapty = new Adapty();

      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        // Add mock response for presentCodeRedemptionSheet even on Android
        // because Capacitor implementation doesn't skip the bridge call
        present_code_redemption_sheet: PRESENT_CODE_REDEMPTION_SHEET_RESPONSE,
      });

      await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });
      nativeMock.handleMethodCall.mockClear();
    });

    afterEach(() => {
      cleanupAdapty(adapty);
      resetNativeModuleMock(nativeMock);
    });

    it('presentCodeRedemptionSheet should call native even on Android (no platform guard)', async () => {
      await adapty.presentCodeRedemptionSheet();

      // Unlike RN SDK, Capacitor SDK doesn't have platform guard for this method
      // Native side should handle Android gracefully
      expectNativeCall({
        nativeModule: nativeMock,
        method: 'present_code_redemption_sheet',
        expectedRequest: PRESENT_CODE_REDEMPTION_SHEET_REQUEST,
      });
    });

    it('updateCollectingRefundDataConsent should resolve immediately on Android', async () => {
      await adapty.updateCollectingRefundDataConsent({ consent: true });

      expect(nativeMock.handleMethodCall).not.toHaveBeenCalled();
    });

    it('updateRefundPreference should resolve immediately on Android', async () => {
      await adapty.updateRefundPreference({ refundPreference: 'grant' });

      expect(nativeMock.handleMethodCall).not.toHaveBeenCalled();
    });
  });
});
