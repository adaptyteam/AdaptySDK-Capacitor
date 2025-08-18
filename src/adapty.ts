import type { PluginListenerHandle } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

import { AdaptyCapacitorPlugin } from './bridge/plugin';
import { getCoder } from './coder-registry';
import { defaultAdaptyOptions } from './default-configs';
import { AdaptyPaywallCoder } from './shared/coders/adapty-paywall';
import { AdaptyPaywallProductCoder } from './shared/coders/adapty-paywall-product';
import { AdaptyProfileParametersCoder } from './shared/coders/adapty-profile-parameters';
import { AdaptyPurchaseParamsCoder } from './shared/coders/adapty-purchase-params';
import { AdaptyUiMediaCacheCoder } from './shared/coders/adapty-ui-media-cache';
import { parseCommonEvent } from './shared/coders/parse';
import { Log, LogContext } from './shared/logger';
import type { LoggerConfig, LogScope } from './shared/logger';
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
import type { ActivateParamsInput, FileLocation, LogLevel } from './shared/types/inputs';
import {
  isErrorResponse,
  isSuccessResponse,
  type CrossPlatformResponse,
  type MethodName,
  type MethodResponseMap,
} from './shared/types/method-types';
import { filterUndefined } from './shared/utils/compact-object';
import { mergeOptions } from './shared/utils/merge-options';
import type { AdaptyPlugin } from './types/adapty-plugin';
import type {
  AdaptyDefaultOptions,
  GetPaywallOptions,
  GetPaywallOptionsWithDefaults,
  GetPaywallForDefaultAudienceOptions,
  GetPaywallForDefaultAudienceOptionsWithDefaults,
  MakePurchaseOptions,
  GetOnboardingOptions,
  GetOnboardingOptionsWithDefaults,
  GetOnboardingForDefaultAudienceOptions,
  GetOnboardingForDefaultAudienceOptionsWithDefaults,
} from './types/configs';
import type { AdaptyUiMediaCache } from './ui-builder/types';
import version from './version';

type Req = components['requests'];

export class Adapty implements AdaptyPlugin {
  private activating: Promise<void> | null = null;
  private resolveHeldActivation?: (() => Promise<void>) | null = null;
  private nonWaitingMethods: MethodName[] = [
    'activate',
    'is_activated',
    'get_paywall_for_default_audience',
    'get_onboarding_for_default_audience',
    'set_log_level',
    'set_fallback',
  ];
  private readonly options: AdaptyDefaultOptions = defaultAdaptyOptions;
  private readonly defaultMediaCache: AdaptyUiMediaCache = {
    memoryStorageTotalCostLimit: 100 * 1024 * 1024,
    memoryStorageCountLimit: 2147483647,
    diskStorageSizeLimit: 100 * 1024 * 1024,
  };

  /**
   * Helper method for logging encode operations
   */
  private encodeWithLogging<T, R>(
    coder: { encode(data: T): R },
    data: T,
    methodName: string,
    parentCtx?: LogContext,
  ): R {
    if (!parentCtx) {
      return coder.encode(data);
    }

    const encodeLog = parentCtx.encode({ methodName: `encode/${methodName}` });
    encodeLog.start(() => ({ data }));

    try {
      const result = coder.encode(data);
      encodeLog.success(() => ({ result }));
      return result;
    } catch (error) {
      encodeLog.failed(() => ({ error }));
      throw error;
    }
  }

