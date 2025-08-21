import { AdaptyOnboardingCoder } from './shared/coders/adapty-onboarding';
import { AdaptyPaywallCoder } from './shared/coders/adapty-paywall';
import { AdaptyPaywallProductCoder } from './shared/coders/adapty-paywall-product';
import { AdaptyProfileCoder } from './shared/coders/adapty-profile';
import { AdaptyPurchaseResultCoder } from './shared/coders/adapty-purchase-result';
import { AdaptyInstallationStatusCoder } from './shared/coders/adapty-installation-status';
import { createArrayCoder } from './shared/coders/array';
import type { AdaptyPaywallProduct } from './shared/types';
import type { MethodName } from './shared/types/method-types';

// Coder registry for different method responses
const coderRegistry = {
  get_profile: AdaptyProfileCoder,
  restore_purchases: AdaptyProfileCoder,
  get_paywall: AdaptyPaywallCoder,
  get_paywall_for_default_audience: AdaptyPaywallCoder,
  get_paywall_products: createArrayCoder<AdaptyPaywallProduct, AdaptyPaywallProductCoder>(AdaptyPaywallProductCoder),
  get_onboarding: AdaptyOnboardingCoder,
  get_onboarding_for_default_audience: AdaptyOnboardingCoder,
  make_purchase: AdaptyPurchaseResultCoder,
  get_current_installation_status: AdaptyInstallationStatusCoder,
} as const;

export function getCoder(method: MethodName): InstanceType<(typeof coderRegistry)[keyof typeof coderRegistry]> | null {
  const CoderClass = coderRegistry[method as keyof typeof coderRegistry];
  if (!CoderClass) return null;

  return new CoderClass();
}
