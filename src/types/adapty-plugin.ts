import type { PluginListenerHandle } from '@capacitor/core';

import type { LoggerConfig } from '../shared/logger';
import type {
  AdaptyPaywall,
  AdaptyPaywallProduct,
  AdaptyOnboarding,
  AdaptyProfile,
  AdaptyPurchaseResult,
  AdaptyProfileParameters,
  RefundPreference,
} from '../shared/types';
import type {
  ActivateParamsInput,
  GetPlacementParamsInput,
  GetPlacementForDefaultAudienceParamsInput,
  MakePurchaseParamsInput,
  FileLocation,
  LogLevel,
} from '../shared/types/inputs';

export interface AdaptyPlugin {
  /**
   * Initializes the Adapty SDK.
   * This method must be called in order for the SDK to work.
   */
  activate(options: { apiKey: string; params?: ActivateParamsInput }): Promise<void>;

  /**
   * Gets a paywall by placement ID.
   */
  getPaywall(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<AdaptyPaywall>;

  /**
   * Gets a paywall for default audience by placement ID.
   */
  getPaywallForDefaultAudience(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<AdaptyPaywall>;

  /**
   * Gets products for a specific paywall.
   */
  getPaywallProducts(options: { paywall: AdaptyPaywall }): Promise<AdaptyPaywallProduct[]>;

  /**
   * Gets an onboarding by placement ID.
   */
  getOnboarding(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<AdaptyOnboarding>;

  /**
   * Gets an onboarding for default audience by placement ID.
   */
  getOnboardingForDefaultAudience(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<AdaptyOnboarding>;

  /**
   * Gets the current user profile.
   */
  getProfile(): Promise<AdaptyProfile>;

  /**
   * Identifies the user with a customer user ID.
   */
  identify(options: { customerUserId: string }): Promise<void>;

  /**
   * Logs that a paywall was shown to the user.
   */
  logShowPaywall(options: { paywall: AdaptyPaywall }): Promise<void>;

  /**
   * Opens a web paywall.
   */
  openWebPaywall(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<void>;

  /**
   * Creates a URL for web paywall.
   */
  createWebPaywallUrl(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<string>;

  /**
   * Logs that an onboarding screen was shown to the user.
   */
  logShowOnboarding(options: { screenOrder: number; onboardingName?: string; screenName?: string }): Promise<void>;

  /**
   * Logs out the current user.
   */
  logout(): Promise<void>;

  /**
   * Makes a purchase of a product.
   */
  makePurchase(options: {
    product: AdaptyPaywallProduct;
    params?: MakePurchaseParamsInput;
  }): Promise<AdaptyPurchaseResult>;

  /**
   * Presents the code redemption sheet (iOS only).
   */
  presentCodeRedemptionSheet(): Promise<void>;

  /**
   * Reports a transaction to Adapty.
   */
  reportTransaction(options: { transactionId: string; variationId?: string }): Promise<void>;

  /**
   * Restores user purchases.
   */
  restorePurchases(): Promise<AdaptyProfile>;

  /**
   * Sets fallback paywalls from a file.
   */
  setFallback(options: { fileLocation: FileLocation }): Promise<void>;

  /**
   * Sets an integration identifier.
   */
  setIntegrationIdentifier(options: { key: string; value: string }): Promise<void>;

  /**
   * Sets the log level for the SDK or configures JS logger sinks.
   */
  setLogLevel(options: { logLevel?: LogLevel; logger?: LoggerConfig }): Promise<void>;

  /**
   * Updates attribution data for the current user.
   */
  updateAttribution(options: { attribution: Record<string, any>; source: string }): Promise<void>;

  /**
   * Updates collecting refund data consent (iOS only).
   */
  updateCollectingRefundDataConsent(options: { consent: boolean }): Promise<void>;

  /**
   * Updates refund preference (iOS only).
   */
  updateRefundPreference(options: { refundPreference: RefundPreference }): Promise<void>;

  /**
   * Updates the user profile.
   */
  updateProfile(options: { params: Partial<AdaptyProfileParameters> }): Promise<void>;

  /**
   * Checks if the SDK is activated.
   */
  isActivated(): Promise<boolean>;

  /**
   * Adds a listener for profile updates.
   */
  addListener(
    eventName: 'onLatestProfileLoad',
    listenerFunc: (data: { profile: AdaptyProfile }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  /**
   * Removes all listeners.
   */
  removeAllListeners(): Promise<void>;
}
