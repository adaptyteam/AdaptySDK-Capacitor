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
  activate(_options: { apiKey: string; params?: ActivateParamsInput }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getPaywall(_options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<{ paywall: AdaptyPaywall }> {
    throw new Error('Method not implemented.');
  }

  getPaywallForDefaultAudience(_options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<{ paywall: AdaptyPaywall }> {
    throw new Error('Method not implemented.');
  }

  getPaywallProducts(_options: { paywall: AdaptyPaywall }): Promise<{ products: AdaptyPaywallProduct[] }> {
    throw new Error('Method not implemented.');
  }

  getOnboarding(_options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<{ onboarding: AdaptyOnboarding }> {
    throw new Error('Method not implemented.');
  }

  getOnboardingForDefaultAudience(_options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<{ onboarding: AdaptyOnboarding }> {
    throw new Error('Method not implemented.');
  }

  getProfile(): Promise<{ profile: AdaptyProfile }> {
    throw new Error('Method not implemented.');
  }

  identify(_options: { customerUserId: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  logShowPaywall(_options: { paywall: AdaptyPaywall }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  openWebPaywall(_options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  createWebPaywallUrl(_options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<{ url: string }> {
    throw new Error('Method not implemented.');
  }

  logShowOnboarding(_options: { screenOrder: number; onboardingName?: string; screenName?: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  logout(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  makePurchase(_options: {
    product: AdaptyPaywallProduct;
    params?: MakePurchaseParamsInput;
  }): Promise<{ result: AdaptyPurchaseResult }> {
    throw new Error('Method not implemented.');
  }

  presentCodeRedemptionSheet(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  reportTransaction(_options: { transactionId: string; variationId?: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  restorePurchases(): Promise<{ profile: AdaptyProfile }> {
    throw new Error('Method not implemented.');
  }

  setFallback(_options: { fileLocation: FileLocation }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  setFallbackPaywalls(_options: { paywallsLocation: FileLocation }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  setIntegrationIdentifier(_options: { key: string; value: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  setLogLevel(_options: { logLevel: LogLevel }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateAttribution(_options: { attribution: Record<string, any>; source: string }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateCollectingRefundDataConsent(_options: { consent: boolean }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateRefundPreference(_options: { refundPreference: RefundPreference }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  updateProfile(_options: { params: Partial<AdaptyProfileParameters> }): Promise<void> {
    throw new Error('Method not implemented.');
  }

  isActivated(): Promise<{ isActivated: boolean }> {
    throw new Error('Method not implemented.');
  }

  addListener(
    _eventName: 'onLatestProfileLoad',
    _listenerFunc: (data: { profile: AdaptyProfile }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle {
    throw new Error('Method not implemented.');
  }

  removeAllListeners(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
