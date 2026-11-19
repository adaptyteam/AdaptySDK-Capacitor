import { AdaptyError } from '@adapty/core';
import { Capacitor } from '@capacitor/core';
import { Adapty } from 'adapty';
import type { components } from 'types/api';

import {
  ACTIVATE_RESPONSE_SUCCESS,
  GET_PENDING_STORE_MESSAGE_TYPES_REQUEST,
  GET_PENDING_STORE_MESSAGE_TYPES_RESPONSE,
  SHOW_STORE_MESSAGES_REQUEST,
  SHOW_STORE_MESSAGES_REQUEST_WITH_FILTER,
  SHOW_STORE_MESSAGES_RESPONSE,
  SHOW_STORE_MESSAGES_RESPONSE_IN_PROGRESS,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  expectNativeCall,
  extractNativeRequest,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

const originalGetPlatform = Capacitor.getPlatform;

describe('Adapty - Store messages (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;

  const setUp = async (responses: Parameters<typeof createNativeModuleMock>[0]) => {
    adapty = new Adapty();
    nativeMock = createNativeModuleMock({ activate: ACTIVATE_RESPONSE_SUCCESS, ...responses });
    await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });
    nativeMock.handleMethodCall.mockClear();
  };

  afterEach(async () => {
    await cleanupAdapty(adapty);
    resetNativeModuleMock(nativeMock);
  });

  describe('iOS', () => {
    beforeAll(() => {
      Capacitor.getPlatform = jest.fn(() => 'ios');
    });

    afterAll(() => {
      Capacitor.getPlatform = originalGetPlatform;
    });

    it('getPendingStoreMessageTypes returns the native types untouched', async () => {
      await setUp({ get_pending_store_message_types: GET_PENDING_STORE_MESSAGE_TYPES_RESPONSE });

      const types = await adapty.getPendingStoreMessageTypes();

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'get_pending_store_message_types',
        expectedRequest: GET_PENDING_STORE_MESSAGE_TYPES_REQUEST,
      });
      expect(types).toStrictEqual(['billing_issue', 'storekit_-42']);
    });

    it('showStoreMessages without options omits filter (show all)', async () => {
      await setUp({ show_store_messages: SHOW_STORE_MESSAGES_RESPONSE });

      await adapty.showStoreMessages();

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'show_store_messages',
        expectedRequest: SHOW_STORE_MESSAGES_REQUEST,
      });
      const request = extractNativeRequest<components['requests']['ShowStoreMessage.Request']>({
        nativeModule: nativeMock,
      });
      expect(request).not.toHaveProperty('filter');
    });

    it('showStoreMessages forwards the filter', async () => {
      await setUp({ show_store_messages: SHOW_STORE_MESSAGES_RESPONSE });

      await adapty.showStoreMessages({ ios: { filter: ['price_increase_consent', 'billing_issue'] } });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'show_store_messages',
        expectedRequest: SHOW_STORE_MESSAGES_REQUEST_WITH_FILTER,
      });
    });

    it('showStoreMessages keeps an empty filter (native no-op, not show all)', async () => {
      await setUp({ show_store_messages: SHOW_STORE_MESSAGES_RESPONSE });

      await adapty.showStoreMessages({ ios: { filter: [] } });

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'show_store_messages',
        expectedRequest: { method: 'show_store_messages', filter: [] },
      });
    });

    it('showStoreMessages rejects with the native AdaptyError', async () => {
      await setUp({ show_store_messages: SHOW_STORE_MESSAGES_RESPONSE_IN_PROGRESS });

      const error = await adapty.showStoreMessages().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AdaptyError);
      expect((error as AdaptyError).adaptyCode).toBe(3201);
    });
  });

  describe('Android', () => {
    beforeAll(() => {
      Capacitor.getPlatform = jest.fn(() => 'android');
    });

    afterAll(() => {
      Capacitor.getPlatform = originalGetPlatform;
    });

    it('getPendingStoreMessageTypes resolves null (unknown) without calling native', async () => {
      await setUp({});

      const types = await adapty.getPendingStoreMessageTypes();

      expect(types).toBeNull();
      expect(nativeMock.handleMethodCall).not.toHaveBeenCalled();
    });

    it('showStoreMessages calls native', async () => {
      await setUp({ show_store_messages: SHOW_STORE_MESSAGES_RESPONSE });

      await adapty.showStoreMessages();

      expectNativeCall({
        nativeModule: nativeMock,
        method: 'show_store_messages',
        expectedRequest: SHOW_STORE_MESSAGES_REQUEST,
      });
    });

    it.each([[['billing_issue']], [[]]])('showStoreMessages drops the iOS-only filter %j', async (filter) => {
      await setUp({ show_store_messages: SHOW_STORE_MESSAGES_RESPONSE });

      await adapty.showStoreMessages({ ios: { filter } });

      const request = extractNativeRequest<components['requests']['ShowStoreMessage.Request']>({
        nativeModule: nativeMock,
      });
      expect(request).toStrictEqual(SHOW_STORE_MESSAGES_REQUEST);
    });
  });
});
