import type { PluginListenerHandle } from '@capacitor/core';

import { AdaptyCapacitorPlugin } from './bridge/plugin';
import { defaultAdaptyOptions } from './default-configs';
import { AdaptyOnboardingCoder } from './shared/coders/adapty-onboarding';
import { AdaptyPaywallCoder } from './shared/coders/adapty-paywall';
import { AdaptyPaywallProductCoder } from './shared/coders/adapty-paywall-product';
import { AdaptyProfileCoder } from './shared/coders/adapty-profile';
import { AdaptyPurchaseResultCoder } from './shared/coders/adapty-purchase-result';
import { AdaptyUiMediaCacheCoder } from './shared/coders/adapty-ui-media-cache';
import { createArrayCoder } from './shared/coders/array';
import type {
  AdaptyPaywall,
  AdaptyPaywallProduct,
  AdaptyOnboarding,
  AdaptyProfile,
  AdaptyPurchaseResult,
  AdaptyProfileParameters,
  RefundPreference,
} from './shared/types';
import type { components } from './shared/types/api';
import type {
  ActivateParamsInput,
  GetPlacementParamsInput,
  GetPlacementForDefaultAudienceParamsInput,
  MakePurchaseParamsInput,
  FileLocation,
  LogLevel,
} from './shared/types/inputs';
import {
  isErrorResponse,
  isSuccessResponse,
  type CrossPlatformResponse,
  type MethodName,
  type MethodResponseMap,
} from './shared/types/method-types';
import type { AdaptyUiMediaCache } from './shared/ui/types';
import { filterUndefined } from './shared/utils/compact-object';
import { mergeOptions } from './shared/utils/merge-options';
import type { AdaptyPlugin } from './types/adapty-plugin';
import type {
  AdaptyDefaultOptions,
  GetPaywallOptions,
  GetPaywallOptionsWithDefaults,
  GetPaywallForDefaultAudienceOptions,
  GetPaywallForDefaultAudienceOptionsWithDefaults,
} from './types/configs';
import version from './version';

type Req = components['requests'];

interface ProfileEventData {
  profile: AdaptyProfile;
}

// Coder registry for different method responses
const coderRegistry = {
  get_profile: AdaptyProfileCoder,
  restore_purchases: AdaptyProfileCoder,
  get_paywall: AdaptyPaywallCoder,
  get_paywall_for_default_audience: AdaptyPaywallCoder,
  get_paywall_products: createArrayCoder<AdaptyPaywallProduct, AdaptyPaywallProductCoder>(AdaptyPaywallProductCoder),
  get_onboarding: AdaptyOnboardingCoder,
  get_onboarding_for_default_audience: AdaptyOnboardingCoder,
  make_purchase: AdaptyPurchaseResultCoder,
} as const;

// Get appropriate coder for method
function getCoder(method: MethodName) {
  const CoderClass = coderRegistry[method as keyof typeof coderRegistry];
  if (!CoderClass) return null;

  return new CoderClass();
}

export class Adapty implements AdaptyPlugin {
  private activating: Promise<void> | null = null;
  private readonly options: AdaptyDefaultOptions = defaultAdaptyOptions;
  private readonly defaultMediaCache: AdaptyUiMediaCache = {
    memoryStorageTotalCostLimit: 100 * 1024 * 1024,
    memoryStorageCountLimit: 2147483647,
    diskStorageSizeLimit: 100 * 1024 * 1024,
  };

