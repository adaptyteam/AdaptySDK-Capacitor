import { FetchPolicy } from '@adapty/core';
import { Adapty } from 'adapty';
import type { components } from 'types/api';

import {
  ACTIVATE_RESPONSE_SUCCESS,
  GET_FLOW_REQUEST,
  GET_FLOW_RESPONSE,
  GET_FLOW_RESPONSE_ERROR,
  GET_FLOW_FOR_DEFAULT_AUDIENCE_REQUEST,
  GET_FLOW_FOR_DEFAULT_AUDIENCE_RESPONSE,
  LOG_SHOW_FLOW_RESPONSE,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  extractNativeRequest,
  expectNativeCall,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

/**
 * Integration tests for Adapty flow operations
 *
 * Tests verify:
 * 1. GetFlow request format and response parsing
 * 2. GetFlowForDefaultAudience request and response
 * 3. LogShowFlow request encoding
 * 4. Flow field transformations (snake_case → camelCase)
 */
describe('Adapty - Flow (Bridge Integration)', () => {
  let adapty: Adapty;
  let nativeMock: MockNativeModule;

  beforeEach(async () => {
    adapty = new Adapty();

    nativeMock = createNativeModuleMock({
      activate: ACTIVATE_RESPONSE_SUCCESS,
      get_flow: GET_FLOW_RESPONSE,
      get_flow_for_default_audience: GET_FLOW_FOR_DEFAULT_AUDIENCE_RESPONSE,
      log_show_flow: LOG_SHOW_FLOW_RESPONSE,
    });

    await adapty.activate({ apiKey: 'test_api_key', params: { logLevel: 'error' } });
    nativeMock.handleMethodCall.mockClear();
  });

  afterEach(async () => {
    await cleanupAdapty(adapty);
    resetNativeModuleMock(nativeMock);
  });

  describe('Basic getFlow', () => {
    it('should return flow with default parameters', async () => {
      const flow = await adapty.getFlow({ placementId: 'test_placement' });

      // Verify: GetFlow.Request sent
      expectNativeCall({
        nativeModule: nativeMock,
        method: 'get_flow',
        expectedRequest: GET_FLOW_REQUEST,
      });

      // Verify: response parsed to camelCase
      expect(flow).toBeDefined();
      expect(flow.id).toBe('flow_test_placement');
      expect(flow.name).toBe('test_placement');
      expect(flow.placement.id).toBe('test_placement');
      expect(flow.variationId).toBe('variation_123');
      expect(flow.paywalls).toBeDefined();
      expect(Array.isArray(flow.paywalls)).toBe(true);
      expect(flow.paywalls.length).toBeGreaterThan(0);
    });

    it('should return different flows for different placementId', async () => {
      // Setup different response for second call
      const response2: components['requests']['GetFlow.Response'] = {
        success: {
          ...GET_FLOW_RESPONSE.success!,
          placement: {
            ...GET_FLOW_RESPONSE.success!.placement,
            developer_id: 'placement_two',
          },
          flow_id: 'flow_placement_two',
          flow_name: 'placement_two',
        },
      };

      nativeMock.handleMethodCall.mockImplementationOnce((_methodArgs: { methodName: string; args: string }) => {
        return Promise.resolve({
          crossPlatformJson: JSON.stringify(GET_FLOW_RESPONSE),
        });
      });

      nativeMock.handleMethodCall.mockImplementationOnce((_methodArgs: { methodName: string; args: string }) => {
        return Promise.resolve({
          crossPlatformJson: JSON.stringify(response2),
        });
      });

      const flow1 = await adapty.getFlow({ placementId: 'placement_one' });
      const flow2 = await adapty.getFlow({ placementId: 'placement_two' });

      // Verify: different flow_id returned from native
      expect(flow1.id).toBe('flow_test_placement');
      expect(flow2.id).toBe('flow_placement_two');
      expect(flow1.name).toBe('test_placement');
      expect(flow2.name).toBe('placement_two');
      // Verify: placement.id reflects what was returned from native (developer_id)
      expect(flow1.placement.id).toBe('test_placement');
      expect(flow2.placement.id).toBe('placement_two');
    });

    it('should return flow with correct structure', async () => {
      const flow = await adapty.getFlow({ placementId: 'structure_test' });

      // Verify: request sent with correct placement_id
      const request = extractNativeRequest<components['requests']['GetFlow.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.placement_id).toBe('structure_test');

      // Check all required fields
      expect(flow.id).toBeDefined();
      expect(flow.name).toBeDefined();
      expect(flow.variationId).toBeDefined();
      expect(flow.responseCreatedAt).toBeDefined();

      // Check placement structure
      expect(flow.placement).toBeDefined();
      expect(flow.placement.id).toBe('test_placement');
      expect(flow.placement.abTestName).toBeDefined();
      expect(flow.placement.audienceName).toBeDefined();
      expect(flow.placement.revision).toBeDefined();
      expect(flow.placement.audienceVersionId).toBeDefined();

      // Check paywalls (flow-shape)
      expect(flow.paywalls).toBeDefined();
      expect(Array.isArray(flow.paywalls)).toBe(true);
      expect(flow.paywalls.length).toBeGreaterThan(0);

      // Check productIdentifiers on the first variation
      expect(flow.paywalls[0]!.productIdentifiers).toBeDefined();
      expect(Array.isArray(flow.paywalls[0]!.productIdentifiers)).toBe(true);
      expect(flow.paywalls[0]!.productIdentifiers.length).toBeGreaterThan(0);
    });
  });

  describe('API parameters smoke-test', () => {
    it('should accept all parameters without errors', async () => {
      // Test that method accepts all parameters (fetchPolicy, loadTimeoutMs)
      const flow = await adapty.getFlow({
        placementId: 'test_placement',
        params: {
          fetchPolicy: FetchPolicy.ReturnCacheDataIfNotExpiredElseLoad,
          maxAgeSeconds: 300,
          loadTimeoutMs: 3000,
        },
      });

      // Verify: request contains parameters
      const request = extractNativeRequest<components['requests']['GetFlow.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.placement_id).toBe('test_placement');
      // load_timeout is converted from ms to seconds (3000ms -> 3s)
      expect(request.load_timeout).toBe(3);

      // Verify method didn't crash and returns valid flow
      expect(flow).toBeDefined();
      expect(flow.id).toBe('flow_test_placement');
      expect(flow.placement.id).toBe('test_placement');
    });
  });

  describe('getFlowForDefaultAudience', () => {
    it('should send GetFlowForDefaultAudience.Request', async () => {
      const flow = await adapty.getFlowForDefaultAudience({
        placementId: 'test_placement_default',
      });

      // Verify: GetFlowForDefaultAudience.Request sent
      expectNativeCall({
        nativeModule: nativeMock,
        method: 'get_flow_for_default_audience',
        expectedRequest: GET_FLOW_FOR_DEFAULT_AUDIENCE_REQUEST,
      });

      // Verify: response parsed to camelCase
      expect(flow).toBeDefined();
      expect(flow.id).toBe('flow_default_audience');
      expect(flow.name).toBe('test_placement_default');
      expect(flow.placement.id).toBe('test_placement_default');
      expect(flow.placement.audienceName).toBe('default_audience');
      expect(flow.variationId).toBe('default_variation_123');
    });
  });

  describe('logShowFlow', () => {
    it('should log flow show event after getFlow', async () => {
      const flow = await adapty.getFlow({ placementId: 'test_placement' });
      nativeMock.handleMethodCall.mockClear();

      // Should not throw
      await adapty.logShowFlow({ flow });

      // Verify: LogShowFlow.Request sent
      const request = extractNativeRequest<components['requests']['LogShowFlow.Request']>({
        nativeModule: nativeMock,
      });

      expect(request.method).toBe('log_show_flow');
      expect(request.flow.flow_id).toBe('flow_test_placement');
      expect(request.flow.variation_id).toBe('variation_123');

      // Note: result is actually `true` (from obj.success in parseMethodResult),
      // not undefined, even though TypeScript signature is Promise<void>
      // This is expected behavior for Void type responses
    });
  });

  describe('Error handling', () => {
    it('should throw on GetFlow.Response error', async () => {
      // Reset and create mock with error response for get_flow
      resetNativeModuleMock(nativeMock);
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        get_flow: GET_FLOW_RESPONSE_ERROR,
      });

      // Create new Adapty instance and activate
      adapty = new Adapty();
      await adapty.activate({ apiKey: 'test_api_key' });

      // Execute: get flow should throw with error message from response
      await expect(adapty.getFlow({ placementId: 'nonexistent_placement' })).rejects.toThrow('Flow not found');
    });
  });
});
