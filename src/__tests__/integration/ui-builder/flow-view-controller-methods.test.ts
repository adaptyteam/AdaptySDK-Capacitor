import { AdaptyError } from '@adapty/core';
import { Adapty } from 'adapty';
import type { AdaptyFlow } from 'types';
import type { components } from 'types/api';
import { createFlowView } from 'ui-builder/create-flow-view';

import { cleanupAdapty } from '../adapty-handler/setup.utils';
import {
  ACTIVATE_RESPONSE_SUCCESS,
  GET_FLOW_RESPONSE,
  ADAPTY_UI_CREATE_FLOW_VIEW_RESPONSE,
  ADAPTY_UI_CREATE_FLOW_VIEW_RESPONSE_WITH_LOCALE,
  ADAPTY_UI_PRESENT_FLOW_VIEW_RESPONSE,
  ADAPTY_UI_DISMISS_FLOW_VIEW_RESPONSE,
  ADAPTY_UI_DESTROY_FLOW_VIEW_RESPONSE,
  ADAPTY_UI_SHOW_DIALOG_RESPONSE_PRIMARY,
  ADAPTY_UI_SEND_APP_MESSAGE_RESPONSE,
  ADAPTY_UI_SEND_APP_MESSAGE_RESPONSE_ERROR,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  emitNativeEvent,
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
 * - Parameter handling (prefetchProducts, loadTimeoutMs, customLayoutId, android.enableSafeArea, iOS styles)
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
      adapty_ui_destroy_flow_view: ADAPTY_UI_DESTROY_FLOW_VIEW_RESPONSE,
      adapty_ui_show_dialog: ADAPTY_UI_SHOW_DIALOG_RESPONSE_PRIMARY,
      adapty_ui_send_app_message: ADAPTY_UI_SEND_APP_MESSAGE_RESPONSE,
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
      expect(request.flow.variation_name).toBe('Variation A');
      expect(request.preload_products).toBe(true); // default
      expect(request.load_timeout).toBe(5); // 5000ms → 5s
      expect(request.enable_safe_area_paddings).toBe(true); // controller default (wire key)

      // Verify response parsing
      expect((view as any).id).toBe('mock_flow_view_123');
      expect(request.locale).toBeUndefined();
      expect(view.locale).toBeUndefined();
    });

    it('should encode requested locale', async () => {
      await createFlowView(flow, { locale: 'es' });

      const request = extractNativeRequest<components['requests']['AdaptyUICreateFlowView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.locale).toBe('es');
    });

    it('should expose the locale reported by the native view', async () => {
      createNativeModuleMock({
        adapty_ui_create_flow_view: ADAPTY_UI_CREATE_FLOW_VIEW_RESPONSE_WITH_LOCALE,
      });

      const view = await createFlowView(flow);

      expect(view.locale).toBe('es');
    });

    it('should encode customLayoutId', async () => {
      await createFlowView(flow, { customLayoutId: 'tablet_layout' });

      const request = extractNativeRequest<components['requests']['AdaptyUICreateFlowView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.custom_layout_id).toBe('tablet_layout');
    });

    it('should omit custom_layout_id when customLayoutId is not provided', async () => {
      await createFlowView(flow);

      const request = extractNativeRequest<components['requests']['AdaptyUICreateFlowView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.custom_layout_id).toBeUndefined();
    });

    it('should reject createFlowView with platformNotSupported', async () => {
      createNativeModuleMock({
        adapty_ui_create_flow_view: { error: { adapty_code: 4001, message: 'platformNotSupported' } },
      });

      const error = await createFlowView(flow).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AdaptyError);
      expect(error).toMatchObject({ adaptyCode: 4001, codeName: 'platformNotSupported' });
    });

    it('should encode custom parameters', async () => {
      await createFlowView(flow, {
        prefetchProducts: false,
        loadTimeoutMs: 3000,
        android: { enableSafeArea: false },
      });

      const request = extractNativeRequest<components['requests']['AdaptyUICreateFlowView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.preload_products).toBe(false);
      expect(request.load_timeout).toBe(3); // 3000ms → 3s
      expect(request.enable_safe_area_paddings).toBe(false); // caller override (wire key)
    });

    it('should send ui_schema back unchanged', async () => {
      await createFlowView(flow);

      const request = extractNativeRequest<components['requests']['AdaptyUICreateFlowView.Request']>({
        nativeModule: nativeMock,
        callIndex: 0,
      });

      expect(request.flow.ui_schema).toStrictEqual({
        layouts: [{ flow_layout_id: 'layout1' }],
        grids: [{ platforms: 'all', h_breakpoints: [320], cells: [0] }],
      });
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
      // destroy defaults to true, releasing the native view as before
      expect(request.destroy).toBe(true);
    });

    it('should encode destroy: false when the view is kept alive', async () => {
      const view = await createFlowView(flow);
      nativeMock.handleMethodCall.mockClear();

      await view.dismiss({ destroy: false });

      const request = extractNativeRequest<components['requests']['AdaptyUIDismissFlowView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.destroy).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should send AdaptyUIDestroyFlowView.Request', async () => {
      const view = await createFlowView(flow);
      nativeMock.handleMethodCall.mockClear();

      await view.destroy();

      const request = extractNativeRequest<components['requests']['AdaptyUIDestroyFlowView.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('adapty_ui_destroy_flow_view');
      expect(request.id).toBe('mock_flow_view_123');
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

  describe('sendAppMessage', () => {
    it('should send AdaptyUISendAppMessage.Request with a generated message id', async () => {
      const view = await createFlowView(flow);
      nativeMock.handleMethodCall.mockClear();

      const payload = { coins: 10, nested: { ok: true } };
      await expect(view.sendAppMessage(payload)).resolves.toBeUndefined();

      const request = extractNativeRequest<components['requests']['AdaptyUISendAppMessage.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('adapty_ui_send_app_message');
      expect(request.id).toBe('mock_flow_view_123');
      expect(request.payload).toEqual(payload);
      expect(typeof request.message_id).toBe('string');
      expect(request.message_id.length).toBeGreaterThan(0);
    });

    it('should generate a new message id per call', async () => {
      const view = await createFlowView(flow);
      nativeMock.handleMethodCall.mockClear();

      await view.sendAppMessage({ a: 1 });
      await view.sendAppMessage({ a: 1 });

      const [first, second] = [0, 1].map(
        (callIndex) =>
          extractNativeRequest<components['requests']['AdaptyUISendAppMessage.Request']>({
            nativeModule: nativeMock,
            callIndex,
          }).message_id,
      );

      expect(first).not.toBe(second);
    });

    it.each(['dismiss', 'destroy'] as const)(
      'should send to the old id and reject with 3001 after %s',
      async (method) => {
        const view = await createFlowView(flow);
        await view[method]();

        // The controller keeps its id; native reports the released view
        createNativeModuleMock({
          adapty_ui_send_app_message: ADAPTY_UI_SEND_APP_MESSAGE_RESPONSE_ERROR,
        });

        const error = await view.sendAppMessage({ a: 1 }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(AdaptyError);
        expect(error).toMatchObject({ adaptyCode: 3001, codeName: 'wrongParam' });

        const calls = nativeMock.handleMethodCall.mock.calls;
        const request = extractNativeRequest<components['requests']['AdaptyUISendAppMessage.Request']>({
          nativeModule: nativeMock,
          callIndex: calls.length - 1,
        });
        expect(request.method).toBe('adapty_ui_send_app_message');
        expect(request.id).toBe('mock_flow_view_123');
      },
    );

    it('should throw without a bridge call when the view reference is missing', async () => {
      const view = await createFlowView(flow);
      nativeMock.handleMethodCall.mockClear();
      (view as any).id = null;

      await expect(view.sendAppMessage({ a: 1 })).rejects.toMatchObject({ adaptyCode: 2002 });
      expect(nativeMock.handleMethodCall).not.toHaveBeenCalled();
    });
  });

  describe('onCustomAction arguments', () => {
    const performAction = (action: Record<string, unknown>) =>
      emitNativeEvent({
        eventName: 'flow_view_did_perform_action',
        eventData: {
          id: 'flow_view_did_perform_action',
          view: { id: 'mock_flow_view_123' },
          action,
        },
      });

    it('passes custom action arguments to onCustomAction', async () => {
      const view = await createFlowView(flow);
      const onCustomAction = jest.fn(() => false);
      await view.setEventHandlers({ onCustomAction });

      performAction({ type: 'custom', value: 'open_article', arguments: { article_id: 42, tags: ['a', 'b'] } });

      expect(onCustomAction).toHaveBeenCalledWith('open_article', { article_id: 42, tags: ['a', 'b'] });
    });

    it('passes an empty object when the action has no arguments', async () => {
      const view = await createFlowView(flow);
      const onCustomAction = jest.fn(() => false);
      await view.setEventHandlers({ onCustomAction });

      performAction({ type: 'custom', value: 'open_article' });

      expect(onCustomAction).toHaveBeenCalledWith('open_article', {});
    });
  });
});
