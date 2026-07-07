import { Adapty } from 'adapty';
import type { AdaptyFlow } from 'types';
import type { components } from 'types/api';
import { createFlowView } from 'ui-builder/create-flow-view';

import { cleanupAdapty } from '../adapty-handler/setup.utils';
import {
  ACTIVATE_RESPONSE_SUCCESS,
  GET_FLOW_RESPONSE,
  ADAPTY_UI_CREATE_FLOW_VIEW_RESPONSE,
  ADAPTY_UI_PRESENT_FLOW_VIEW_RESPONSE,
  ADAPTY_UI_DISMISS_FLOW_VIEW_RESPONSE,
  ADAPTY_UI_SHOW_DIALOG_RESPONSE_PRIMARY,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  extractNativeRequest,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

/**
 * Integration tests for FlowViewController methods
 *
 * Tests verify bridge communication for UI methods:
 * - Request encoding (camelCase → snake_case)
 * - Response parsing (snake_case → camelCase)
 * - Parameter handling (prefetchProducts, loadTimeoutMs, enableSafeArea, iOS styles)
 *
 * Note: Event handling tests are separate
 */
describe('FlowViewController Methods (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;
  let flow: AdaptyFlow;

  beforeEach(async () => {
    adapty = new Adapty();

    nativeMock = createNativeModuleMock({
      activate: ACTIVATE_RESPONSE_SUCCESS,
      get_flow: GET_FLOW_RESPONSE,
      adapty_ui_create_flow_view: ADAPTY_UI_CREATE_FLOW_VIEW_RESPONSE,
      adapty_ui_present_flow_view: ADAPTY_UI_PRESENT_FLOW_VIEW_RESPONSE,
      adapty_ui_dismiss_flow_view: ADAPTY_UI_DISMISS_FLOW_VIEW_RESPONSE,
      adapty_ui_show_dialog: ADAPTY_UI_SHOW_DIALOG_RESPONSE_PRIMARY,
    });

    await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });
    flow = await adapty.getFlow({ placementId: 'test_placement' });
    nativeMock.handleMethodCall.mockClear();
  });

  afterEach(async () => {
    await cleanupAdapty(adapty);
    resetNativeModuleMock(nativeMock);
  });

  describe('createFlowView', () => {
    it('should send AdaptyUICreateFlowView.Request with default parameters', async () => {
      const view = await createFlowView(flow);

      const request = extractNativeRequest<components['requests']['AdaptyUICreateFlowView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('adapty_ui_create_flow_view');
      expect(request.flow).toBeDefined();
      expect(request.flow.flow_id).toBe('flow_test_placement');
      expect(request.flow.variation_id).toBe('variation_123');
      expect(request.preload_products).toBe(true); // default
      expect(request.load_timeout).toBe(5); // 5000ms → 5s
      expect(request.enable_safe_area_paddings).toBe(true); // controller default (wire key)

      // Verify response parsing
      expect((view as any).id).toBe('mock_flow_view_123');
    });

    it('should encode custom parameters', async () => {
      await createFlowView(flow, {
        prefetchProducts: false,
        loadTimeoutMs: 3000,
        enableSafeArea: false,
      });

      const request = extractNativeRequest<components['requests']['AdaptyUICreateFlowView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.preload_products).toBe(false);
      expect(request.load_timeout).toBe(3); // 3000ms → 3s
      expect(request.enable_safe_area_paddings).toBe(false); // caller override (wire key)
    });
  });

  describe('present', () => {
    it('should send request with default full_screen presentation style', async () => {
      const view = await createFlowView(flow);
      nativeMock.handleMethodCall.mockClear();

      await view.present();

      const request = extractNativeRequest<components['requests']['AdaptyUIPresentFlowView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('adapty_ui_present_flow_view');
      expect(request.id).toBe('mock_flow_view_123');
      expect(request.ios_presentation_style).toBe('full_screen');
    });

    it('should encode page_sheet presentation style', async () => {
      const view = await createFlowView(flow);
      nativeMock.handleMethodCall.mockClear();

      await view.present({ iosPresentationStyle: 'page_sheet' });

      const request = extractNativeRequest<components['requests']['AdaptyUIPresentFlowView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.ios_presentation_style).toBe('page_sheet');
    });
  });

  describe('dismiss', () => {
    it('should send AdaptyUIDismissFlowView.Request', async () => {
      const view = await createFlowView(flow);
      nativeMock.handleMethodCall.mockClear();

      await view.dismiss();

      const request = extractNativeRequest<components['requests']['AdaptyUIDismissFlowView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('adapty_ui_dismiss_flow_view');
      expect(request.id).toBe('mock_flow_view_123');
      expect(request.destroy).toBe(true); // Capacitor uses destroy: true
    });
  });

  describe('showDialog', () => {
    it('should encode dialog configuration correctly', async () => {
      const view = await createFlowView(flow);
      nativeMock.handleMethodCall.mockClear();

      const result = await view.showDialog({
        title: 'Confirm Action',
        content: 'Are you sure?',
        primaryActionTitle: 'Yes',
        secondaryActionTitle: 'No',
      });

      const request = extractNativeRequest<components['requests']['AdaptyUIShowDialog.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('adapty_ui_show_dialog');
      expect(request.id).toBe('mock_flow_view_123');
      expect(request.configuration.title).toBe('Confirm Action');
      expect(request.configuration.content).toBe('Are you sure?');
      expect(request.configuration.default_action_title).toBe('Yes');
      expect(request.configuration.secondary_action_title).toBe('No');

      // Verify response parsing
      expect(result).toBe('primary');
    });

    it('should handle dialog with only primary action', async () => {
      const view = await createFlowView(flow);
      nativeMock.handleMethodCall.mockClear();

      await view.showDialog({
        title: 'Alert',
        content: 'This is an alert',
        primaryActionTitle: 'OK',
      });

      const request = extractNativeRequest<components['requests']['AdaptyUIShowDialog.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.configuration.secondary_action_title).toBeUndefined();
    });
  });
});
