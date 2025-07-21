import { WebPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

import type { AdaptyCapacitorPlugin } from './definitions';
import type { AdaptyProfile } from './shared/types';

export class AdaptyCapacitorPluginWeb extends WebPlugin implements AdaptyCapacitorPlugin {
  private unsupported(): never {
    throw this.unimplemented('[Adapty] Web platform is not supported');
  }

  // One-line delegates to `unsupported`, keep signatures via type assertion
  handleMethodCall = this.unsupported as unknown as AdaptyCapacitorPlugin['handleMethodCall'];
  getPaywall = this.unsupported as unknown as AdaptyCapacitorPlugin['getPaywall'];
  getPaywallForDefaultAudience = this.unsupported as unknown as AdaptyCapacitorPlugin['getPaywallForDefaultAudience'];
  getPaywallProducts = this.unsupported as unknown as AdaptyCapacitorPlugin['getPaywallProducts'];
  getOnboarding = this.unsupported as unknown as AdaptyCapacitorPlugin['getOnboarding'];
  getOnboardingForDefaultAudience = this
    .unsupported as unknown as AdaptyCapacitorPlugin['getOnboardingForDefaultAudience'];
  getProfile = this.unsupported as unknown as AdaptyCapacitorPlugin['getProfile'];
  identify = this.unsupported as unknown as AdaptyCapacitorPlugin['identify'];
  logShowPaywall = this.unsupported as unknown as AdaptyCapacitorPlugin['logShowPaywall'];
  openWebPaywall = this.unsupported as unknown as AdaptyCapacitorPlugin['openWebPaywall'];
  createWebPaywallUrl = this.unsupported as unknown as AdaptyCapacitorPlugin['createWebPaywallUrl'];
  logShowOnboarding = this.unsupported as unknown as AdaptyCapacitorPlugin['logShowOnboarding'];
  logout = this.unsupported as unknown as AdaptyCapacitorPlugin['logout'];
  makePurchase = this.unsupported as unknown as AdaptyCapacitorPlugin['makePurchase'];
  presentCodeRedemptionSheet = this.unsupported as unknown as AdaptyCapacitorPlugin['presentCodeRedemptionSheet'];
  reportTransaction = this.unsupported as unknown as AdaptyCapacitorPlugin['reportTransaction'];
  restorePurchases = this.unsupported as unknown as AdaptyCapacitorPlugin['restorePurchases'];
  setFallback = this.unsupported as unknown as AdaptyCapacitorPlugin['setFallback'];
  setFallbackPaywalls = this.unsupported as unknown as AdaptyCapacitorPlugin['setFallbackPaywalls'];
  setIntegrationIdentifier = this.unsupported as unknown as AdaptyCapacitorPlugin['setIntegrationIdentifier'];
  setLogLevel = this.unsupported as unknown as AdaptyCapacitorPlugin['setLogLevel'];
  updateAttribution = this.unsupported as unknown as AdaptyCapacitorPlugin['updateAttribution'];
  updateCollectingRefundDataConsent = this
    .unsupported as unknown as AdaptyCapacitorPlugin['updateCollectingRefundDataConsent'];
  updateRefundPreference = this.unsupported as unknown as AdaptyCapacitorPlugin['updateRefundPreference'];
  updateProfile = this.unsupported as unknown as AdaptyCapacitorPlugin['updateProfile'];

  override addListener(
    eventName: 'onLatestProfileLoad',
    listenerFunc: (data: { profile: AdaptyProfile }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle {
    // Delegate to WebPlugin.base implementation (no-op but type-safe)
    return super.addListener(eventName, listenerFunc) as Promise<PluginListenerHandle> & PluginListenerHandle;
  }

  override async removeAllListeners(): Promise<void> {
    await super.removeAllListeners();
  }
}
