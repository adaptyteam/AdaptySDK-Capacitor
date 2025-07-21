import type { PluginListenerHandle } from '@capacitor/core';

// Импортируем зарегистрированный экземпляр вместо создания нового
import { AdaptyCapacitorPlugin } from './plugin';
import { AdaptyOnboardingCoder } from './shared/coders/adapty-onboarding';
import { AdaptyPaywallCoder } from './shared/coders/adapty-paywall';
import { AdaptyPaywallProductCoder } from './shared/coders/adapty-paywall-product';
import { AdaptyProfileCoder } from './shared/coders/adapty-profile';
import { AdaptyPurchaseResultCoder } from './shared/coders/adapty-purchase-result';
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

interface ProfileEventData {
  profile: AdaptyProfile;
}

// Helper type to extract success content from response
type ExtractSuccessContent<T> = T extends { success: infer S } ? S : never;

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
  public async handleMethodCall<M extends MethodName>(
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
    const method = 'activate';
    const activateRequest = {
      configuration: configuration,
      method,
    };
    await this.handleMethodCall(method, activateRequest);
  }

  async isActivated(): Promise<boolean> {
    const method = 'is_activated';
    const args = { method };
    const result = await this.handleMethodCall(method, args);
    return result;
  }

  async getPaywall(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<AdaptyPaywall> {
    const method = 'get_paywall';
    const args = {
      method,
      placement_id: options.placementId,
      locale: options.locale,
      ...(options.params || {}),
    };
    const rawPaywall = await this.handleMethodCall(method, args);

    // Decode the paywall using the coder to convert snake_case to camelCase
    const paywallCoder = new AdaptyPaywallCoder();
    return paywallCoder.decode(rawPaywall);
  }

  async getPaywallForDefaultAudience(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<AdaptyPaywall> {
    const method = 'get_paywall_for_default_audience';
    const args = {
      placement_id: options.placementId,
      locale: options.locale,
      method,
      ...(options.params || {}),
    };
    const rawPaywall = await this.handleMethodCall(method, args);

    // Decode the paywall using the coder to convert snake_case to camelCase
    const paywallCoder = new AdaptyPaywallCoder();
    return paywallCoder.decode(rawPaywall);
  }

  async getPaywallProducts(options: { paywall: AdaptyPaywall }): Promise<AdaptyPaywallProduct[]> {
    const method = 'get_paywall_products';
    const args = {
      paywall: options.paywall,
      method,
    };
    const products = await this.handleMethodCall(method, args);

    // Decode the products array using the coder to convert snake_case to camelCase
    const productCoder = new AdaptyPaywallProductCoder();
    return products.map((product: any) => productCoder.decode(product));
  }

  async getOnboarding(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementParamsInput;
  }): Promise<AdaptyOnboarding> {
    const method = 'get_onboarding';
    const args = {
      placement_id: options.placementId,
      locale: options.locale,
      method,
      ...(options.params || {}),
    };
    const onboarding = await this.handleMethodCall(method, args);

    // Decode the onboarding using the coder to convert snake_case to camelCase
    const onboardingCoder = new AdaptyOnboardingCoder();
    return onboardingCoder.decode(onboarding);
  }

  async getOnboardingForDefaultAudience(options: {
    placementId: string;
    locale?: string;
    params?: GetPlacementForDefaultAudienceParamsInput;
  }): Promise<AdaptyOnboarding> {
    const method = 'get_onboarding_for_default_audience';
    const args = {
      placement_id: options.placementId,
      locale: options.locale,
      method,
      ...(options.params || {}),
    };
    const onboarding = await this.handleMethodCall(method, args);

    // Decode the onboarding using the coder to convert snake_case to camelCase
    const onboardingCoder = new AdaptyOnboardingCoder();
    return onboardingCoder.decode(onboarding);
  }

  async getProfile(): Promise<AdaptyProfile> {
    const method = 'get_profile';
    const args = { method };
    const rawProfile = await this.handleMethodCall(method, args);

    // Decode the profile using the coder to convert snake_case to camelCase
    const profileCoder = new AdaptyProfileCoder();
    return profileCoder.decode(rawProfile);
  }

  async identify(options: { customerUserId: string }): Promise<void> {
    const method = 'identify';
    const args = {
      customer_user_id: options.customerUserId,
      method,
    };
    await this.handleMethodCall(method, args);
  }

  async logShowPaywall(options: { paywall: AdaptyPaywall }): Promise<void> {
    const method = 'log_show_paywall';
    const args = {
      paywall: options.paywall,
      method,
    };
    await this.handleMethodCall(method, args);
  }

  async openWebPaywall(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<void> {
    const method = 'open_web_paywall';
    const args = {
      paywall_or_product: options.paywallOrProduct,
      method,
    };
    await this.handleMethodCall(method, args);
  }

  async createWebPaywallUrl(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<string> {
    const method = 'create_web_paywall_url';
    const args = this.isPaywall(options.paywallOrProduct)
      ? { method, paywall: options.paywallOrProduct }
      : { method, product: options.paywallOrProduct };

    const url = await this.handleMethodCall(method, args);
    return url as string;
  }

  async logShowOnboarding(options: {
    screenOrder: number;
    onboardingName?: string;
    screenName?: string;
  }): Promise<void> {
    const method = 'log_show_onboarding';
    const args = {
      screen_order: options.screenOrder,
      onboarding_name: options.onboardingName,
      screen_name: options.screenName,
      method,
    };
    await this.handleMethodCall(method, args);
  }

  async logout(): Promise<void> {
    const method = 'logout';
    const args = { method };
    await this.handleMethodCall(method, args);
  }

  async makePurchase(options: {
    product: AdaptyPaywallProduct;
    params?: MakePurchaseParamsInput;
  }): Promise<AdaptyPurchaseResult> {
    const method = 'make_purchase';
    const args = {
      product: options.product,
      method,
      ...(options.params || {}),
    };
    const rawResult = await this.handleMethodCall(method, args);

    // Decode the purchase result using the coder to convert snake_case to camelCase
    const purchaseResultCoder = new AdaptyPurchaseResultCoder();
    return purchaseResultCoder.decode(rawResult);
  }

  async presentCodeRedemptionSheet(): Promise<void> {
    const method = 'present_code_redemption_sheet';
    const args = { method };
    await this.handleMethodCall(method, args);
  }

  async reportTransaction(options: { transactionId: string; variationId?: string }): Promise<void> {
    const method = 'report_transaction';
    const args = {
      transaction_id: options.transactionId,
      variation_id: options.variationId,
      method,
    };
    await this.handleMethodCall(method, args);
  }

  async restorePurchases(): Promise<AdaptyProfile> {
    const method = 'restore_purchases';
    const args = { method };
    const rawProfile = await this.handleMethodCall(method, args);

    // Decode the profile using the coder to convert snake_case to camelCase
    const profileCoder = new AdaptyProfileCoder();
    return profileCoder.decode(rawProfile);
  }

  async setFallback(options: { fileLocation: FileLocation }): Promise<void> {
    const method = 'set_fallback';
    const args = {
      file_location: options.fileLocation,
      method,
    };
    await this.handleMethodCall(method, args);
  }

  async setFallbackPaywalls(options: { paywallsLocation: FileLocation }): Promise<void> {
    const method = 'set_fallback';
    const args = {
      paywalls_location: options.paywallsLocation,
      method,
    };
    await this.handleMethodCall(method, args);
  }

  async setIntegrationIdentifier(options: { key: string; value: string }): Promise<void> {
    const method = 'set_integration_identifiers';
    const args = {
      method,
      key: options.key,
      value: options.value,
    };
    await this.handleMethodCall(method, args);
  }

  async setLogLevel(options: { logLevel: LogLevel }): Promise<void> {
    const method = 'set_log_level';
    const args = {
      method,
      log_level: options.logLevel,
    };
    await this.handleMethodCall(method, args);
  }

  async updateAttribution(options: { attribution: Record<string, any>; source: string }): Promise<void> {
    const method = 'update_attribution_data';
    const args = {
      attribution: options.attribution,
      source: options.source,
      method,
    };
    await this.handleMethodCall(method, args);
  }

  async updateCollectingRefundDataConsent(options: { consent: boolean }): Promise<void> {
    const method = 'update_collecting_refund_data_consent';
    const args = {
      consent: options.consent,
      method,
    };
    await this.handleMethodCall(method, args);
  }

  async updateRefundPreference(options: { refundPreference: RefundPreference }): Promise<void> {
    const method = 'update_refund_preference';
    const args = {
      refund_preference: options.refundPreference,
      method,
    };
    await this.handleMethodCall(method, args);
  }

  async updateProfile(options: { params: Partial<AdaptyProfileParameters> }): Promise<void> {
    const method = 'update_profile';
    const args = {
      params: options.params,
      method,
    };
    await this.handleMethodCall(method, args);
  }

  addListener(
    eventName: 'onLatestProfileLoad',
    listenerFunc: (data: { profile: AdaptyProfile }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle {
    // Register listener through Capacitor plugin
    return AdaptyCapacitorPlugin.addListener(eventName, (arg: any) => {
      try {
        // Strict validation: events must come in {data: "json_string"} format
        if (!arg || typeof arg !== 'object' || !arg.data) {
          const error = `[Adapty] Invalid event format received. Expected {data: "json_string"}, got: ${JSON.stringify(arg)}`;
          console.error(error);
          throw new Error(error);
        }

        const rawEventData: string = arg.data;

        // Parse JSON string
        let eventData: ProfileEventData;
        if (typeof rawEventData === 'string') {
          try {
            eventData = JSON.parse(rawEventData) as ProfileEventData;
          } catch (error) {
            const errorMsg = `[Adapty] Failed to parse event data JSON: ${error}. Raw data: ${rawEventData}`;
            console.error(errorMsg);
            throw new Error(errorMsg);
          }
        } else {
          const errorMsg = `[Adapty] Expected event data to be JSON string, got ${typeof rawEventData}: ${rawEventData}`;
          console.error(errorMsg);
          throw new Error(errorMsg);
        }

        // Call user's listener with parsed profile data
        if (eventData?.profile) {
          listenerFunc({ profile: eventData.profile });
        } else {
          console.error('[Adapty] Event data does not contain profile:', eventData);
          throw new Error('[Adapty] Event data does not contain profile');
        }
      } catch (error) {
        console.error('Error processing onLatestProfileLoad event:', error);
        throw error;
      }
    });
  }

  async removeAllListeners(): Promise<void> {
    // Remove all listeners through Capacitor plugin
    return AdaptyCapacitorPlugin.removeAllListeners();
  }
}