  /**
   * Handle method calls through crossplatform bridge with type safety
   */
  public async handleMethodCall<M extends MethodName>(methodName: M, args: string): Promise<MethodResponseMap[M]> {
    const result = await AdaptyCapacitorPlugin.handleMethodCall({
      methodName,
      args,
    });

    // Parse JSON response with type safety
    try {
      const parsedResponse: CrossPlatformResponse = JSON.parse(result.crossPlatformJson);

      // Check for native errors
      if (isErrorResponse(parsedResponse)) {
        const error = parsedResponse.error;
        throw new Error(`Native error: ${error.message} (code: ${error.adaptyCode})`);
      }

      // Extract success data with type safety
      if (isSuccessResponse(parsedResponse)) {
        const successData: any = parsedResponse.success;

        // Apply decoder if available for this method
        const coder = getCoder(methodName);
        if (coder) {
          return coder.decode(successData) as MethodResponseMap[M];
        }

        // Return raw data for methods without specific coders
        return successData as MethodResponseMap[M];
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

    if (params.android?.adIdCollectionDisabled !== undefined) {
      configuration.google_adid_collection_disabled = params.android.adIdCollectionDisabled;
    }

    if (params.ios?.idfaCollectionDisabled !== undefined) {
      configuration.apple_idfa_collection_disabled = params.ios.idfaCollectionDisabled;
    }

    const method = 'activate';
    const activateRequest = {
      configuration: configuration,
      method,
    };
    await this.handleMethodCall(method, JSON.stringify(activateRequest));
  }

  async isActivated(): Promise<boolean> {
    const method = 'is_activated';

    const argsWithUndefined: Req['IsActivated.Request'] = {
      method,
    };

    const args = filterUndefined(argsWithUndefined);

    const result = await this.handleMethodCall(method, JSON.stringify(args));
    return result;
  }

  async getPaywall(options: GetPaywallOptions): Promise<AdaptyPaywall> {
    const method = 'get_paywall';
    const optionsWithDefault = mergeOptions<GetPaywallOptionsWithDefaults>(options, this.options[method]);
    const params = optionsWithDefault.params;

    const argsWithUndefined: Req['GetPaywall.Request'] = {
      method,
      placement_id: optionsWithDefault.placementId,
      load_timeout: params.loadTimeoutMs / 1000,
      locale: optionsWithDefault.locale,
      fetch_policy:
        params.fetchPolicy === 'return_cache_data_if_not_expired_else_load'
          ? { type: params.fetchPolicy, max_age: params.maxAgeSeconds }
          : { type: params.fetchPolicy },
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args));
  }

  async getPaywallForDefaultAudience(options: GetPaywallForDefaultAudienceOptions): Promise<AdaptyPaywall> {
    const method = 'get_paywall_for_default_audience';
    const optionsWithDefault = mergeOptions<GetPaywallForDefaultAudienceOptionsWithDefaults>(
      options,
      this.options[method],
    );
    const params = optionsWithDefault.params;

    const argsWithUndefined: Req['GetPaywallForDefaultAudience.Request'] = {
      method,
      placement_id: optionsWithDefault.placementId,
      locale: optionsWithDefault.locale,
      fetch_policy:
        params.fetchPolicy === 'return_cache_data_if_not_expired_else_load'
          ? { type: params.fetchPolicy, max_age: params.maxAgeSeconds }
          : { type: params.fetchPolicy ?? 'reload_revalidating_cache_data' },
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args));
  }

