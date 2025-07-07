import type { PluginListenerHandle } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

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
import type { AdaptyCapacitorPluginPlugin } from './definitions';
import { AdaptyUiMediaCacheCoder } from './shared/coders/adapty-ui-media-cache';
import { AdaptyUiMediaCache } from './shared/ui/types';
import version from './version';

const AdaptyCapacitorPlugin = registerPlugin<AdaptyCapacitorPluginPlugin>('AdaptyCapacitorPlugin', {
  web: () => import('./web').then((m) => new m.AdaptyCapacitorPluginWeb()),
});

export class Adapty implements AdaptyPlugin {
  private activating: Promise<void> | null = null;
  private defaultMediaCache: AdaptyUiMediaCache = {
    memoryStorageTotalCostLimit: 100 * 1024 * 1024,
    memoryStorageCountLimit: 2147483647,
    diskStorageSizeLimit: 100 * 1024 * 1024,
  };

  /**
   * Initializes the Adapty SDK.
   *
   * @param options - The activation options
   * @param options.apiKey - Your Adapty API key
   * @param options.params - Optional activation parameters
   * @returns Promise that resolves when the SDK is activated
   * @throws Error if the API key is invalid or activation fails
   */
  async activate(options: { apiKey: string; params?: ActivateParamsInput }): Promise<void> {
    const { apiKey, params = {} } = options;

    // Validate API key
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('API key is required and must be a non-empty string');
    }

    // Prevent multiple activations
    if (this.activating) {
      await this.activating;
      return;
    }

    // Check if already activated (if __ignoreActivationOnFastRefresh is enabled)
    if (params.__ignoreActivationOnFastRefresh) {
      try {
        const { isActivated } = await this.isActivated();
        if (isActivated) {
          return;
        }
      } catch (error) {
        // Continue with activation if we can't check activation status
      }
    }

    // Defer activation if requested (for debugging)
    if (params.__debugDeferActivation) {
      return new Promise<void>((resolve) => {
        // Store the activation promise for later execution
        this.activating = this.performActivation(apiKey, params);
        this.activating.then(() => resolve()).catch(() => resolve());
      });
    }

    // Perform activation
    this.activating = this.performActivation(apiKey, params);
    await this.activating;
    this.activating = null;
  }

  private async performActivation(apiKey: string, params: ActivateParamsInput): Promise<void> {
    // Build configuration object
    const configuration: Record<string, any> = {
      api_key: apiKey,
      cross_platform_sdk_name: 'capacitor',
      cross_platform_sdk_version: version,
      observer_mode: params.observerMode ?? false,
      ip_address_collection_disabled: params.ipAddressCollectionDisabled ?? false,
      server_cluster: params.serverCluster ?? 'default',
      activate_ui: params.activateUi ?? true,
    };

    // Add optional parameters
    if (params.customerUserId) {
      configuration.customer_user_id = params.customerUserId;
    }

    if (params.logLevel) {
      configuration.log_level = params.logLevel;
    }

    if (params.backendBaseUrl) {
      configuration.backend_base_url = params.backendBaseUrl;
    }

    if (params.backendFallbackBaseUrl) {
      configuration.backend_fallback_base_url = params.backendFallbackBaseUrl;
    }

    if (params.backendConfigsBaseUrl) {
      configuration.backend_configs_base_url = params.backendConfigsBaseUrl;
    }

    if (params.backendProxyHost) {
      configuration.backend_proxy_host = params.backendProxyHost;
    }

    if (params.backendProxyPort) {
      configuration.backend_proxy_port = params.backendProxyPort;
    }

    // Encode media cache configuration
    const coder = new AdaptyUiMediaCacheCoder();
    configuration.media_cache = coder.encode(params.mediaCache ?? this.defaultMediaCache);

    // Platform-specific configuration
    if (params.android?.adIdCollectionDisabled !== undefined) {
      configuration.google_adid_collection_disabled = params.android.adIdCollectionDisabled;
    }

    if (params.ios?.idfaCollectionDisabled !== undefined) {
      configuration.apple_idfa_collection_disabled = params.ios.idfaCollectionDisabled;
    }

    // Call native activation
    await AdaptyCapacitorPlugin.activate({
      apiKey,
      params: configuration,
    });
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

  async isActivated(): Promise<{ isActivated: boolean }> {
    return await AdaptyCapacitorPlugin.isActivated();
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
