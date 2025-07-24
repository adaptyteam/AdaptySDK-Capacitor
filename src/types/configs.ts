import type { GetPlacementParamsInput } from '../shared/types/inputs';

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
 * Describes the options for the Adapty constructor.
 * @public
 */
export interface AdaptyDefaultOptions {
  /**
   * Default options for the `getPaywall` method.
   */
  get_paywall: Pick<GetPaywallOptions, 'params'>;
}
