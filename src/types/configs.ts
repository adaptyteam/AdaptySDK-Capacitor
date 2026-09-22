import type { AdaptyPaywallProduct, AdaptyPromotedProduct } from './index';
import type {
  GetPlacementParamsInput,
  GetPlacementForDefaultAudienceParamsInput,
  MakePurchaseParamsInput,
  PreloadPlacementsParamsInput,
} from './inputs';

/**
 * Describes the options for the `getFlow` method.
 * @public
 */
export interface GetFlowOptions {
  placementId: string;
  params?: GetPlacementParamsInput;
}

/**
 * Describes the options for the `getFlowForDefaultAudience` method.
 * @public
 */
export interface GetFlowForDefaultAudienceOptions {
  placementId: string;
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
  params?: GetPlacementForDefaultAudienceParamsInput;
}

/**
 * Describes the options for the `preloadFlows` method.
 * @public
 */
export interface PreloadFlowsOptions {
  placementIds: string[];
  params?: PreloadPlacementsParamsInput;
}

/**
 * Describes the options for the `preloadFlowsForDefaultAudience` method.
 *
 * @remarks
 * The request carries no timeout — unlike {@link PreloadFlowsOptions} there is
 * nothing to configure beyond the placements.
 * @public
 */
export interface PreloadFlowsForDefaultAudienceOptions {
  placementIds: string[];
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
 * Describes the options for the `makePromotedPurchase` method.
 *
 * @remarks
 * A promoted product carries no paywall context, so unlike
 * {@link MakePurchaseOptions} there are no purchase parameters.
 * @public
 */
export interface MakePromotedPurchaseOptions {
  product: AdaptyPromotedProduct;
}

/**
 * Describes the options for the Adapty constructor.
 * @public
 */
export interface AdaptyDefaultOptions {
  /**
   * Default options for the `getFlow` method.
   */
  get_flow: {
    params: Required<GetPlacementParamsInput>;
  };
  /**
   * Default options for the `getFlowForDefaultAudience` method.
   */
  get_flow_for_default_audience: {
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
   */
  get_onboarding_for_default_audience: {
    params: GetPlacementForDefaultAudienceParamsInput;
  };
  /**
   * Default options for the `preloadFlows` method.
   */
  preload_flows: {
    params: Required<PreloadPlacementsParamsInput>;
  };
}

/**
 * Merged type that combines GetFlowOptions with required params from AdaptyDefaultOptions
 * @public
 */
export type GetFlowOptionsWithDefaults = AdaptyDefaultOptions['get_flow'] & GetFlowOptions;

/**
 * Merged type that combines GetFlowForDefaultAudienceOptions with required params from AdaptyDefaultOptions
 * @public
 */
export type GetFlowForDefaultAudienceOptionsWithDefaults = AdaptyDefaultOptions['get_flow_for_default_audience'] &
  GetFlowForDefaultAudienceOptions;

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

/**
 * Merged type for `preloadFlows` with defaults
 * @public
 */
export type PreloadFlowsOptionsWithDefaults = AdaptyDefaultOptions['preload_flows'] & PreloadFlowsOptions;
