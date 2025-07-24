import type { GetPlacementParamsInput, GetPlacementForDefaultAudienceParamsInput } from '../shared/types/inputs';

/**
 * Describes the options for the `getPaywall` method.
 * @public
 */
export interface GetPaywallOptions {
  placementId: string;
  locale?: string;
  params?: GetPlacementParamsInput;
}

/**
 * Describes the options for the `getPaywallForDefaultAudience` method.
 * @public
 */
export interface GetPaywallForDefaultAudienceOptions {
  placementId: string;
  locale?: string;
  params?: GetPlacementForDefaultAudienceParamsInput;
}

/**
 * Describes the options for the Adapty constructor.
 * @public
 */
export interface AdaptyDefaultOptions {
  /**
   * Default options for the `getPaywall` method.
   */
  get_paywall: {
    params: Required<GetPlacementParamsInput>;
  };
  /**
   * Default options for the `getPaywallForDefaultAudience` method.
   */
  get_paywall_for_default_audience: {
    params: GetPlacementForDefaultAudienceParamsInput;
  };
}

/**
 * Merged type that combines GetPaywallOptions with required params from AdaptyDefaultOptions
 * @public
 */
export type GetPaywallOptionsWithDefaults = AdaptyDefaultOptions['get_paywall'] & GetPaywallOptions;

/**
 * Merged type that combines GetPaywallForDefaultAudienceOptions with required params from AdaptyDefaultOptions
 * @public
 */
export type GetPaywallForDefaultAudienceOptionsWithDefaults = AdaptyDefaultOptions['get_paywall_for_default_audience'] &
  GetPaywallForDefaultAudienceOptions;
