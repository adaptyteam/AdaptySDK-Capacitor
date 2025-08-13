import type { AdaptyPaywallProduct } from '../shared/types';
import type {
  GetPlacementParamsInput,
  GetPlacementForDefaultAudienceParamsInput,
  MakePurchaseParamsInput,
} from '../shared/types/inputs';

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
 * Describes the options for the `getOnboarding` method.
 * @public
 */
export interface GetOnboardingOptions {
  placementId: string;
  locale?: string;
  params?: GetPlacementParamsInput;
}

/**
 * Describes the options for the `getOnboardingForDefaultAudience` method.
 * @public
 */
export interface GetOnboardingForDefaultAudienceOptions {
  placementId: string;
  locale?: string;
  // Keep same input shape as RN: allow loadTimeoutMs even though it is not used by schema
  params?: GetPlacementParamsInput;
}

/**
 * Describes the options for the `makePurchase` method.
 * @public
 */
export interface MakePurchaseOptions {
  product: AdaptyPaywallProduct;
  params?: MakePurchaseParamsInput;
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
  /**
   * Default options for the `getOnboarding` method.
   */
  get_onboarding: {
    params: Required<GetPlacementParamsInput>;
  };
  /**
   * Default options for the `getOnboardingForDefaultAudience` method.
   * Keep parity with RN by using `GetPlacementParamsInput`.
   */
  get_onboarding_for_default_audience: {
    params: GetPlacementParamsInput;
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

/**
 * Merged type for `getOnboarding` with defaults
 * @public
 */
export type GetOnboardingOptionsWithDefaults = AdaptyDefaultOptions['get_onboarding'] & GetOnboardingOptions;

/**
 * Merged type for `getOnboardingForDefaultAudience` with defaults
 * @public
 */
export type GetOnboardingForDefaultAudienceOptionsWithDefaults =
  AdaptyDefaultOptions['get_onboarding_for_default_audience'] & GetOnboardingForDefaultAudienceOptions;