  /**
   * Handle method calls through crossplatform bridge with type safety
   */
  public async handleMethodCall<M extends MethodName>(
    methodName: M,
    args: string,
    ctx: LogContext,
    log: LogScope,
  ): Promise<MethodResponseMap[M]> {
    // Hold on deferred activation first
    if (this.resolveHeldActivation && !this.nonWaitingMethods.includes(methodName)) {
      log.wait(() => ({}));
      await this.resolveHeldActivation();
      this.resolveHeldActivation = null;
      log.waitComplete(() => ({}));
    }

    // Then wait for ongoing activation if required
    if (this.activating && (!this.nonWaitingMethods.includes(methodName) || methodName === 'is_activated')) {
      log.wait(() => ({}));
      await this.activating;
      log.waitComplete(() => ({}));
    }

    const bridgeLog = ctx.bridge({ methodName: `fetch/${methodName}` });
    bridgeLog.start(() => ({ method: methodName, args }));

    try {
      const result = await AdaptyCapacitorPlugin.handleMethodCall({
        methodName,
        args,
      });

      bridgeLog.success(() => ({ crossPlatformJson: result.crossPlatformJson }));

      // Parse JSON response with type safety
      const parsedResponse: CrossPlatformResponse = JSON.parse(result.crossPlatformJson);

      // Check for native errors
      if (isErrorResponse(parsedResponse)) {
        const error = parsedResponse.error;
        const errorMessage = `Native error: ${error.message} (code: ${error.adaptyCode})`;
        const nativeError = new Error(errorMessage);

        log.failed(() => ({ error: nativeError }));
        throw nativeError;
      }

      // Extract success data with type safety
      if (isSuccessResponse(parsedResponse)) {
        const successData: any = parsedResponse.success;

        // Apply decoder if available for this method
        const coder = getCoder(methodName);
        let result: MethodResponseMap[M];

        if (coder) {
          // Create decode scope for logging decode operations
          const decodeLog = ctx.decode({ methodName: `decode/${methodName}` });
          decodeLog.start(() => ({ successData }));

          try {
            result = coder.decode(successData) as MethodResponseMap[M];
            decodeLog.success(() => ({ result }));
          } catch (error) {
            decodeLog.failed(() => ({ error }));
            throw error;
          }
        } else {
          result = successData as MethodResponseMap[M];
        }

        log.success(() => ({ result }));
        return result;
      }

      const formatError = new Error('Invalid response format: missing success or error field');
      log.failed(() => ({ error: formatError }));
      throw formatError;
    } catch (error) {
      bridgeLog.success(() => ({ error }));
      // If it's our custom error and log wasn't called yet, log it
      if (error instanceof Error && !error.message.startsWith('{')) {
        if (!error.message.startsWith('Native error:')) {
          log.failed(() => ({ error }));
        }
        throw error;
      }

      // If JSON parsing fails, wrap the error
      const parseError = new Error(`Failed to parse native response: ${error}`);
      log.failed(() => ({ error: parseError }));
      throw parseError;
    }
  }

  private isPaywallProduct(obj: AdaptyPaywall | AdaptyPaywallProduct): obj is AdaptyPaywallProduct {
    return 'vendorProductId' in obj;
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

    // Defer activation if requested (for debugging) — start activation lazily on first blocked call
    if (params.__debugDeferActivation) {
      return new Promise<void>((resolve) => {
        // Do not start activation immediately. It will be started when a blocked method comes in.
        this.resolveHeldActivation = async () => {
          this.activating = this.performActivation(apiKey, params);
          try {
            await this.activating;
          } finally {
            this.activating = null;
          }
          resolve();
        };
      });
    }

    // Perform activation
    this.activating = this.performActivation(apiKey, params);
    await this.activating;
    this.activating = null;
  }

