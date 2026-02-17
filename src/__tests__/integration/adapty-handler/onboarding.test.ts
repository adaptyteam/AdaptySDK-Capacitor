import { Adapty } from 'adapty';
import type { components } from 'shared/types/api';

import { ACTIVATE_RESPONSE_SUCCESS, GET_ONBOARDING_RESPONSE } from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  extractNativeRequest,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

describe('Adapty - Onboarding (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;

  beforeEach(async () => {
    adapty = new Adapty();

    nativeMock = createNativeModuleMock({
      activate: ACTIVATE_RESPONSE_SUCCESS,
      get_onboarding: GET_ONBOARDING_RESPONSE,
      get_onboarding_for_default_audience: GET_ONBOARDING_RESPONSE,
    });

    await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });
    nativeMock.handleMethodCall.mockClear();
  });

  afterEach(async () => {
    await cleanupAdapty(adapty);
    resetNativeModuleMock(nativeMock);
  });

  describe('getOnboarding', () => {
    it('should send correct GetOnboarding.Request', async () => {
      await adapty.getOnboarding({ placementId: 'test_onboarding_placement' });

      const request = extractNativeRequest<components['requests']['GetOnboarding.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('get_onboarding');
      expect(request.placement_id).toBe('test_onboarding_placement');
      expect(request.load_timeout).toBe(5);
      expect(request.fetch_policy?.type).toBe('reload_revalidating_cache_data');
    });

    it('should include locale in request when provided', async () => {
      await adapty.getOnboarding({ placementId: 'test_placement', locale: 'ru' });

      const request = extractNativeRequest<components['requests']['GetOnboarding.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.locale).toBe('ru');
    });
  });

  describe('getOnboardingForDefaultAudience', () => {
    it('should send correct GetOnboardingForDefaultAudience.Request', async () => {
      await adapty.getOnboardingForDefaultAudience({ placementId: 'test_onboarding_placement' });

      const request = extractNativeRequest<components['requests']['GetOnboardingForDefaultAudience.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('get_onboarding_for_default_audience');
      expect(request.placement_id).toBe('test_onboarding_placement');
      expect(request.fetch_policy?.type).toBe('reload_revalidating_cache_data');
    });
  });
});
