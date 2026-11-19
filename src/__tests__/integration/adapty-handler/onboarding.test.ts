import { Adapty } from 'adapty';
import type { components } from 'types/api';

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

    // An explicit undefined means "not provided", so the defaults still apply
    it('should send the defaults for params: undefined', async () => {
      await adapty.getOnboarding({ placementId: 'test_onboarding_placement', params: undefined });

      const request = extractNativeRequest<components['requests']['GetOnboarding.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.load_timeout).toBe(5);
      expect(request.fetch_policy).toEqual({ type: 'reload_revalidating_cache_data' });
    });

    it('should send the default load_timeout for loadTimeoutMs: undefined', async () => {
      await adapty.getOnboarding({ placementId: 'test_onboarding_placement', params: { loadTimeoutMs: undefined } });

      const request = extractNativeRequest<components['requests']['GetOnboarding.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.load_timeout).toBe(5);
    });

    it('should send the default fetch_policy for fetchPolicy: undefined', async () => {
      await adapty.getOnboarding({
        placementId: 'test_onboarding_placement',
        params: { fetchPolicy: undefined, loadTimeoutMs: 3000 },
      });

      const request = extractNativeRequest<components['requests']['GetOnboarding.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.fetch_policy).toEqual({ type: 'reload_revalidating_cache_data' });
      expect(request.load_timeout).toBe(3);
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

    it('should send the default fetch_policy for params: undefined', async () => {
      await adapty.getOnboardingForDefaultAudience({ placementId: 'test_onboarding_placement', params: undefined });

      const request = extractNativeRequest<components['requests']['GetOnboardingForDefaultAudience.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.fetch_policy).toEqual({ type: 'reload_revalidating_cache_data' });
    });
  });
});
