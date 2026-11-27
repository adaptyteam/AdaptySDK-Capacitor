/**
 * Paywall Products Integration Tests
 *
 * Tests product fetching and parsing:
 * - GetPaywallProducts.Request format (flow encoded in snake_case)
 * - Response parsing to camelCase
 * - variationId extraction from flow
 */

import { AdaptyError } from '@adapty/core';
import { Capacitor } from '@capacitor/core';
import { Adapty } from 'adapty';
import type { AdaptyFlow } from 'types';
import type { components } from 'types/api';

import {
  ACTIVATE_RESPONSE_SUCCESS,
  GET_PAYWALL_PRODUCTS_RESPONSE,
  GET_PAYWALL_PRODUCTS_RESPONSE_ERROR,
} from '../shared/bridge-samples';
import {
  createNativeModuleMock,
  extractNativeRequest,
  resetNativeModuleMock,
  type MockNativeModule,
} from '../shared/native-module-mock.utils';

import { cleanupAdapty } from './setup.utils';

describe('Adapty - Paywall Products', () => {
  let nativeMock: MockNativeModule;
  let adapty: Adapty;

  beforeEach(() => {
    // Create native module mock with responses
    nativeMock = createNativeModuleMock({
      activate: ACTIVATE_RESPONSE_SUCCESS,
      get_paywall_products: GET_PAYWALL_PRODUCTS_RESPONSE,
    });

    // Create SDK instance
    adapty = new Adapty();
  });

  afterEach(async () => {
    await cleanupAdapty(adapty);
    resetNativeModuleMock(nativeMock);
  });

  describe('GetPaywallProducts request and response', () => {
    it('should encode flow in snake_case and parse products to camelCase', async () => {
      // Activate SDK
      await adapty.activate({ apiKey: 'test_api_key' });

      // Create flow with camelCase fields
      const placement = {
        id: 'test_placement',
        abTestName: 'test_ab',
        audienceName: 'all_users',
        revision: 1,
        audienceVersionId: 'v1',
      };
      const flow: AdaptyFlow = {
        id: 'test_flow_id',
        name: 'Test Flow',
        variationId: 'test_variation_123',
        hasViewConfiguration: false,
        placement,
        responseCreatedAt: 1704067200000,
        paywalls: [
          {
            placement,
            id: 'test_paywall_id',
            name: 'Test Paywall',
            variationId: 'test_variation_123',
            productIdentifiers: [
              {
                vendorProductId: 'com.example.monthly',
                adaptyProductId: 'monthly_id',
              },
            ],
            // Note: 'products' is not on the public AdaptyFlowPaywall type, but kept at
            // runtime for coder.encode(flow) — assertion hides excess property from TS
            products: [
              {
                vendorId: 'com.example.monthly',
                adaptyId: 'monthly_id',
                accessLevelId: 'premium',
                productType: 'subscription',
              },
            ],
          } as AdaptyFlow['paywalls'][number],
        ],
      };

      // Get paywall products
      const products = await adapty.getPaywallProducts({ flow });

      // Verify GetPaywallProducts.Request sent with snake_case flow
      const request = extractNativeRequest<components['requests']['GetPaywallProducts.Request']>({
        nativeModule: nativeMock,
        callIndex: 1,
      }); // Call index 1 (after activate)

      expect(request.method).toBe('get_paywall_products');
      expect(request.flow).toMatchObject({
        flow_id: 'test_flow_id',
        flow_name: 'Test Flow',
        variation_id: 'test_variation_123',
        placement: {
          developer_id: 'test_placement', // id → developer_id
          ab_test_name: 'test_ab',
          audience_name: 'all_users',
          placement_audience_version_id: 'v1', // audienceVersionId → placement_audience_version_id
        },
      });

      // Verify products parsed from response (snake_case → camelCase)
      expect(products).toBeDefined();
      expect(products.length).toBe(1);
      expect(products[0]).toMatchObject({
        vendorProductId: 'com.example.monthly',
        adaptyId: 'monthly_id',
        accessLevelId: 'premium',
        productType: 'subscription',
        paywallProductIndex: 0,
        variationId: 'test_variation_123', // extracted from paywall_variation_id
        paywallABTestName: 'test_ab',
        paywallName: 'Test Flow', // from GET_PAYWALL_PRODUCTS_RESPONSE sample
        localizedDescription: 'Monthly Premium Subscription',
        localizedTitle: 'Premium Monthly',
        price: {
          amount: 9.99,
          currencyCode: 'USD',
          currencySymbol: '$',
          localizedString: '$9.99',
        },
      });
    });
  });

  describe('Error handling', () => {
    it('should throw on GetPaywallProducts.Response error', async () => {
      // Reset and create mock with error response for get_paywall_products
      resetNativeModuleMock(nativeMock);
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        get_paywall_products: GET_PAYWALL_PRODUCTS_RESPONSE_ERROR,
      });

      // Create new Adapty instance and activate SDK
      adapty = new Adapty();
      await adapty.activate({ apiKey: 'test_api_key' });

      // Create minimal flow for the request
      const placement = {
        id: 'test_placement',
        abTestName: 'test_ab',
        audienceName: 'all_users',
        revision: 1,
        audienceVersionId: 'v1',
      };
      const flow: AdaptyFlow = {
        id: 'test_flow_id',
        name: 'Test Flow',
        variationId: 'test_variation_123',
        hasViewConfiguration: false,
        placement,
        responseCreatedAt: 1704067200000,
        paywalls: [
          {
            placement,
            id: 'test_paywall_id',
            name: 'Test Paywall',
            variationId: 'test_variation_123',
            productIdentifiers: [],
            // `products` kept at runtime for coder.encode(flow) — assertion hides excess property from TS
            products: [],
          } as AdaptyFlow['paywalls'][number],
        ],
      };

      // Execute: get paywall products should throw with error message
      await expect(adapty.getPaywallProducts({ flow })).rejects.toThrow('Products not found');
    });

    // Core 4.4.0 requires both fields and treats null as missing
    it.each([
      { field: 'currency_code', modelField: 'currencyCode', mode: 'missing' },
      { field: 'currency_code', modelField: 'currencyCode', mode: 'null' },
      { field: 'localized_string', modelField: 'localizedString', mode: 'missing' },
      { field: 'localized_string', modelField: 'localizedString', mode: 'null' },
    ] as const)('should reject a product whose price $field is $mode', async ({ field, modelField, mode }) => {
      const response = GET_PAYWALL_PRODUCTS_RESPONSE as {
        success: components['defs']['AdaptyPaywallProduct.Response'][];
      };
      const product = response.success[0]!;
      const price: Record<string, unknown> = { ...product.price };
      if (mode === 'missing') {
        delete price[field];
      } else {
        price[field] = null;
      }

      resetNativeModuleMock(nativeMock);
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        get_paywall_products: {
          success: [{ ...product, price }],
        } as components['requests']['GetPaywallProducts.Response'],
      });
      adapty = new Adapty();
      await adapty.activate({ apiKey: 'test_api_key' });

      const placement = {
        id: 'test_placement',
        abTestName: 'test_ab',
        audienceName: 'all_users',
        revision: 1,
        audienceVersionId: 'v1',
      };
      const flow: AdaptyFlow = {
        id: 'test_flow_id',
        name: 'Test Flow',
        variationId: 'test_variation_123',
        hasViewConfiguration: false,
        placement,
        responseCreatedAt: 1704067200000,
        paywalls: [
          {
            placement,
            id: 'test_paywall_id',
            name: 'Test Paywall',
            variationId: 'test_variation_123',
            productIdentifiers: [],
            products: [],
          } as AdaptyFlow['paywalls'][number],
        ],
      };

      const error = await adapty.getPaywallProducts({ flow }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AdaptyError);
      expect(error).toMatchObject({
        adaptyCode: 2006,
        codeName: 'decodingFailed',
        message: expect.stringContaining(`"${modelField}"`),
      });
    });
  });

  describe('Android subscription decoding', () => {
    const originalGetPlatform = Capacitor.getPlatform;

    const androidProduct: components['defs']['AdaptyPaywallProduct.Response'] = {
      vendor_product_id: 'com.example.yearly',
      adapty_product_id: 'yearly_id',
      access_level_id: 'premium',
      product_type: 'subscription',
      paywall_product_index: 0,
      paywall_variation_id: 'test_variation_123',
      paywall_ab_test_name: 'test_ab',
      paywall_name: 'Test Flow',
      localized_description: 'Yearly Premium Subscription',
      localized_title: 'Premium Yearly',
      price: {
        amount: 59.99,
        currency_code: 'USD',
        localized_string: '$59.99',
      },
      subscription: {
        base_plan_id: 'yearly-base',
        renewal_type: 'autorenewable',
        period: { unit: 'year', number_of_units: 1 },
      },
    };

    const placement = {
      id: 'test_placement',
      abTestName: 'test_ab',
      audienceName: 'all_users',
      revision: 1,
      audienceVersionId: 'v1',
    };
    const flow: AdaptyFlow = {
      id: 'test_flow_id',
      name: 'Test Flow',
      variationId: 'test_variation_123',
      hasViewConfiguration: false,
      placement,
      responseCreatedAt: 1704067200000,
      paywalls: [
        {
          placement,
          id: 'test_paywall_id',
          name: 'Test Paywall',
          variationId: 'test_variation_123',
          productIdentifiers: [],
          // `products` kept at runtime for coder.encode(flow) — assertion hides excess property from TS
          products: [],
        } as AdaptyFlow['paywalls'][number],
      ],
    };

    async function getProducts(response: components['requests']['GetPaywallProducts.Response']) {
      resetNativeModuleMock(nativeMock);
      nativeMock = createNativeModuleMock({
        activate: ACTIVATE_RESPONSE_SUCCESS,
        get_paywall_products: response,
      });
      adapty = new Adapty();
      await adapty.activate({ apiKey: 'test_api_key' });
      return adapty.getPaywallProducts({ flow });
    }

    beforeEach(() => {
      Capacitor.getPlatform = jest.fn(() => 'android');
    });

    afterEach(() => {
      Capacitor.getPlatform = originalGetPlatform;
    });

    it('should decode base_plan_id into subscription.android', async () => {
      const products = await getProducts({ success: [androidProduct] });

      expect(products[0]?.subscription?.android).toEqual({
        basePlanId: 'yearly-base',
        renewalType: 'autorenewable',
      });
    });

    it('should reject products whose Android subscription lacks base_plan_id', async () => {
      const { base_plan_id: _basePlanId, ...subscription } = androidProduct.subscription!;

      // The message pins the cause: on iOS the same product fails on other fields
      await expect(getProducts({ success: [{ ...androidProduct, subscription }] })).rejects.toMatchObject({
        adaptyCode: 2006,
        message: expect.stringContaining('basePlanId'),
      });
    });
  });
});
