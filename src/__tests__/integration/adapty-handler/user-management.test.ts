import { Adapty } from 'adapty';
import type { components } from 'types/api';

import {
  ACTIVATE_RESPONSE_SUCCESS,
  IDENTIFY_REQUEST,
  IDENTIFY_RESPONSE_SUCCESS,
  LOGOUT_REQUEST,
  LOGOUT_RESPONSE_SUCCESS,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  extractNativeRequest,
  expectNativeCall,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

describe('Adapty - User Management (Bridge Integration)', () => {
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

  describe('identify', () => {
    it('should send Identify.Request with customer_user_id', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        identify: IDENTIFY_RESPONSE_SUCCESS,
      });

      await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });

      await adapty.identify({ customerUserId: 'user_12345' });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'identify',
        expectedRequest: IDENTIFY_REQUEST,
        callIndex: 1,
      });
    });

    it('should include iOS parameters when provided', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        identify: IDENTIFY_RESPONSE_SUCCESS,
      });

      await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });

      await adapty.identify({
        customerUserId: 'user_12345',
        params: {
          ios: {
            appAccountToken: 'ios_token_abc',
          },
        },
      });

      const request = extractNativeRequest<components['requests']['Identify.Request']>({
        nativeModule: nativeMock,
        callIndex: 1,
      });

      expect(request.customer_user_id).toBe('user_12345');
      expect(request.parameters?.app_account_token).toBe('ios_token_abc');
    });
  });

  describe('logout', () => {
    it('should send Logout.Request', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        logout: LOGOUT_RESPONSE_SUCCESS,
      });

      await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });

      await adapty.logout();

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'logout',
        expectedRequest: LOGOUT_REQUEST,
        callIndex: 1,
      });
    });
  });
});
