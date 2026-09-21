import { Adapty } from 'adapty';
import type { components } from 'types/api';

import {
  ACTIVATE_RESPONSE_SUCCESS,
  PRELOAD_FLOWS_RESPONSE,
  PRELOAD_FLOWS_FOR_DEFAULT_AUDIENCE_RESPONSE,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  extractNativeRequest,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

describe('Adapty - Placement preload (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;

  beforeEach(async () => {
    adapty = new Adapty();

    nativeMock = createNativeModuleMock({
      activate: ACTIVATE_RESPONSE_SUCCESS,
      preload_flows: PRELOAD_FLOWS_RESPONSE,
      preload_flows_for_default_audience: PRELOAD_FLOWS_FOR_DEFAULT_AUDIENCE_RESPONSE,
    });

    await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });
    nativeMock.handleMethodCall.mockClear();
  });

  afterEach(async () => {
    await cleanupAdapty(adapty);
    resetNativeModuleMock(nativeMock);
  });

  describe('preloadFlows', () => {
    it('should send correct PreloadFlows.Request', async () => {
      await adapty.preloadFlows({ placementIds: ['test_flow_placement', 'other_flow_placement'] });

      const request = extractNativeRequest<components['requests']['PreloadFlows.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('preload_flows');
      expect(request.placement_ids).toEqual(['test_flow_placement', 'other_flow_placement']);
      expect(request.load_timeout).toBe(5);
    });

    it('should convert loadTimeoutMs to seconds', async () => {
      await adapty.preloadFlows({ placementIds: ['test_flow_placement'], params: { loadTimeoutMs: 3000 } });

      const request = extractNativeRequest<components['requests']['PreloadFlows.Request']>({
        nativeModule: nativeMock,
      });

      // load_timeout is converted from ms to seconds (3000ms -> 3s)
      expect(request.load_timeout).toBe(3);
    });

    it('should pass an empty placement list through untouched', async () => {
      await adapty.preloadFlows({ placementIds: [] });

      const request = extractNativeRequest<components['requests']['PreloadFlows.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.placement_ids).toEqual([]);
    });
  });

  describe('preloadFlowsForDefaultAudience', () => {
    it('should send correct PreloadFlowsForDefaultAudience.Request', async () => {
      await adapty.preloadFlowsForDefaultAudience({ placementIds: ['test_flow_placement'] });

      const request = extractNativeRequest<components['requests']['PreloadFlowsForDefaultAudience.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('preload_flows_for_default_audience');
      expect(request.placement_ids).toEqual(['test_flow_placement']);
      // The schema has no timeout for the default audience variant
      expect(request).not.toHaveProperty('load_timeout');
    });
  });
});
