import { Adapty } from 'adapty';
import type { components } from 'shared/types/api';

import {
  ACTIVATE_REQUEST_MINIMAL,
  ACTIVATE_REQUEST_WITH_CUSTOMER_USER_ID,
  ACTIVATE_REQUEST_FULL,
  ACTIVATE_REQUEST_WITH_IOS_PARAMS,
  ACTIVATE_REQUEST_WITH_ANDROID_PARAMS,
  ACTIVATE_REQUEST_WITH_BACKEND_PROXY,
  ACTIVATE_REQUEST_WITH_MEDIA_CACHE,
  ACTIVATE_REQUEST_WITH_EU_CLUSTER,
  ACTIVATE_REQUEST_WITH_UI_DISABLED,
  ACTIVATE_RESPONSE_SUCCESS,
  ACTIVATE_RESPONSE_ERROR,
  IS_ACTIVATED_REQUEST,
  IS_ACTIVATED_RESPONSE_TRUE,
  IS_ACTIVATED_RESPONSE_FALSE,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  extractNativeRequest,
  expectNativeCall,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

const { Capacitor } = require('@capacitor/core');

/**
 * Integration tests for Adapty activation flow (Capacitor)
 *
 * These tests verify the FULL bridge communication path:
 * 1. SDK encodes parameters via AdaptyConfigurationCoder (camelCase → snake_case)
 * 2. Bridge sends correctly formatted JSON to AdaptyCapacitorPlugin.handleMethodCall
 * 3. Response JSON is parsed and returned to caller
 *
 * All request/response formats are validated against api.d.ts types.
 */
describe('Adapty - Activation (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;

  beforeEach(() => {
    adapty = new Adapty();
    // Default platform is 'ios' (set in jest.setup.js)
    (Capacitor.getPlatform as jest.Mock).mockReturnValue('ios');
  });

  afterEach(async () => {
    await cleanupAdapty(adapty);

    if (nativeMock) {
      resetNativeModuleMock(nativeMock);
    }
  });

  describe('Basic activation', () => {
    it('should send correct Activate.Request with minimal params', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        is_activated: IS_ACTIVATED_RESPONSE_TRUE,
      });

      await adapty.activate({ apiKey: 'test_api_key_12345' });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'activate',
        expectedRequest: ACTIVATE_REQUEST_MINIMAL,
      });

      const isActivated = await adapty.isActivated();
      expect(isActivated).toBe(true);
    });

    it('should send Activate.Request with log_level in snake_case', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: { logLevel: 'error' },
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      expect(request.configuration.log_level).toBe('error');
      expect((request.configuration as any).logLevel).toBeUndefined();
    });

    it('should send Activate.Request with customer_user_id', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          customerUserId: 'user_123',
          logLevel: 'error',
        },
      });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'activate',
        expectedRequest: ACTIVATE_REQUEST_WITH_CUSTOMER_USER_ID,
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      expect(request.configuration.customer_user_id).toBe('user_123');
    });

    it('should handle Activate.Response error', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_ERROR,
      });

      await expect(adapty.activate({ apiKey: 'invalid_key' })).rejects.toThrow();

      expect(nativeMock.handleMethodCall).toHaveBeenCalledTimes(1);
    });
  });

  describe('Full configuration', () => {
    it('should send Activate.Request with all common fields', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          customerUserId: 'user_123',
          observerMode: false,
          serverCluster: 'default',
          logLevel: 'verbose',
          ipAddressCollectionDisabled: false,
        },
      });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'activate',
        expectedRequest: ACTIVATE_REQUEST_FULL,
      });
    });
  });

  describe('iOS-specific parameters', () => {
    beforeEach(() => {
      (Capacitor.getPlatform as jest.Mock).mockReturnValue('ios');
    });

    it('should encode iOS-specific fields when platform is ios', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          ios: {
            idfaCollectionDisabled: true,
            clearDataOnBackup: true,
            appAccountToken: 'ios-app-account-token-uuid',
          },
        },
      });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'activate',
        expectedRequest: ACTIVATE_REQUEST_WITH_IOS_PARAMS,
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      expect(request.configuration.apple_idfa_collection_disabled).toBe(true);
      expect(request.configuration.clear_data_on_backup).toBe(true);
      expect(request.configuration.customer_identity_parameters).toEqual({
        app_account_token: 'ios-app-account-token-uuid',
      });
    });

    it('should encode idfaCollectionDisabled without appAccountToken', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          ios: {
            idfaCollectionDisabled: true,
          },
        },
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      expect(request.configuration.apple_idfa_collection_disabled).toBe(true);
      expect(request.configuration.customer_identity_parameters).toBeUndefined();
    });

    it('should NOT encode appAccountToken into customer_identity_parameters on android', async () => {
      (Capacitor.getPlatform as jest.Mock).mockReturnValue('android');

      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          ios: {
            appAccountToken: 'ios-app-account-token-uuid',
            idfaCollectionDisabled: true,
          },
        },
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      // idfaCollectionDisabled is encoded regardless of platform
      expect(request.configuration.apple_idfa_collection_disabled).toBe(true);
      // appAccountToken is NOT encoded on android
      expect(request.configuration.customer_identity_parameters).toBeUndefined();
    });
  });

  describe('Android-specific parameters', () => {
    beforeEach(() => {
      (Capacitor.getPlatform as jest.Mock).mockReturnValue('android');
    });

    it('should encode Android-specific fields when platform is android', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          android: {
            adIdCollectionDisabled: true,
            pendingPrepaidPlansEnabled: true,
            localAccessLevelAllowed: true,
            obfuscatedAccountId: 'obfuscated-account-id-123',
          },
        },
      });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'activate',
        expectedRequest: ACTIVATE_REQUEST_WITH_ANDROID_PARAMS,
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      expect(request.configuration.google_adid_collection_disabled).toBe(true);
      expect(request.configuration.google_enable_pending_prepaid_plans).toBe(true);
      expect(request.configuration.google_local_access_level_allowed).toBe(true);
      expect(request.configuration.customer_identity_parameters).toEqual({
        obfuscated_account_id: 'obfuscated-account-id-123',
      });
    });

    it('should encode adIdCollectionDisabled without obfuscatedAccountId', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          android: {
            adIdCollectionDisabled: true,
          },
        },
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      expect(request.configuration.google_adid_collection_disabled).toBe(true);
      expect(request.configuration.customer_identity_parameters).toBeUndefined();
    });

    it('should NOT encode obfuscatedAccountId into customer_identity_parameters on ios', async () => {
      (Capacitor.getPlatform as jest.Mock).mockReturnValue('ios');

      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          android: {
            adIdCollectionDisabled: true,
            obfuscatedAccountId: 'obfuscated-account-id-123',
          },
        },
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      // adIdCollectionDisabled is encoded regardless of platform
      expect(request.configuration.google_adid_collection_disabled).toBe(true);
      // obfuscatedAccountId is NOT encoded on ios
      expect(request.configuration.customer_identity_parameters).toBeUndefined();
    });
  });

  describe('Backend proxy configuration', () => {
    it('should encode backend proxy host and port', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          backendProxyHost: 'https://proxy.example.com',
          backendProxyPort: 8080,
        },
      });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'activate',
        expectedRequest: ACTIVATE_REQUEST_WITH_BACKEND_PROXY,
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      expect(request.configuration.backend_proxy_host).toBe('https://proxy.example.com');
      expect(request.configuration.backend_proxy_port).toBe(8080);
    });

    it('should encode only backend proxy host without port', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          backendProxyHost: 'https://proxy.example.com',
        },
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      expect(request.configuration.backend_proxy_host).toBe('https://proxy.example.com');
      expect(request.configuration.backend_proxy_port).toBeUndefined();
    });
  });

  describe('Media cache configuration', () => {
    it('should encode custom media_cache settings', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          mediaCache: {
            memoryStorageTotalCostLimit: 50 * 1024 * 1024,
            memoryStorageCountLimit: 100,
            diskStorageSizeLimit: 200 * 1024 * 1024,
          },
        },
      });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'activate',
        expectedRequest: ACTIVATE_REQUEST_WITH_MEDIA_CACHE,
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      expect(request.configuration.media_cache).toEqual({
        memory_storage_total_cost_limit: 50 * 1024 * 1024,
        memory_storage_count_limit: 100,
        disk_storage_size_limit: 200 * 1024 * 1024,
      });
    });

    it('should use default media_cache when not specified', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({ apiKey: 'test_api_key_12345' });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      // SDK provides default media_cache values
      expect(request.configuration.media_cache).toBeDefined();
      expect(request.configuration.media_cache).toEqual({
        memory_storage_total_cost_limit: 100 * 1024 * 1024,
        memory_storage_count_limit: 2147483647,
        disk_storage_size_limit: 100 * 1024 * 1024,
      });
    });
  });

  describe('Server cluster and UI configuration', () => {
    it('should encode EU server cluster', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          serverCluster: 'eu',
        },
      });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'activate',
        expectedRequest: ACTIVATE_REQUEST_WITH_EU_CLUSTER,
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });
      expect(request.configuration.server_cluster).toBe('eu');
    });

    it('should encode activate_ui as false when disabled', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          activateUi: false,
        },
      });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'activate',
        expectedRequest: ACTIVATE_REQUEST_WITH_UI_DISABLED,
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });
      expect(request.configuration.activate_ui).toBe(false);
    });
  });

  describe('isActivated state', () => {
    it('should return false before activation', async () => {
      nativeMock = createNativeModuleMock({
        is_activated: IS_ACTIVATED_RESPONSE_FALSE,
      });

      const isActivated = await adapty.isActivated();
      expect(isActivated).toBe(false);

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'is_activated',
        expectedRequest: IS_ACTIVATED_REQUEST,
      });
    });

    it('should return true after successful activation', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        is_activated: IS_ACTIVATED_RESPONSE_TRUE,
      });

      await adapty.activate({ apiKey: 'test_api_key_12345' });
      const isActivated = await adapty.isActivated();
      expect(isActivated).toBe(true);

      expect(nativeMock.handleMethodCall).toHaveBeenCalledTimes(2);

      const firstCall = nativeMock.handleMethodCall.mock.calls[0];
      expect(firstCall?.[0].methodName).toBe('activate');

      const secondCall = nativeMock.handleMethodCall.mock.calls[1];
      expect(secondCall?.[0].methodName).toBe('is_activated');
    });
  });

  describe('Configuration encoding', () => {
    it('should encode all configuration fields in snake_case', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({
        apiKey: 'test_api_key_12345',
        params: {
          customerUserId: 'user_123',
          observerMode: true,
          serverCluster: 'eu',
          logLevel: 'verbose',
          ipAddressCollectionDisabled: true,
        },
      });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      expect(request.configuration).toMatchObject({
        api_key: 'test_api_key_12345',
        customer_user_id: 'user_123',
        observer_mode: true,
        server_cluster: 'eu',
        log_level: 'verbose',
        ip_address_collection_disabled: true,
      });

      // Verify no camelCase fields leaked
      const configAny = request.configuration as any;
      expect(configAny.customerUserId).toBeUndefined();
      expect(configAny.observerMode).toBeUndefined();
      expect(configAny.serverCluster).toBeUndefined();
      expect(configAny.logLevel).toBeUndefined();
      expect(configAny.ipAddressCollectionDisabled).toBeUndefined();
    });

    it('should include api_key and default fields', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({ apiKey: 'test_api_key_12345' });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      expect(request.configuration.api_key).toBe('test_api_key_12345');
      expect(request.configuration.cross_platform_sdk_name).toBe('capacitor');
      expect(request.configuration.cross_platform_sdk_version).toBeDefined();
      // Capacitor SDK adds these defaults
      expect(request.configuration.observer_mode).toBe(false);
      expect(request.configuration.server_cluster).toBe('default');
      expect(request.configuration.ip_address_collection_disabled).toBe(false);
      expect(request.configuration.activate_ui).toBe(true);
      expect(request.configuration.media_cache).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should throw on Activate.Response error', async () => {
      const errorResponse: components['requests']['Activate.Response'] = {
        error: {
          adapty_code: 2002,
          message: 'Invalid API key',
          detail: 'The provided API key is not valid',
        },
      };

      nativeMock = createNativeModuleMock({
        activate: errorResponse,
      });

      await expect(adapty.activate({ apiKey: 'invalid_key' })).rejects.toThrow('Invalid API key');
    });

    it('should handle unregistered method rejection', async () => {
      nativeMock = createNativeModuleMock({
        // No response registered — will reject
      });

      await expect(adapty.activate({ apiKey: 'test_key' })).rejects.toThrow('No mock response configured for method');
    });
  });

  describe('Response parsing', () => {
    it('should parse success response correctly', async () => {
      nativeMock = createNativeModuleMock({
        activate: { success: true },
      });

      await expect(adapty.activate({ apiKey: 'test_key' })).resolves.not.toThrow();
    });

    it('should handle IsActivated.Response boolean value', async () => {
      nativeMock = createNativeModuleMock({
        is_activated: { success: true },
      });

      const result = await adapty.isActivated();

      expect(result).toBe(true);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Type safety verification', () => {
    it('should have strictly typed request structure', async () => {
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
      });

      await adapty.activate({ apiKey: 'test_key' });

      const request = extractNativeRequest<components['requests']['Activate.Request']>({ nativeModule: nativeMock });

      expect(request.method).toBe('activate');
      expect(request.configuration.api_key).toBe('test_key');

      // @ts-expect-error - this property doesn't exist in api.d.ts
      expect(request.configuration.nonExistentField).toBeUndefined();
    });

    it('should have strictly typed response structure', async () => {
      const typedResponse: components['requests']['Activate.Response'] = {
        success: true,
      };

      nativeMock = createNativeModuleMock({
        activate: typedResponse,
      });

      await adapty.activate({ apiKey: 'test_key' });

      expect(typedResponse).toHaveProperty('success');
    });
  });
});