  async getPaywallProducts(options: { paywall: AdaptyPaywall }): Promise<AdaptyPaywallProduct[]> {
    const method = 'get_paywall_products';

    const paywallCoder = new AdaptyPaywallCoder();

    const argsWithUndefined: Req['GetPaywallProducts.Request'] = {
      method,
      paywall: paywallCoder.encode(options.paywall),
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args));
  }

  //todo: refactor later
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
    const onboarding = await this.handleMethodCall(method, JSON.stringify(args));

    // Decode the onboarding using the coder to convert snake_case to camelCase
    const onboardingCoder = new AdaptyOnboardingCoder();
    return onboardingCoder.decode(onboarding as any);
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
    const onboarding = await this.handleMethodCall(method, JSON.stringify(args));

    // Decode the onboarding using the coder to convert snake_case to camelCase
    const onboardingCoder = new AdaptyOnboardingCoder();
    return onboardingCoder.decode(onboarding as any);
  }

  async getProfile(): Promise<AdaptyProfile> {
    const method = 'get_profile';

    const argsWithUndefined: Req['GetProfile.Request'] = {
      method,
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args));
  }

  async identify(options: { customerUserId: string }): Promise<void> {
    const method = 'identify';

    const argsWithUndefined: Req['Identify.Request'] = {
      method,
      customer_user_id: options.customerUserId,
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async logShowPaywall(options: { paywall: AdaptyPaywall }): Promise<void> {
    const method = 'log_show_paywall';
    const args = {
      paywall: options.paywall,
      method,
    };
    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async openWebPaywall(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<void> {
    const method = 'open_web_paywall';
    const args = {
      paywall_or_product: options.paywallOrProduct,
      method,
    };
    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async createWebPaywallUrl(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<string> {
    const method = 'create_web_paywall_url';
    const args = this.isPaywall(options.paywallOrProduct)
      ? { method, paywall: options.paywallOrProduct }
      : { method, product: options.paywallOrProduct };

    const url = await this.handleMethodCall(method, JSON.stringify(args));
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
    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async logout(): Promise<void> {
    const method = 'logout';

    const argsWithUndefined: Req['Logout.Request'] = {
      method,
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args));
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
    const rawResult = await this.handleMethodCall(method, JSON.stringify(args));

    // Decode the purchase result using the coder to convert snake_case to camelCase
    const purchaseResultCoder = new AdaptyPurchaseResultCoder();
    return purchaseResultCoder.decode(rawResult as any);
  }

  async presentCodeRedemptionSheet(): Promise<void> {
    const method = 'present_code_redemption_sheet';
    const args = { method };
    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async reportTransaction(options: { transactionId: string; variationId?: string }): Promise<void> {
    const method = 'report_transaction';
    const args = {
      transaction_id: options.transactionId,
      variation_id: options.variationId,
      method,
    };
    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async restorePurchases(): Promise<AdaptyProfile> {
    const method = 'restore_purchases';
    const args = { method };
    const rawProfile = await this.handleMethodCall(method, JSON.stringify(args));

    // Decode the profile using the coder to convert snake_case to camelCase
    const profileCoder = new AdaptyProfileCoder();
    return profileCoder.decode(rawProfile as any);
  }

  async setFallback(options: { fileLocation: FileLocation }): Promise<void> {
    const method = 'set_fallback';
    const args = {
      file_location: options.fileLocation,
      method,
    };
    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async setFallbackPaywalls(options: { paywallsLocation: FileLocation }): Promise<void> {
    const method = 'set_fallback';
    const args = {
      paywalls_location: options.paywallsLocation,
      method,
    };
    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async setIntegrationIdentifier(options: { key: string; value: string }): Promise<void> {
    const method = 'set_integration_identifiers';
    const args = {
      method,
      key: options.key,
      value: options.value,
    };
    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async setLogLevel(options: { logLevel: LogLevel }): Promise<void> {
    const method = 'set_log_level';
    const args = {
      method,
      log_level: options.logLevel,
    };
    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async updateAttribution(options: { attribution: Record<string, any>; source: string }): Promise<void> {
    const method = 'update_attribution_data';
    const args = {
      attribution: options.attribution,
      source: options.source,
      method,
    };
    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async updateCollectingRefundDataConsent(options: { consent: boolean }): Promise<void> {
    const method = 'update_collecting_refund_data_consent';
    const args = {
      consent: options.consent,
      method,
    };
    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async updateRefundPreference(options: { refundPreference: RefundPreference }): Promise<void> {
    const method = 'update_refund_preference';
    const args = {
      refund_preference: options.refundPreference,
      method,
    };
    await this.handleMethodCall(method, JSON.stringify(args));
  }

  async updateProfile(options: { params: Partial<AdaptyProfileParameters> }): Promise<void> {
    const method = 'update_profile';
    const args = {
      params: options.params,
      method,
    };
    await this.handleMethodCall(method, JSON.stringify(args));
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
