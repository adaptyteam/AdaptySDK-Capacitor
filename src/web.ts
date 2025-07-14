import { WebPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

import type { AdaptyCapacitorPluginPlugin } from './definitions';
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

export class AdaptyCapacitorPluginWeb extends WebPlugin implements AdaptyCapacitorPluginPlugin {
  async handleMethodCall(options: { methodName: string; args: string }): Promise<any> {
    console.log('Web: handleMethodCall called with:', options);
    throw new Error('Web platform is not supported');
  }

  async getPaywall(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<AdaptyPaywall> {
    console.log('Web: getPaywall called with:', options);
    throw new Error('Method not implemented on web platform');
  }

  async getPaywallForDefaultAudience(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<AdaptyPaywall> {
    console.log('Web: getPaywallForDefaultAudience called with:', options);
    throw new Error('Web platform is not supported');
  }

  async getPaywallProducts(options: { paywall: AdaptyPaywall }): Promise<AdaptyPaywallProduct[]> {
    console.log('Web: getPaywallProducts called with:', options);
    throw new Error('Web platform is not supported');
  }

  async getOnboarding(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<AdaptyOnboarding> {
    console.log('Web: getOnboarding called with:', options);
    throw new Error('Web platform is not supported');
  }

  async getOnboardingForDefaultAudience(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<AdaptyOnboarding> {
    console.log('Web: getOnboardingForDefaultAudience called with:', options);
    throw new Error('Web platform is not supported');
  }

  async getProfile(): Promise<AdaptyProfile> {
    console.log('Web: getProfile called');
    throw new Error('Web platform is not supported');
  }

  async identify(options: { customerUserId: string }): Promise<void> {
    console.log('Web: identify called with:', options);
    throw new Error('Web platform is not supported');
  }

  async logShowPaywall(options: { paywall: AdaptyPaywall }): Promise<void> {
    console.log('Web: logShowPaywall called with:', options);
    throw new Error('Web platform is not supported');
  }

  async openWebPaywall(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<void> {
    console.log('Web: openWebPaywall called with:', options);
    throw new Error('Web platform is not supported');
  }

  async createWebPaywallUrl(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<string> {
    console.log('Web: createWebPaywallUrl called with:', options);
    throw new Error('Web platform is not supported');
  }

  async logShowOnboarding(options: {
    screenOrder: number;
    onboardingName?: string;
    screenName?: string;
  }): Promise<void> {
    console.log('Web: logShowOnboarding called with:', options);
    throw new Error('Web platform is not supported');
  }

  async logout(): Promise<void> {
    console.log('Web: logout called');
    throw new Error('Web platform is not supported');
  }

  async makePurchase(options: {
    product: AdaptyPaywallProduct;
    params?: MakePurchaseParamsInput;
  }): Promise<AdaptyPurchaseResult> {
    console.log('Web: makePurchase called with:', options);
    throw new Error('Web platform is not supported');
  }

  async presentCodeRedemptionSheet(): Promise<void> {
    console.log('Web: presentCodeRedemptionSheet called');
    throw new Error('Web platform is not supported');
  }

  async reportTransaction(options: { transactionId: string; variationId?: string }): Promise<void> {
    console.log('Web: reportTransaction called with:', options);
    throw new Error('Web platform is not supported');
  }

  async restorePurchases(): Promise<AdaptyProfile> {
    console.log('Web: restorePurchases called');
    throw new Error('Web platform is not supported');
  }

  async setFallback(options: { fileLocation: FileLocation }): Promise<void> {
    console.log('Web: setFallback called with:', options);
    throw new Error('Web platform is not supported');
  }

  async setFallbackPaywalls(options: { paywallsLocation: FileLocation }): Promise<void> {
    console.log('Web: setFallbackPaywalls called with:', options);
    throw new Error('Web platform is not supported');
  }

  async setIntegrationIdentifier(options: { key: string; value: string }): Promise<void> {
    console.log('Web: setIntegrationIdentifier called with:', options);
    throw new Error('Web platform is not supported');
  }

  async setLogLevel(options: { logLevel: LogLevel }): Promise<void> {
    console.log('Web: setLogLevel called with:', options);
    throw new Error('Web platform is not supported');
  }

  async updateAttribution(options: { attribution: Record<string, any>; source: string }): Promise<void> {
    console.log('Web: updateAttribution called with:', options);
    throw new Error('Web platform is not supported');
  }

  async updateCollectingRefundDataConsent(options: { consent: boolean }): Promise<void> {
    console.log('Web: updateCollectingRefundDataConsent called with:', options);
    throw new Error('Web platform is not supported');
  }

  async updateRefundPreference(options: { refundPreference: RefundPreference }): Promise<void> {
    console.log('Web: updateRefundPreference called with:', options);
    throw new Error('Web platform is not supported');
  }

  async updateProfile(options: { params: Partial<AdaptyProfileParameters> }): Promise<void> {
    console.log('Web: updateProfile called with:', options);
    throw new Error('Web platform is not supported');
  }

  async isActivated(): Promise<boolean> {
    console.log('Web: isActivated called');
    throw new Error('Web platform is not supported');
  }

  addListener(
    eventName: 'onLatestProfileLoad',
    _listenerFunc: (data: { profile: AdaptyProfile }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle {
    console.log('Web: addListener called with:', eventName);
    const handle = {
      remove: async () => {
        console.log('Web: listener removed');
      },
    };
    const promise = Promise.resolve(handle);
    return Object.assign(promise, handle);
  }

  async removeAllListeners(): Promise<void> {
    console.log('Web: removeAllListeners called');
    throw new Error('Web platform is not supported');
  }
}