  private async performActivation(apiKey: string, params: ActivateParamsInput): Promise<void> {
    const method = 'activate';

    // Set log level before creating LogContext
    const logLevel = params.logLevel;
    Log.logLevel = logLevel || null;

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ apiKey, params }));

    const coder = new AdaptyUiMediaCacheCoder();

    const configurationWithUndefined: components['defs']['AdaptyConfiguration'] = {
      api_key: apiKey,
      cross_platform_sdk_name: 'capacitor',
      cross_platform_sdk_version: version,
      observer_mode: params.observerMode ?? false,
      ip_address_collection_disabled: params.ipAddressCollectionDisabled ?? false,
      server_cluster: params.serverCluster ?? 'default',
      activate_ui: params.activateUi ?? true,
      customer_user_id: params.customerUserId,
      log_level: params.logLevel,
      backend_base_url: params.backendBaseUrl,
      backend_fallback_base_url: params.backendFallbackBaseUrl,
      backend_configs_base_url: params.backendConfigsBaseUrl,
      backend_proxy_host: params.backendProxyHost,
      backend_proxy_port: params.backendProxyPort,
      media_cache: coder.encode(params.mediaCache ?? this.defaultMediaCache),
      google_adid_collection_disabled: params.android?.adIdCollectionDisabled,
      apple_idfa_collection_disabled: params.ios?.idfaCollectionDisabled,
    };

    const activateRequestWithUndefined: Req['Activate.Request'] = {
      method,
      configuration: filterUndefined(configurationWithUndefined),
    };

    const activateRequest = filterUndefined(activateRequestWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(activateRequest), ctx, log);
  }

  async isActivated(): Promise<boolean> {
    const method = 'is_activated';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({}));

    const argsWithUndefined: Req['IsActivated.Request'] = {
      method,
    };

    const args = filterUndefined(argsWithUndefined);

    const result = await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
    return result;
  }

  async getPaywall(options: GetPaywallOptions): Promise<AdaptyPaywall> {
    const method = 'get_paywall';
    const optionsWithDefault = mergeOptions<GetPaywallOptionsWithDefaults>(options, this.options[method]);
    const params = optionsWithDefault.params;

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ optionsWithDefault }));

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

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async getPaywallForDefaultAudience(options: GetPaywallForDefaultAudienceOptions): Promise<AdaptyPaywall> {
    const method = 'get_paywall_for_default_audience';
    const optionsWithDefault = mergeOptions<GetPaywallForDefaultAudienceOptionsWithDefaults>(
      options,
      this.options[method],
    );
    const params = optionsWithDefault.params;

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ optionsWithDefault }));

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

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async getPaywallProducts(options: { paywall: AdaptyPaywall }): Promise<AdaptyPaywallProduct[]> {
    const method = 'get_paywall_products';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const paywallCoder = new AdaptyPaywallCoder();

    const argsWithUndefined: Req['GetPaywallProducts.Request'] = {
      method,
      paywall: this.encodeWithLogging(paywallCoder, options.paywall, 'AdaptyPaywall', ctx),
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async getOnboarding(options: GetOnboardingOptions): Promise<AdaptyOnboarding> {
    const method = 'get_onboarding';
    const optionsWithDefault = mergeOptions<GetOnboardingOptionsWithDefaults>(options, this.options[method]);
    const params = optionsWithDefault.params;

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ optionsWithDefault }));

    const argsWithUndefined: Req['GetOnboarding.Request'] = {
      method,
      placement_id: optionsWithDefault.placementId,
      locale: optionsWithDefault.locale,
      load_timeout: params.loadTimeoutMs / 1000,
      fetch_policy:
        params.fetchPolicy === 'return_cache_data_if_not_expired_else_load'
          ? { type: params.fetchPolicy, max_age: params.maxAgeSeconds }
          : { type: params.fetchPolicy },
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async getOnboardingForDefaultAudience(options: GetOnboardingForDefaultAudienceOptions): Promise<AdaptyOnboarding> {
    const method = 'get_onboarding_for_default_audience';
    const optionsWithDefault = mergeOptions<GetOnboardingForDefaultAudienceOptionsWithDefaults>(
      options,
      this.options[method],
    );
    const params = optionsWithDefault.params;

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ optionsWithDefault }));

    const argsWithUndefined: Req['GetOnboardingForDefaultAudience.Request'] = {
      method,
      placement_id: optionsWithDefault.placementId,
      locale: optionsWithDefault.locale,
      fetch_policy:
        params.fetchPolicy === 'return_cache_data_if_not_expired_else_load'
          ? { type: params.fetchPolicy, max_age: params.maxAgeSeconds }
          : { type: params.fetchPolicy ?? 'reload_revalidating_cache_data' },
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async getProfile(): Promise<AdaptyProfile> {
    const method = 'get_profile';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({}));

    const argsWithUndefined: Req['GetProfile.Request'] = {
      method,
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async identify(options: { customerUserId: string }): Promise<void> {
    const method = 'identify';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const argsWithUndefined: Req['Identify.Request'] = {
      method,
      customer_user_id: options.customerUserId,
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async logShowPaywall(options: { paywall: AdaptyPaywall }): Promise<void> {
    const method = 'log_show_paywall';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const paywallCoder = new AdaptyPaywallCoder();

    const argsWithUndefined: Req['LogShowPaywall.Request'] = {
      method,
      paywall: this.encodeWithLogging(paywallCoder, options.paywall, 'AdaptyPaywall', ctx),
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async openWebPaywall(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<void> {
    const method = 'open_web_paywall';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const paywallCoder = new AdaptyPaywallCoder();
    const productCoder = new AdaptyPaywallProductCoder();

    const argsWithUndefined: Req['OpenWebPaywall.Request'] = {
      method,
      ...(this.isPaywallProduct(options.paywallOrProduct)
        ? { product: this.encodeWithLogging(productCoder, options.paywallOrProduct, 'AdaptyPaywallProduct', ctx) }
        : { paywall: this.encodeWithLogging(paywallCoder, options.paywallOrProduct, 'AdaptyPaywall', ctx) }),
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async createWebPaywallUrl(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct }): Promise<string> {
    const method = 'create_web_paywall_url';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const paywallCoder = new AdaptyPaywallCoder();
    const productCoder = new AdaptyPaywallProductCoder();

    const argsWithUndefined: Req['CreateWebPaywallUrl.Request'] = {
      method,
      ...(this.isPaywallProduct(options.paywallOrProduct)
        ? { product: this.encodeWithLogging(productCoder, options.paywallOrProduct, 'AdaptyPaywallProduct', ctx) }
        : { paywall: this.encodeWithLogging(paywallCoder, options.paywallOrProduct, 'AdaptyPaywall', ctx) }),
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async logout(): Promise<void> {
    const method = 'logout';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({}));

    const argsWithUndefined: Req['Logout.Request'] = {
      method,
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async makePurchase(options: MakePurchaseOptions): Promise<AdaptyPurchaseResult> {
    const method = 'make_purchase';
    const params = options.params ?? {};

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const productCoder = new AdaptyPaywallProductCoder();
    const purchaseParamsCoder = new AdaptyPurchaseParamsCoder();

    const encodedProduct = this.encodeWithLogging(productCoder, options.product, 'AdaptyPaywallProduct', ctx);
    const productInput = productCoder.getInput(encodedProduct);
    const purchaseParams = this.encodeWithLogging(purchaseParamsCoder, params, 'AdaptyPurchaseParams', ctx);

    const argsWithUndefined: Req['MakePurchase.Request'] = {
      method,
      product: productInput,
      subscription_update_params: purchaseParams.subscription_update_params,
      is_offer_personalized: purchaseParams.is_offer_personalized,
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async presentCodeRedemptionSheet(): Promise<void> {
    const method = 'present_code_redemption_sheet';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({}));

    const argsWithUndefined: Req['PresentCodeRedemptionSheet.Request'] = {
      method,
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async reportTransaction(options: { transactionId: string; variationId?: string }): Promise<void> {
    const method = 'report_transaction';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const argsWithUndefined: Req['ReportTransaction.Request'] = {
      method,
      transaction_id: options.transactionId,
      variation_id: options.variationId,
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async restorePurchases(): Promise<AdaptyProfile> {
    const method = 'restore_purchases';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({}));

    const argsWithUndefined: Req['RestorePurchases.Request'] = {
      method,
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async setFallback(options: { fileLocation: FileLocation }): Promise<void> {
    const method = 'set_fallback';

    const platform = Capacitor.getPlatform();
    let fileLocationString: string;

    if (platform === 'ios') {
      fileLocationString = options.fileLocation.ios.fileName;
    } else if (platform === 'android') {
      // Add suffixes to distinguish resource types on Android
      if ('relativeAssetPath' in options.fileLocation.android) {
        fileLocationString = `${options.fileLocation.android.relativeAssetPath}a`;
      } else {
        fileLocationString = `${options.fileLocation.android.rawResName}r`;
      }
    } else {
      fileLocationString = '';
    }

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ platform, fileLocationString }));

    const argsWithUndefined: Req['SetFallback.Request'] = {
      method,
      asset_id: fileLocationString,
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async setIntegrationIdentifier(options: { key: string; value: string }): Promise<void> {
    const method = 'set_integration_identifiers';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const argsWithUndefined: Req['SetIntegrationIdentifier.Request'] = {
      method,
      key_values: { [options.key]: options.value },
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async setLogLevel(options: { logLevel?: LogLevel; logger?: LoggerConfig }): Promise<void> {
    const method = 'set_log_level';

    if (options.logger) {
      Log.configure(options.logger);
    }

    if (options.logLevel !== undefined) {
      const ctx = new LogContext();
      const log = ctx.call({ methodName: method });
      log.start(() => ({ options: { logLevel: options.logLevel } }));

      // Update log level immediately
      Log.logLevel = options.logLevel;

      const argsWithUndefined: Req['SetLogLevel.Request'] = {
        method,
        value: options.logLevel,
      };

      const args = filterUndefined(argsWithUndefined);

      await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
    }
  }

  async updateAttribution(options: { attribution: Record<string, any>; source: string }): Promise<void> {
    const method = 'update_attribution_data';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const argsWithUndefined: Req['UpdateAttributionData.Request'] = {
      method,
      attribution: JSON.stringify(options.attribution),
      source: options.source,
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async updateCollectingRefundDataConsent(options: { consent: boolean }): Promise<void> {
    const platform = Capacitor.getPlatform();
    if (platform === 'android') {
      return Promise.resolve();
    }

    const method = 'update_collecting_refund_data_consent';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const argsWithUndefined: Req['UpdateCollectingRefundDataConsent.Request'] = {
      method,
      consent: options.consent,
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async updateRefundPreference(options: { refundPreference: RefundPreference }): Promise<void> {
    const platform = Capacitor.getPlatform();
    if (platform === 'android') {
      return Promise.resolve();
    }

    const method = 'update_refund_preference';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const argsWithUndefined: Req['UpdateRefundPreference.Request'] = {
      method,
      refund_preference: options.refundPreference,
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  async updateProfile(options: { params: Partial<AdaptyProfileParameters> }): Promise<void> {
    const method = 'update_profile';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const profileParametersCoder = new AdaptyProfileParametersCoder();

    const argsWithUndefined: Req['UpdateProfile.Request'] = {
      method,
      params: this.encodeWithLogging(profileParametersCoder, options.params, 'AdaptyProfileParameters', ctx),
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  addListener(
    eventName: 'onLatestProfileLoad',
    listenerFunc: (data: { profile: AdaptyProfile }) => void,
  ): Promise<PluginListenerHandle> {
    return AdaptyCapacitorPlugin.addListener(eventName, (arg: any) => {
      const ctx = new LogContext();
      const log = ctx.event({ methodName: eventName });
      log.start({ raw: arg });

      try {
        if (!arg || typeof arg !== 'object' || !arg.data) {
          const error = new Error(
            `[Adapty] Invalid event format received. Expected {data: "json_string"}, got: ${JSON.stringify(arg)}`,
          );
          log.failed({ error });
          throw error;
        }

        const rawEventData: string = arg.data;

        if (typeof rawEventData === 'string') {
          try {
            const profile = parseCommonEvent('did_load_latest_profile', rawEventData, ctx) as AdaptyProfile | null;

            if (profile) {
              listenerFunc({ profile });
              log.success({ profile: 'ok' });
            } else {
              const err = new Error('[Adapty] Event data does not contain profile');
              log.failed({ error: err });
              throw err;
            }
          } catch (error) {
            log.failed({ error });
            throw error;
          }
        } else {
          const err = new Error(
            `[Adapty] Expected event data to be JSON string, got ${typeof rawEventData}: ${rawEventData}`,
          );
          log.failed({ error: err });
          throw err;
        }
      } catch (error) {
        log.failed({ error });
        throw error;
      }
    });
  }

  async removeAllListeners(): Promise<void> {
    // Remove all listeners through Capacitor plugin
    return AdaptyCapacitorPlugin.removeAllListeners();
  }
}
