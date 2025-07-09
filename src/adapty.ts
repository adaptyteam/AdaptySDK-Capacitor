import type { PluginListenerHandle } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

import type { AdaptyCapacitorPluginPlugin } from './definitions';
import { AdaptyUiMediaCacheCoder } from './shared/coders/adapty-ui-media-cache';
import type {
  AdaptyPaywall,
  AdaptyPaywallProduct,
  AdaptyOnboarding,
  AdaptyProfile,
  AdaptyPurchaseResult,
  AdaptyProfileParameters,
  RefundPreference,
} from './shared/types';
import {
  isErrorResponse,
  isSuccessResponse,
  type CrossPlatformResponse,
  type MethodName,
  type ResponseByMethod,
} from './shared/types/cross-platform-json';
import type {
  ActivateParamsInput,
  GetPlacementParamsInput,
  GetPlacementForDefaultAudienceParamsInput,
  MakePurchaseParamsInput,
  FileLocation,
  LogLevel,
} from './shared/types/inputs';
import type { AdaptyUiMediaCache } from './shared/ui/types';
import type { AdaptyPlugin } from './types/adapty-plugin';
import version from './version';

// Helper type to extract success content from response
type ExtractSuccessContent<T> = T extends { success: infer S } ? S : never;

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
   * Handle method calls through crossplatform bridge with type safety
   */
  private async handleMethodCall<M extends MethodName>(
    methodName: M,
    args: any,
  ): Promise<ExtractSuccessContent<ResponseByMethod<M>>> {
    const argsString = typeof args === 'string' ? args : JSON.stringify(args);
    const result = await AdaptyCapacitorPlugin.handleMethodCall({
      methodName,
      args: argsString,
    });

    // Parse JSON response with type safety
    try {
      const parsedResponse: CrossPlatformResponse = JSON.parse(result.crossPlatformJson);

      // Check for native errors
      if (isErrorResponse(parsedResponse)) {
        const error = parsedResponse.error;
        throw new Error(`Native error: ${error.message} (code: ${error.adapty_code})`);
      }

      // Extract success data with type safety
      if (isSuccessResponse(parsedResponse)) {
        return parsedResponse.success as ExtractSuccessContent<ResponseByMethod<M>>;
      }

      throw new Error('Invalid response format: missing success or error field');
    } catch (error) {
      // If it's our custom error, re-throw it
      if (error instanceof Error && !error.message.startsWith('{')) {
        throw error;
      }

      // If JSON parsing fails, wrap the error
      throw new Error(`Failed to parse native response: ${error}`);
    }
  }

  /**
   * Helper method to check if object is a paywall
   */
  private isPaywall(obj: AdaptyPaywall | AdaptyPaywallProduct): obj is AdaptyPaywall {
    return 'placement' in obj && 'paywallId' in obj;
  }

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
        const isActivated = await this.isActivated();
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

    // Call native activation through handleMethodCall
    await this.handleMethodCall('activate', configuration);
  }

  async getPaywall(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<{ paywall: AdaptyPaywall }> {
    const args = {
      placement_id: options.placementId,
      locale: options.locale,
      ...(options.params || {}),
    };
    const paywall = await this.handleMethodCall('get_paywall', args);
    return { paywall: paywall as unknown as AdaptyPaywall };
  }

  async getPaywallForDefaultAudience(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<{ paywall: AdaptyPaywall }> {
    const args = {
      placement_id: options.placementId,
      locale: options.locale,
      ...(options.params || {}),
    };
    const paywall = await this.handleMethodCall('get_paywall_for_default_audience', args);
    return { paywall: paywall as unknown as AdaptyPaywall };
  }

  async getPaywallProducts(options: { paywall: AdaptyPaywall }): Promise<{ products: AdaptyPaywallProduct[] }> {
    const args = { paywall: options.paywall };
    const products = await this.handleMethodCall('get_paywall_products', args);
    return { products: products as unknown as AdaptyPaywallProduct[] };
  }

  async getOnboarding(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<{ onboarding: AdaptyOnboarding }> {
    const args = {
      placement_id: options.placementId,
      locale: options.locale,
      ...(options.params || {}),
    };
    const onboarding = await this.handleMethodCall('get_onboarding', args);
    return { onboarding: onboarding as unknown as AdaptyOnboarding };
  }

  async getOnboardingForDefaultAudience(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<{ onboarding: AdaptyOnboarding }> {
    const args = {
      placement_id: options.placementId,
      locale: options.locale,
      ...(options.params || {}),
    };
    const onboarding = await this.handleMethodCall('get_onboarding_for_default_audience', args);
    return { onboarding: onboarding as unknown as AdaptyOnboarding };
  }

  async getProfile(): Promise<{ profile: AdaptyProfile }> {
    const profile = await this.handleMethodCall('get_profile', {});
    return { profile: profile as unknown as AdaptyProfile };
  }

  async identify(options: { customerUserId: string }): Promise<void> {
    const args = {
      customer_user_id: options.customerUserId,
    };
    await this.handleMethodCall('identify', args);
  }

  async logShowPaywall(options: { paywall: AdaptyPaywall }): Promise<void> {
    const args = {
      paywall: options.paywall,
    };
    await this.handleMethodCall('log_show_paywall', args);
  }

  async openWebPaywall(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<void> {
    const args = {
      paywall_or_product: options.paywallOrProduct,
    };
    await this.handleMethodCall('open_web_paywall', args);
  }

  async createWebPaywallUrl(options: {
    paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct;
  }): Promise<{ url: string }> {
    const args = this.isPaywall(options.paywallOrProduct)
      ? { paywall: options.paywallOrProduct }
      : { product: options.paywallOrProduct };

    const url = await this.handleMethodCall('create_web_paywall_url', args);
    return { url: url as string };
  }

  async logShowOnboarding(options: {
    screenOrder: number;
    onboardingName?: string;
    screenName?: string;
  }): Promise<void> {
    const args = {
      screen_order: options.screenOrder,
      onboarding_name: options.onboardingName,
      screen_name: options.screenName,
    };
    await this.handleMethodCall('log_show_onboarding', args);
  }

  async logout(): Promise<void> {
    await this.handleMethodCall('logout', {});
  }

  async makePurchase(options: {
    product: AdaptyPaywallProduct;
    params?: MakePurchaseParamsInput;
  }): Promise<{ result: AdaptyPurchaseResult }> {
    const args = {
      product: options.product,
      ...(options.params || {}),
    };
    const result = await this.handleMethodCall('make_purchase', args);
    return { result: result as unknown as AdaptyPurchaseResult };
  }

  async presentCodeRedemptionSheet(): Promise<void> {
    await this.handleMethodCall('present_code_redemption_sheet', {});
  }

  async reportTransaction(options: { transactionId: string; variationId?: string }): Promise<void> {
    const args = {
      transaction_id: options.transactionId,
      variation_id: options.variationId,
    };
    await this.handleMethodCall('report_transaction', args);
  }

  async restorePurchases(): Promise<{ profile: AdaptyProfile }> {
    const profile = await this.handleMethodCall('restore_purchases', {});
    return { profile: profile as unknown as AdaptyProfile };
  }

  async setFallback(options: { fileLocation: FileLocation }): Promise<void> {
    const args = {
      file_location: options.fileLocation,
    };
    await this.handleMethodCall('set_fallback', args);
  }

  async setFallbackPaywalls(options: { paywallsLocation: FileLocation }): Promise<void> {
    const args = {
      paywalls_location: options.paywallsLocation,
    };
    await this.handleMethodCall('set_fallback', args);
  }

  async setIntegrationIdentifier(options: { key: string; value: string }): Promise<void> {
    const args = {
      key: options.key,
      value: options.value,
    };
    await this.handleMethodCall('set_integration_identifiers', args);
  }

  async setLogLevel(options: { logLevel: LogLevel }): Promise<void> {
    const args = {
      log_level: options.logLevel,
    };
    await this.handleMethodCall('set_log_level', args);
  }

  async updateAttribution(options: { attribution: Record<string, any>; source: string }): Promise<void> {
    const args = {
      attribution: options.attribution,
      source: options.source,
    };
    await this.handleMethodCall('update_attribution_data', args);
  }

  async updateCollectingRefundDataConsent(options: { consent: boolean }): Promise<void> {
    const args = {
      consent: options.consent,
    };
    await this.handleMethodCall('update_collecting_refund_data_consent', args);
  }

  async updateRefundPreference(options: { refundPreference: RefundPreference }): Promise<void> {
    const args = {
      refund_preference: options.refundPreference,
    };
    await this.handleMethodCall('update_refund_preference', args);
  }

  async updateProfile(options: { params: Partial<AdaptyProfileParameters> }): Promise<void> {
    const args = {
      params: options.params,
    };
    await this.handleMethodCall('update_profile', args);
  }

  async isActivated(): Promise<boolean> {
    const result = await this.handleMethodCall('is_activated', {});
    return result;
  }

  addListener(
    _eventName: 'onLatestProfileLoad',
    _listenerFunc: (data: { profile: AdaptyProfile }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle {
    // TODO: Implement proper event listener handling through crossplatform bridge
    const handle = {
      remove: async () => {
        // TODO: Implement removal
      },
    };
    const promise = Promise.resolve(handle);
    return Object.assign(promise, handle);
  }

  async removeAllListeners(): Promise<void> {
    // TODO: Implement proper event listener removal through crossplatform bridge
  }
}
