import type { PluginListenerHandle } from '@capacitor/core';

import type {
  AdaptyPaywall,
  AdaptyPaywallProduct,
  AdaptyOnboarding,
  AdaptyProfile,
  AdaptyPurchaseResult,
  AdaptyProfileParameters,
  RefundPreference,
} from './shared/types';
import type {
  GetPlacementParamsInput,
  GetPlacementForDefaultAudienceParamsInput,
  MakePurchaseParamsInput,
  FileLocation,
  LogLevel,
} from './shared/types/inputs';

export interface AdaptyCapacitorPluginPlugin {
  /**
   * Initializes the Adapty SDK
   */
  activate(options: { apiKey: string; params?: any }): Promise<void>;

  /**
   * Fetches the paywall by the specified placement
   */
  getPaywall(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<{ paywall: AdaptyPaywall }>;

  /**
   * Fetches the paywall for the default audience
   */
  getPaywallForDefaultAudience(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<{ paywall: AdaptyPaywall }>;

  /**
   * Fetches products for a paywall
   */
  getPaywallProducts(options: { paywall: AdaptyPaywall }): Promise<{ products: AdaptyPaywallProduct[] }>;

  /**
   * Fetches an onboarding by the specified placement
   */
  getOnboarding(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<{ onboarding: AdaptyOnboarding }>;

  /**
   * Fetches an onboarding for the default audience
   */
  getOnboardingForDefaultAudience(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<{ onboarding: AdaptyOnboarding }>;

  /**
   * Fetches user profile
   */
  getProfile(): Promise<{ profile: AdaptyProfile }>;

  /**
   * Identifies user with customer ID
   */
  identify(options: { customerUserId: string }): Promise<void>;

  /**
   * Logs paywall view event
   */
  logShowPaywall(options: { paywall: AdaptyPaywall }): Promise<void>;

  /**
   * Opens web paywall
   */
  openWebPaywall(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<void>;

  /**
   * Creates web paywall URL
   */
  createWebPaywallUrl(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<{ url: string }>;

  /**
   * Logs onboarding view event
   */
  logShowOnboarding(options: { screenOrder: number; onboardingName?: string; screenName?: string }): Promise<void>;

  /**
   * Logs out current user
   */
  logout(): Promise<void>;

  /**
   * Makes a purchase
   */
  makePurchase(options: {
    product: AdaptyPaywallProduct;
    params?: MakePurchaseParamsInput;
  }): Promise<{ result: AdaptyPurchaseResult }>;

  /**
   * Presents code redemption sheet (iOS only)
   */
  presentCodeRedemptionSheet(): Promise<void>;

  /**
   * Reports transaction
   */
  reportTransaction(options: { transactionId: string; variationId?: string }): Promise<void>;

  /**
   * Restores purchases
   */
  restorePurchases(): Promise<{ profile: AdaptyProfile }>;

  /**
   * Sets fallback placements
   */
  setFallback(options: { fileLocation: FileLocation }): Promise<void>;

  /**
   * Sets fallback paywalls (deprecated)
   */
  setFallbackPaywalls(options: { paywallsLocation: FileLocation }): Promise<void>;

  /**
   * Sets integration identifier
   */
  setIntegrationIdentifier(options: { key: string; value: string }): Promise<void>;

  /**
   * Sets log level
   */
  setLogLevel(options: { logLevel: LogLevel }): Promise<void>;

  /**
   * Updates attribution data
   */
  updateAttribution(options: { attribution: Record<string, any>; source: string }): Promise<void>;

  /**
   * Updates collecting refund data consent (iOS only)
   */
  updateCollectingRefundDataConsent(options: { consent: boolean }): Promise<void>;

  /**
   * Updates refund preference (iOS only)
   */
  updateRefundPreference(options: { refundPreference: RefundPreference }): Promise<void>;

  /**
   * Updates user profile
   */
  updateProfile(options: { params: Partial<AdaptyProfileParameters> }): Promise<void>;

  /**
   * Checks if SDK is activated
   */
  isActivated(): Promise<{ isActivated: boolean }>;

  /**
   * Adds event listener
   */
  addListener(
    eventName: 'onLatestProfileLoad',
    listenerFunc: (data: { profile: AdaptyProfile }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  /**
   * Removes all event listeners
   */
  removeAllListeners(): Promise<void>;
}
