import type { AdaptyError } from '@adapty/core';
import type { PluginListenerHandle } from '@capacitor/core';

import type { LoggerConfig } from '../logger';

import type {
  AdaptyFlow,
  AdaptyFlowPaywall,
  AdaptyPaywallProduct,
  AdaptyOnboarding,
  AdaptyProfile,
  AdaptyPurchaseResult,
  AdaptyProfileParameters,
  RefundPreference,
  AdaptyInstallationStatus,
  AdaptyInstallationDetails,
  WebPresentation,
} from './index';
import type {
  ActivateParamsInput,
  GetPlacementParamsInput,
  GetPlacementForDefaultAudienceParamsInput,
  IdentifyParamsInput,
  MakePurchaseParamsInput,
  FileLocation,
  LogLevel,
} from './inputs';

export interface AdaptyPlugin {
  /**
   * Initializes the Adapty SDK.
   * This method must be called in order for the SDK to work.
   */
  activate(options: { apiKey: string; params?: ActivateParamsInput }): Promise<void>;

  /**
   * Gets a flow by placement ID.
   */
  getFlow(options: { placementId: string; params?: GetPlacementParamsInput }): Promise<AdaptyFlow>;

  /**
   * Gets a flow for default audience by placement ID.
   */
  getFlowForDefaultAudience(options: {
    placementId: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<AdaptyFlow>;

  /**
   * Gets products for a specific flow.
   */
  getPaywallProducts(options: { flow: AdaptyFlow }): Promise<AdaptyPaywallProduct[]>;

  /**
   * Gets an onboarding by placement ID.
   *
   * @deprecated Since 4.0.0. Migrate onboardings to the Flow Builder API.
   */
  getOnboarding(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<AdaptyOnboarding>;

  /**
   * Gets an onboarding for default audience by placement ID.
   *
   * @deprecated Since 4.0.0. Migrate onboardings to the Flow Builder API.
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
  identify(options: { customerUserId: string; params?: IdentifyParamsInput }): Promise<void>;

  /**
   * Logs that a flow was shown to the user.
   */
  logShowFlow(options: { flow: AdaptyFlow }): Promise<void>;

  /**
   * Opens a web paywall.
   */
  openWebPaywall(options: {
    paywallOrProduct: AdaptyFlowPaywall | AdaptyPaywallProduct;
    openIn?: WebPresentation;
  }): Promise<void>;

  /**
   * Creates a URL for web paywall.
   */
  createWebPaywallUrl(options: { paywallOrProduct: AdaptyFlowPaywall | AdaptyPaywallProduct }): Promise<string>;

  /**
   * Opens a URL using the native browser.
   */
  openWebUrl(options: { url: string; openIn?: WebPresentation }): Promise<void>;

  /**
   * Requests the native app-review prompt.
   */
  requestAppReview(): Promise<void>;

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
  updateProfile(options: Partial<AdaptyProfileParameters>): Promise<void>;

  /**
   * Checks if the SDK is activated.
   */
  isActivated(): Promise<boolean>;

  /**
   * Gets the current installation status.
   */
  getCurrentInstallationStatus(): Promise<AdaptyInstallationStatus>;

  /**
   * Adds a strongly-typed event listener.
   *
   * Supported events:
   * - onLatestProfileLoad → { profile: AdaptyProfile }
   * - onInstallationDetailsSuccess → { details: AdaptyInstallationDetails }
   * - onInstallationDetailsFail → { error: AdaptyError }
   */
  addListener: AddListenerFn;

  /**
   * Removes all listeners.
   */
  removeAllListeners(): Promise<void>;
}

/**
 * Supported event names.
 */
export type AdaptyEventName = 'onLatestProfileLoad' | 'onInstallationDetailsSuccess' | 'onInstallationDetailsFail';

/**
 * Mapping between event names and their payload types.
 */
export type EventPayloadMap = {
  onLatestProfileLoad: { profile: AdaptyProfile };
  onInstallationDetailsSuccess: { details: AdaptyInstallationDetails };
  onInstallationDetailsFail: { error: AdaptyError };
};

/**
 * Strongly-typed event listener function using mapped types.
 */
export type AddListenerFn = <T extends keyof EventPayloadMap>(
  eventName: T,
  listenerFunc: (data: EventPayloadMap[T]) => void,
) => Promise<PluginListenerHandle>;
