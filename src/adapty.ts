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
  ActivateParamsInput,
  GetPlacementParamsInput,
  GetPlacementForDefaultAudienceParamsInput,
  MakePurchaseParamsInput,
  FileLocation,
  LogLevel,
} from './shared/types/inputs';
import type { AdaptyPlugin } from './types/adapty-plugin';

export class Adapty implements AdaptyPlugin {
  activate(options: { apiKey: string; params?: ActivateParamsInput }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getPaywall(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<{ paywall: AdaptyPaywall }> {
    throw new Error('Method not implemented.');
  }

  getPaywallForDefaultAudience(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<{ paywall: AdaptyPaywall }> {
    throw new Error('Method not implemented.');
  }

  getPaywallProducts(options: { paywall: AdaptyPaywall }): Promise<{ products: AdaptyPaywallProduct[] }> {
    throw new Error('Method not implemented.');
  }

  getOnboarding(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<{ onboarding: AdaptyOnboarding }> {
    throw new Error('Method not implemented.');
  }

  getOnboardingForDefaultAudience(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<{ onboarding: AdaptyOnboarding }> {
    throw new Error('Method not implemented.');
  }

  getProfile(): Promise<{ profile: AdaptyProfile }> {
    throw new Error('Method not implemented.');
  }

  identify(options: { customerUserId: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  logShowPaywall(options: { paywall: AdaptyPaywall }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  openWebPaywall(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  createWebPaywallUrl(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<{ url: string }> {
    throw new Error('Method not implemented.');
  }

  logShowOnboarding(options: { screenOrder: number; onboardingName?: string; screenName?: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  logout(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  makePurchase(options: {
    product: AdaptyPaywallProduct;
    params?: MakePurchaseParamsInput;
  }): Promise<{ result: AdaptyPurchaseResult }> {
    throw new Error('Method not implemented.');
  }

  presentCodeRedemptionSheet(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  reportTransaction(options: { transactionId: string; variationId?: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  restorePurchases(): Promise<{ profile: AdaptyProfile }> {
    throw new Error('Method not implemented.');
  }

  setFallback(options: { fileLocation: FileLocation }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  setFallbackPaywalls(options: { paywallsLocation: FileLocation }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  setIntegrationIdentifier(options: { key: string; value: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  setLogLevel(options: { logLevel: LogLevel }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateAttribution(options: { attribution: Record<string, any>; source: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateCollectingRefundDataConsent(options: { consent: boolean }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateRefundPreference(options: { refundPreference: RefundPreference }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateProfile(options: { params: Partial<AdaptyProfileParameters> }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  isActivated(): Promise<{ isActivated: boolean }> {
    throw new Error('Method not implemented.');
  }

  addListener(
    eventName: 'onLatestProfileLoad',
    listenerFunc: (data: { profile: AdaptyProfile }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle {
    throw new Error('Method not implemented.');
  }

  removeAllListeners(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
