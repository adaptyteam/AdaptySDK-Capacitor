import { Adapty } from 'adapty';
import type { components } from 'shared/types/api';
import { createOnboardingView } from 'ui-builder/create-onboarding-view';

import { cleanupAdapty } from '../adapty-handler/setup.utils';
import {
  ACTIVATE_RESPONSE_SUCCESS,
  GET_ONBOARDING_RESPONSE,
  ADAPTY_UI_CREATE_ONBOARDING_VIEW_RESPONSE,
  ADAPTY_UI_PRESENT_ONBOARDING_VIEW_RESPONSE,
  ADAPTY_UI_DISMISS_ONBOARDING_VIEW_RESPONSE,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  extractNativeRequest,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

/**
 * Integration tests for OnboardingViewController methods
 *
 * Tests verify bridge communication for onboarding UI methods:
 * - Request encoding (camelCase → snake_case)
 * - Response parsing (snake_case → camelCase)
 * - Parameter handling (externalUrlsPresentation, iOS styles)
 *
 * Note: Event handling tests are separate
 */
describe('OnboardingViewController Methods (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;

  beforeEach(async () => {
    adapty = new Adapty();

    nativeMock = createNativeModuleMock({
      activate: ACTIVATE_RESPONSE_SUCCESS,
      get_onboarding: GET_ONBOARDING_RESPONSE,
      adapty_ui_create_onboarding_view: ADAPTY_UI_CREATE_ONBOARDING_VIEW_RESPONSE,
      adapty_ui_present_onboarding_view: ADAPTY_UI_PRESENT_ONBOARDING_VIEW_RESPONSE,
      adapty_ui_dismiss_onboarding_view: ADAPTY_UI_DISMISS_ONBOARDING_VIEW_RESPONSE,
    });

    await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });
  });

  afterEach(async () => {
    await cleanupAdapty(adapty);
    resetNativeModuleMock(nativeMock);
  });

  describe('createOnboardingView', () => {
    it('should send AdaptyUICreateOnboardingView.Request with default parameters', async () => {
      const onboarding = await adapty.getOnboarding({ placementId: 'test_onboarding_placement' });
      nativeMock.handleMethodCall.mockClear();

      const view = await createOnboardingView(onboarding);

      const request = extractNativeRequest<components['requests']['AdaptyUICreateOnboardingView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('adapty_ui_create_onboarding_view');
      expect(request.onboarding).toBeDefined();
      expect(request.onboarding.onboarding_id).toBe('onboarding_123');
      expect(request.onboarding.variation_id).toBe('onboarding_variation_456');
      expect(request.external_urls_presentation).toBe('browser_in_app'); // default

      // Verify response parsing
      expect((view as any).id).toBe('mock_onboarding_view_789');
    });

    it('should encode custom externalUrlsPresentation', async () => {
      const onboarding = await adapty.getOnboarding({ placementId: 'test_onboarding_placement' });
      nativeMock.handleMethodCall.mockClear();

      await createOnboardingView(onboarding, {
        externalUrlsPresentation: 'browser_out_app',
      });

      const request = extractNativeRequest<components['requests']['AdaptyUICreateOnboardingView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.external_urls_presentation).toBe('browser_out_app');
    });
  });

  describe('present', () => {
    it('should send AdaptyUIPresentOnboardingView.Request', async () => {
      const onboarding = await adapty.getOnboarding({ placementId: 'test_onboarding_placement' });
      const view = await createOnboardingView(onboarding);
      nativeMock.handleMethodCall.mockClear();

      await view.present({ iosPresentationStyle: 'page_sheet' });

      const request = extractNativeRequest<components['requests']['AdaptyUIPresentOnboardingView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('adapty_ui_present_onboarding_view');
      expect(request.id).toBe('mock_onboarding_view_789');
      expect(request.ios_presentation_style).toBe('page_sheet');
    });
  });

  describe('dismiss', () => {
    it('should send AdaptyUIDismissOnboardingView.Request', async () => {
      const onboarding = await adapty.getOnboarding({ placementId: 'test_onboarding_placement' });
      const view = await createOnboardingView(onboarding);
      nativeMock.handleMethodCall.mockClear();

      await view.dismiss();

      const request = extractNativeRequest<components['requests']['AdaptyUIDismissOnboardingView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('adapty_ui_dismiss_onboarding_view');
      expect(request.id).toBe('mock_onboarding_view_789');
      expect(request.destroy).toBe(true); // Capacitor uses destroy: true
    });
  });
});
