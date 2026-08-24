// PluginListenerHandle is no longer referenced directly in this file
import { AdaptyError } from '@adapty/core';
import { Capacitor } from '@capacitor/core';

import { AdaptyEmitter } from './adapty-emitter';
import { AdaptyCapacitorPlugin } from './bridge/plugin';
import { coderFactory } from './coders/factory';
import { parseMethodResult, type AdaptyType } from './coders/parse';
import { defaultAdaptyOptions } from './default-configs';
import { Log, LogContext } from './logger';
import type { LoggerConfig, LogScope } from './logger';
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
  WebPresentation,
} from './types';
import type { AdaptyPlugin, AddListenerFn, EventPayloadMap } from './types/adapty-plugin';
import type { components } from './types/api';
import type {
  AdaptyDefaultOptions,
  GetFlowOptions,
  GetFlowOptionsWithDefaults,
  GetFlowForDefaultAudienceOptions,
  GetFlowForDefaultAudienceOptionsWithDefaults,
  MakePurchaseOptions,
  MakePromotedPurchaseOptions,
  GetOnboardingOptions,
  GetOnboardingOptionsWithDefaults,
  GetOnboardingForDefaultAudienceOptions,
  GetOnboardingForDefaultAudienceOptionsWithDefaults,
} from './types/configs';
import type { ActivateParamsInput, FileLocation, LogLevel, IdentifyParamsInput } from './types/inputs';
import type { MethodName } from './types/method-types';
import { filterUndefined, mergeOptions, withErrorContext } from './utils';
import VERSION from './version';

type Req = components['requests'];

/**
 * Entry point for the Adapty SDK.
 *
 * @remarks
 * This is the main Adapty class, excluding UI rendering functionality.
 *
 * @public
 */
export class Adapty implements AdaptyPlugin {
  constructor() {
    Log.setVersion(VERSION);

    // An App Store promoted purchase that nobody completes silently does
    // nothing — the store hands the product to the app and waits. So the
    // fallback is a real purchase, not a no-op. Registering any app listener
    // for the event replaces it.
    this.emitter.setFallback('onPromotedPurchaseReceived', ({ product }) =>
      this.makePromotedPurchase({ product }).catch((error) =>
        Log.warn(
          'onPromotedPurchaseReceived',
          () => `Failed to complete the promoted purchase automatically: ${error}`,
        ),
      ),
    );
  }

  private activating: Promise<void> | null = null;
  private resolveHeldActivation?: (() => Promise<void>) | null = null;
  private readonly emitter = new AdaptyEmitter();
  private nonWaitingMethods: MethodName[] = [
    'activate',
    'is_activated',
    'get_flow_for_default_audience',
    'get_onboarding_for_default_audience',
    'set_log_level',
    'set_fallback',
  ];
  private readonly options: AdaptyDefaultOptions = defaultAdaptyOptions;

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
   * @internal
   */
  public async handleMethodCall<M extends MethodName>(
    methodName: M,
    args: string,
    ctx: LogContext,
    log: LogScope,
    resultType: AdaptyType = 'Void',
  ): Promise<any> {
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

      const resultJson = result.crossPlatformJson;
      bridgeLog.success(() => ({ crossPlatformJson: resultJson }));

      const decoded = parseMethodResult<any>(resultJson, resultType, ctx);
      log.success(() => ({ result: decoded }));
      return decoded;
    } catch (error) {
      if (error instanceof AdaptyError) {
        log.failed(() => ({ error }));
        throw error;
      }

      bridgeLog.failed(() => ({ error }));
      if (error instanceof Error && !error.message.startsWith('{')) {
        log.failed(() => ({ error }));
        throw error;
      }

      // If JSON parsing fails, wrap the error
      const parseError = new Error(`Failed to parse native response: ${error}`);
      log.failed(() => ({ error: parseError }));
      throw parseError;
    }
  }

  private isPaywallProduct(obj: AdaptyFlowPaywall | AdaptyPaywallProduct): obj is AdaptyPaywallProduct {
    return 'vendorProductId' in obj;
  }

  /**
   * Initializes the Adapty SDK.
   *
   * @remarks
   * This method must be called in order for the SDK to work.
   * It is preferred to call it as early as possible in the app lifecycle,
   * so background activities can be performed and cache can be updated.
   *
   * @example
   * Usage with your user identifier from your system
   * ```typescript
   * await adapty.activate({
   *   apiKey: 'YOUR_PUBLIC_SDK_KEY',
   *   params: {
   *     customerUserId: 'YOUR_USER_ID'
   *   }
   * });
   * ```
   *
   * @param options - The activation options
   * @param options.apiKey - You can find it in your app settings in Adapty Dashboard App settings > General.
   * @param options.params - Optional activation parameters of type {@link ActivateParamsInput}.
   * @returns A promise that resolves when the SDK is activated.
   * @throws Error if the SDK is already activated or if the API key is invalid.
   */
  async activate(options: { apiKey: string; params?: ActivateParamsInput }): Promise<void> {
    const { apiKey, params = {} } = options;

    // Validate API key
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error('API key is required and must be a non-empty string');
    }

    // Eager, and before any early return: both native bridges only deliver an
    // event while JS holds a listener, so the SDK has to hold one from
    // activation onward or the promoted purchase never reaches JS and there is
    // nothing for the default to react to. Every early return below — an
    // activation already in flight, the fast-refresh short circuit, the
    // deferred-activation path — skips performActivation, so installing it
    // there would leave those paths deaf to the event.
    await this.startObservingPromotedPurchases();

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

  /**
   * Subscribes the SDK itself to the promoted-purchase event.
   *
   * A failure here must not fail activation: the app still works, it just loses
   * the automatic completion of App Store promoted purchases.
   */
  private async startObservingPromotedPurchases(): Promise<void> {
    try {
      await this.emitter.startObserving('onPromotedPurchaseReceived');
    } catch (error) {
      Log.warn('activate', () => `Failed to observe promoted purchases: ${error}`);
    }
  }

  private async performActivation(apiKey: string, params: ActivateParamsInput): Promise<void> {
    const method = 'activate';

    // Set log level before creating LogContext
    const logLevel = params.logLevel;
    Log.logLevel = logLevel || null;

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ apiKey, params }));

    const configurationCoder = coderFactory.createConfigurationCoder();
    const configuration = configurationCoder.encode(apiKey, params);

    const activateRequestWithUndefined: Req['Activate.Request'] = {
      method,
      configuration,
    };

    const activateRequest = filterUndefined(activateRequestWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(activateRequest), ctx, log);
  }

  /**
   * Checks if the Adapty SDK is activated.
   *
   * @returns A promise that resolves to `true` if the SDK is activated, `false` otherwise.
   * @throws Error if an error occurs while checking activation status.
   */
  async isActivated(): Promise<boolean> {
    const method = 'is_activated';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({}));

    const argsWithUndefined: Req['IsActivated.Request'] = {
      method,
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log, 'Boolean');
  }

  /**
   * Gets the current installation status.
   *
   * @remarks
   * Installation status provides information about when the app was installed,
   * how many times it has been launched, and other installation-related details.
   * The status can be "not_available", "not_determined", or "determined" with details.
   *
   * @returns A promise that resolves with the installation status.
   * @throws Error if an error occurs while retrieving the installation status.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   const status = await adapty.getCurrentInstallationStatus();
   *   if (status.status === 'determined') {
   *     console.log('Install time:', status.details.installTime);
   *     console.log('Launch count:', status.details.appLaunchCount);
   *   }
   * } catch (error) {
   *   console.error('Failed to get installation status:', error);
   * }
   * ```
   */
  async getCurrentInstallationStatus(): Promise<AdaptyInstallationStatus> {
    const method = 'get_current_installation_status';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({}));

    const argsWithUndefined: Req['GetCurrentInstallationStatus.Request'] = {
      method,
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log, 'AdaptyInstallationStatus');
  }

  /**
   * Fetches the flow by the specified placement.
   *
   * @remarks
   * With Adapty, you can remotely configure the products and offers in your app
   * by simply adding them to flows – no need for hardcoding them.
   * The only thing you hardcode is the placement ID.
   * This flexibility allows you to easily update flows, products, and offers,
   * or run A/B tests, all without the need for a new app release.
   *
   * @param options - The options for fetching the flow
   * @param options.placementId - The identifier of the desired placement. This is the value you specified when creating a placement in the Adapty Dashboard.
   * @param options.params - Optional. Additional parameters for fetching the flow, including fetch policy and load timeout.
   * @returns A promise that resolves with the requested {@link AdaptyFlow}.
   * @throws Error if the flow with the specified ID is not found or if your bundle ID does not match with your Adapty Dashboard setup.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   const flow = await adapty.getFlow({
   *     placementId: 'YOUR_PLACEMENT_ID',
   *   });
   *   console.log('Flow fetched successfully');
   * } catch (error) {
   *   console.error('Failed to fetch flow:', error);
   * }
   * ```
   */
  async getFlow(options: GetFlowOptions): Promise<AdaptyFlow> {
    const method = 'get_flow';
    const optionsWithDefault = mergeOptions<GetFlowOptionsWithDefaults>(options, this.options[method]);
    const params = optionsWithDefault.params;

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ optionsWithDefault }));

    const argsWithUndefined: Req['GetFlow.Request'] = {
      method,
      placement_id: optionsWithDefault.placementId,
      load_timeout: params.loadTimeoutMs / 1000,
      fetch_policy:
        params.fetchPolicy === 'return_cache_data_if_not_expired_else_load'
          ? { type: params.fetchPolicy, max_age: params.maxAgeSeconds }
          : { type: params.fetchPolicy },
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log, 'AdaptyFlow');
  }

  /**
   * Fetches the flow of the specified placement for the **All Users** audience.
   *
   * @remarks
   * With Adapty, you can remotely configure the products and offers in your app
   * by simply adding them to flows – no need for hardcoding them.
   * The only thing you hardcode is the placement ID.
   *
   * However, it's crucial to understand that the recommended approach is to fetch the flow
   * through the placement ID by the {@link getFlow} method.
   * The `getFlowForDefaultAudience` method should be a last resort due to its significant drawbacks:
   * - Potential backward compatibility issues
   * - Loss of targeting (all users see the same flow)
   *
   * See {@link https://docs.adapty.io/docs/capacitor-get-pb-paywalls#get-a-paywall-for-a-default-audience-to-fetch-it-faster | documentation} for more details.
   *
   * @param options - The options for fetching the flow
   * @param options.placementId - The identifier of the desired placement.
   * @param options.params - Optional. Additional parameters for fetching the flow.
   * @returns A promise that resolves with the requested {@link AdaptyFlow}.
   * @throws Error if the flow with the specified ID is not found.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   const flow = await adapty.getFlowForDefaultAudience({
   *     placementId: 'YOUR_PLACEMENT_ID',
   *   });
   * } catch (error) {
   *   console.error('Failed to fetch flow:', error);
   * }
   * ```
   */
  async getFlowForDefaultAudience(options: GetFlowForDefaultAudienceOptions): Promise<AdaptyFlow> {
    const method = 'get_flow_for_default_audience';
    const optionsWithDefault = mergeOptions<GetFlowForDefaultAudienceOptionsWithDefaults>(
      options,
      this.options[method],
    );
    const params = optionsWithDefault.params;

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ optionsWithDefault }));

    const argsWithUndefined: Req['GetFlowForDefaultAudience.Request'] = {
      method,
      placement_id: optionsWithDefault.placementId,
      fetch_policy:
        params.fetchPolicy === 'return_cache_data_if_not_expired_else_load'
          ? { type: params.fetchPolicy, max_age: params.maxAgeSeconds }
          : { type: params.fetchPolicy ?? 'reload_revalidating_cache_data' },
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log, 'AdaptyFlow');
  }

  /**
   * Fetches a list of products associated with a provided flow.
   *
   * @param options - The options object
   * @param options.flow - A flow to fetch products for. You can get it using {@link getFlow} method.
   * @returns A promise that resolves with a list of {@link AdaptyPaywallProduct} associated with a provided flow.
   * @throws Error if an error occurs while fetching products.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   const flow = await adapty.getFlow({ placementId: 'YOUR_PLACEMENT_ID' });
   *   const products = await adapty.getPaywallProducts({ flow });
   *   console.log('Products:', products);
   * } catch (error) {
   *   console.error('Failed to fetch products:', error);
   * }
   * ```
   */
  async getPaywallProducts(options: { flow: AdaptyFlow }): Promise<AdaptyPaywallProduct[]> {
    const method = 'get_paywall_products';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const coder = coderFactory.createFlowCoder();

    const argsWithUndefined: Req['GetPaywallProducts.Request'] = {
      method,
      flow: this.encodeWithLogging(coder, options.flow, 'AdaptyFlow', ctx),
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log, 'Array<AdaptyPaywallProduct>');
  }

  /**
   * Fetches the onboarding by the specified placement.
   *
   * @deprecated Since 4.0.0. Migrate onboardings to the Flow Builder API.
   *
   * @remarks
   * When you create an onboarding with the no-code builder, it's stored as a container with configuration
   * that your app needs to fetch and display. This container manages the entire experience - what content appears,
   * how it's presented, and how user interactions are processed.
   *
   * @param options - The options for fetching the onboarding
   * @param options.placementId - The identifier of the desired placement.
   * @param options.locale - Optional. The identifier of the onboarding localization. Default: `'en'`.
   * @param options.params - Optional. Additional parameters for fetching the onboarding.
   * @returns A promise that resolves with the requested {@link AdaptyOnboarding}.
   * @throws Error if the onboarding with the specified ID is not found.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   const onboarding = await adapty.getOnboarding({
   *     placementId: 'YOUR_PLACEMENT_ID',
   *     locale: 'en',
   *     params: {
   *       fetchPolicy: 'reload_revalidating_cache_data',
   *       loadTimeoutMs: 5000
   *     }
   *   });
   *   console.log('Onboarding fetched successfully');
   * } catch (error) {
   *   console.error('Failed to fetch onboarding:', error);
   * }
   * ```
   */
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

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log, 'AdaptyOnboarding');
  }

  /**
   * Fetches the onboarding of the specified placement for the **All Users** audience.
   *
   * @deprecated Since 4.0.0. Migrate onboardings to the Flow Builder API.
   *
   * @remarks
   * It's crucial to understand that the recommended approach is to fetch the onboarding
   * by the {@link getOnboarding} method. The `getOnboardingForDefaultAudience` method
   * should be used only if faster fetching outweighs the drawbacks:
   * - Potential backward compatibility issues
   * - Loss of personalization (no targeting based on country, attribution, or custom attributes)
   *
   * @param options - The options for fetching the onboarding
   * @param options.placementId - The identifier of the desired placement.
   * @param options.locale - Optional. The identifier of the onboarding localization. Default: `'en'`.
   * @param options.params - Optional. Additional parameters for fetching the onboarding.
   * @returns A promise that resolves with the requested {@link AdaptyOnboarding}.
   * @throws Error if the onboarding with the specified ID is not found.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   const onboarding = await adapty.getOnboardingForDefaultAudience({
   *     placementId: 'YOUR_PLACEMENT_ID',
   *     locale: 'en',
   *   });
   * } catch (error) {
   *   console.error('Failed to fetch onboarding:', error);
   * }
   * ```
   */
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

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log, 'AdaptyOnboarding');
  }

  /**
   * Fetches a user profile.
   *
   * @remarks
   * The getProfile method provides the most up-to-date result
   * as it always tries to query the API.
   * If for some reason (e.g. no internet connection),
   * the Adapty SDK fails to retrieve information from the server,
   * the data from cache will be returned.
   * It is also important to note
   * that the Adapty SDK updates {@link AdaptyProfile} cache
   * on a regular basis, in order
   * to keep this information as up-to-date as possible.
   *
   * @returns A promise that resolves with the user's {@link AdaptyProfile}.
   * @throws Error if an error occurs while fetching the profile.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   const profile = await adapty.getProfile();
   *   const isSubscribed = profile.accessLevels['YOUR_ACCESS_LEVEL']?.isActive;
   *   if (isSubscribed) {
   *     console.log('User has access to premium features');
   *   }
   * } catch (error) {
   *   console.error('Failed to get profile:', error);
   * }
   * ```
   */
  async getProfile(): Promise<AdaptyProfile> {
    const method = 'get_profile';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({}));

    const argsWithUndefined: Req['GetProfile.Request'] = {
      method,
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log, 'AdaptyProfile');
  }

  /**
   * Logs in a user with a provided customerUserId.
   *
   * @remarks
   * If you don't have a user id on SDK initialization,
   * you can set it later at any time with this method.
   * The most common cases are after registration/authorization
   * when the user switches from being an anonymous user to an authenticated user.
   *
   * @param options - The identification options
   * @param options.customerUserId - A unique user identifier.
   * @param options.params - Optional. Additional parameters for identification, including platform-specific settings.
   * @returns A promise that resolves when identification is complete.
   * @throws Error if an error occurs during identification.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   await adapty.identify({ customerUserId: 'YOUR_USER_ID' });
   *   console.log('User identified successfully');
   * } catch (error) {
   *   console.error('Failed to identify user:', error);
   * }
   * ```
   */
  async identify(options: { customerUserId: string; params?: IdentifyParamsInput }): Promise<void> {
    const method = 'identify';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const identifyParamsCoder = coderFactory.createIdentifyParamsCoder();
    const parameters = identifyParamsCoder.encode(options.params);

    const argsWithUndefined: Req['Identify.Request'] = {
      method,
      customer_user_id: options.customerUserId,
      parameters,
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  /**
   * Logs a flow view event.
   *
   * @remarks
   * Adapty helps you to measure the performance of the flows.
   * We automatically collect all the metrics related to purchases except for custom flow views.
   * This is because only you know when the flow was shown to a customer.
   *
   * Whenever you show a flow to your user,
   * call this function to log the event,
   * and it will be accumulated in the flow metrics.
   *
   * @param options - The options object
   * @param options.flow - The flow object that was shown to the user.
   * @returns A promise that resolves when the event is logged.
   * @throws Error if an error occurs while logging the event.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * const flow = await adapty.getFlow({ placementId: 'YOUR_PLACEMENT_ID' });
   * // ...after opening the flow
   * await adapty.logShowFlow({ flow });
   * ```
   */
  async logShowFlow(options: { flow: AdaptyFlow }): Promise<void> {
    const method = 'log_show_flow';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const coder = coderFactory.createFlowCoder();

    const argsWithUndefined: Req['LogShowFlow.Request'] = {
      method,
      flow: this.encodeWithLogging(coder, options.flow, 'AdaptyFlow', ctx),
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  /**
   * Opens a web paywall in the default browser.
   *
   * @param options - The options object
   * @param options.paywallOrProduct - The flow paywall or product to open as a web paywall.
   * @param options.openIn - Optional. Where to open the web paywall ({@link WebPresentation}).
   * @returns A promise that resolves when the web paywall is opened.
   * @throws Error if an error occurs while opening the web paywall.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   const flow = await adapty.getFlow({ placementId: 'YOUR_PLACEMENT_ID' });
   *   await adapty.openWebPaywall({ paywallOrProduct: flow.paywalls[0] });
   * } catch (error) {
   *   console.error('Failed to open web paywall:', error);
   * }
   * ```
   */
  async openWebPaywall(options: {
    paywallOrProduct: AdaptyFlowPaywall | AdaptyPaywallProduct;
    openIn?: WebPresentation;
  }): Promise<void> {
    const method = 'open_web_paywall';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const flowPaywallCoder = coderFactory.createFlowPaywallCoder();
    const productCoder = coderFactory.createPaywallProductCoder();

    const argsWithUndefined: Req['OpenWebPaywall.Request'] = {
      method,
      ...(this.isPaywallProduct(options.paywallOrProduct)
        ? { product: this.encodeWithLogging(productCoder, options.paywallOrProduct, 'AdaptyPaywallProduct', ctx) }
        : { paywall: this.encodeWithLogging(flowPaywallCoder, options.paywallOrProduct, 'AdaptyFlowPaywall', ctx) }),
      ...(options.openIn ? { open_in: options.openIn } : {}),
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  /**
   * Creates a URL for a web paywall.
   *
   * @remarks
   * This method generates a URL that can be used to open a web version of the paywall.
   * You can use this URL in a custom web view or a browser.
   *
   * @param options - The options object
   * @param options.paywallOrProduct - The flow paywall or product to create a URL for.
   * @returns A promise that resolves with the web paywall URL.
   * @throws Error if an error occurs while creating the URL.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   const flow = await adapty.getFlow({ placementId: 'YOUR_PLACEMENT_ID' });
   *   const url = await adapty.createWebPaywallUrl({ paywallOrProduct: flow.paywalls[0] });
   *   console.log('Web paywall URL:', url);
   * } catch (error) {
   *   console.error('Failed to create web paywall URL:', error);
   * }
   * ```
   */
  async createWebPaywallUrl(options: { paywallOrProduct: AdaptyFlowPaywall | AdaptyPaywallProduct }): Promise<string> {
    const method = 'create_web_paywall_url';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const flowPaywallCoder = coderFactory.createFlowPaywallCoder();
    const productCoder = coderFactory.createPaywallProductCoder();

    const argsWithUndefined: Req['CreateWebPaywallUrl.Request'] = {
      method,
      ...(this.isPaywallProduct(options.paywallOrProduct)
        ? { product: this.encodeWithLogging(productCoder, options.paywallOrProduct, 'AdaptyPaywallProduct', ctx) }
        : { paywall: this.encodeWithLogging(flowPaywallCoder, options.paywallOrProduct, 'AdaptyFlowPaywall', ctx) }),
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log, 'String');
  }

  /**
   * Opens a URL using the native browser.
   *
   * @remarks
   * Backs the default `onUrlPress` flow handler. Call it directly from a custom
   * `onUrlPress` handler when you want to run your own logic but keep the native
   * open-URL behavior. `openIn`: `browser_out_app` → external browser,
   * `browser_in_app` → in-app browser.
   *
   * @param options - The options object
   * @param options.url - The URL to open.
   * @param options.openIn - Optional. How to present the URL ({@link WebPresentation}). When omitted, the native SDK decides.
   * @returns A promise that resolves when the URL is opened.
   * @throws Error if an error occurs while opening the URL.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   await adapty.openWebUrl({ url: 'https://example.com' });
   * } catch (error) {
   *   console.error('Failed to open URL:', error);
   * }
   * ```
   */
  async openWebUrl(options: { url: string; openIn?: WebPresentation }): Promise<void> {
    const method = 'adapty_ui_open_url';
    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const argsWithUndefined: Req['AdaptyUIOpenUrl.Request'] = {
      method,
      url: options.url,
      ...(options.openIn ? { open_in: options.openIn } : {}),
    };
    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  /**
   * Requests the native app-review prompt.
   *
   * @remarks
   * Uses `SKStoreReviewController` on iOS and In-App Review on Android. Backs the
   * default `onRequestAppReview` flow handler. Call it directly from a custom
   * `onRequestAppReview` handler when you want to run your own logic but keep the
   * native prompt.
   *
   * @returns A promise that resolves when the native call completes.
   * @throws Error if an error occurs while requesting the app review.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   await adapty.requestAppReview();
   * } catch (error) {
   *   console.error('Failed to request app review:', error);
   * }
   * ```
   */
  async requestAppReview(): Promise<void> {
    const method = 'adapty_ui_request_app_review';
    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({}));

    const args: Req['AdaptyUIRequestAppReview.Request'] = { method };

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  /**
   * Logs out the current user.
   *
   * @remarks
   * You can then login the user using {@link identify} method.
   *
   * @returns A promise that resolves when the user is logged out.
   * @throws Error if an error occurs during logout.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   await adapty.logout();
   *   console.log('User logged out successfully');
   * } catch (error) {
   *   console.error('Failed to logout user:', error);
   * }
   * ```
   */
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

  /**
   * Performs a purchase of the specified product.
   *
   * @remarks
   * In paywalls built with Paywall Builder, purchases are processed automatically with no additional code.
   *
   * @param options - The purchase options
   * @param options.product - The product to be purchased. You can get it using {@link getPaywallProducts} method.
   * @param options.params - Optional. Additional parameters for the purchase, including Android subscription update params.
   * @returns A promise that resolves with the {@link AdaptyPurchaseResult} object containing details about the purchase.
   * If the result is `'success'`, it also includes the updated user's profile.
   * @throws Error if an error occurs during the purchase process.
   *
   * @example
   * Basic purchase
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   const result = await adapty.makePurchase({ product });
   *
   *   if (result.type === 'success') {
   *     const isSubscribed = result.profile?.accessLevels['YOUR_ACCESS_LEVEL']?.isActive;
   *     if (isSubscribed) {
   *       console.log('User is now subscribed!');
   *     }
   *   }
   * } catch (error) {
   *   console.error('Purchase failed:', error);
   * }
   * ```
   */
  async makePurchase(options: MakePurchaseOptions): Promise<AdaptyPurchaseResult> {
    const method = 'make_purchase';
    const params = options.params ?? {};

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const productCoder = coderFactory.createPaywallProductCoder();
    const purchaseParamsCoder = coderFactory.createPurchaseParamsCoder();

    const encodedProduct = this.encodeWithLogging(productCoder, options.product, 'AdaptyPaywallProduct', ctx);
    const productInput = productCoder.getInput(encodedProduct);
    const purchaseParams = this.encodeWithLogging(purchaseParamsCoder, params, 'AdaptyPurchaseParams', ctx);

    const argsWithUndefined: Req['MakePurchase.Request'] = {
      method,
      product: productInput,
      parameters: purchaseParams,
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log, 'AdaptyPurchaseResult');
  }

  /**
   * Purchases a product promoted in the App Store.
   *
   * @remarks
   * Use this with the product delivered by the `'onPromotedPurchaseReceived'`
   * event. Unlike {@link makePurchase}, a promoted product carries no paywall
   * context, so no purchase parameters are accepted.
   *
   * @param options - The purchase options
   * @param options.product - The promoted product to purchase.
   * @returns A promise that resolves with the {@link AdaptyPurchaseResult} object.
   * @throws Error if an error occurs during the purchase process.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * await adapty.addListener('onPromotedPurchaseReceived', async ({ product }) => {
   *   await adapty.makePromotedPurchase({ product });
   * });
   * ```
   */
  async makePromotedPurchase(options: MakePromotedPurchaseOptions): Promise<AdaptyPurchaseResult> {
    const method = 'make_promoted_purchase';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const productCoder = coderFactory.createPromotedProductCoder();

    const encodedProduct = this.encodeWithLogging(productCoder, options.product, 'AdaptyPromotedProduct', ctx);
    const productInput = productCoder.getInput(encodedProduct);

    const argsWithUndefined: Req['MakePromotedPurchase.Request'] = {
      method,
      product: productInput,
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log, 'AdaptyPurchaseResult');
  }

  /**
   * Opens a native modal screen to redeem Apple Offer Codes.
   *
   * @remarks
   * iOS 14+ only. Since iOS 14.0, your users can redeem Offer Codes.
   * To enable users to redeem offer codes, you can display the offer code redemption sheet.
   *
   * @returns A promise that resolves when the redemption sheet is presented.
   * @throws Error if an error occurs or if called on Android.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   await adapty.presentCodeRedemptionSheet();
   * } catch (error) {
   *   console.error('Failed to present code redemption sheet:', error);
   * }
   * ```
   */
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

  /**
   * Sets the variation ID of the purchase.
   *
   * @remarks
   * In Observer mode, Adapty SDK doesn't know where the purchase was made from.
   * you can manually assign variation to the purchase.
   * After doing this, you'll be able to see metrics in Adapty Dashboard.
   *
   * @param options - The options object
   * @param options.transactionId - The transaction ID of the purchase.
   * @param options.variationId - Optional. The variation ID from the {@link AdaptyFlow}.
   * @returns A promise that resolves when the transaction is reported.
   * @throws Error if an error occurs while reporting the transaction.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   await adapty.reportTransaction({
   *     transactionId: 'transaction_123',
   *     variationId: 'variation_456'
   *   });
   * } catch (error) {
   *   console.error('Failed to report transaction:', error);
   * }
   * ```
   */
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

  /**
   * Restores user purchases and updates the profile.
   *
   * @remarks
   * Restoring purchases allows users to regain access to previously purchased content,
   * such as subscriptions or in-app purchases, without being charged again.
   * This feature is especially useful for users who may have uninstalled and reinstalled the app
   * or switched to a new device.
   *
   * In paywalls built with Paywall Builder, purchases are restored automatically without additional code from you.
   *
   * @returns A promise that resolves with the updated user's {@link AdaptyProfile}.
   * @throws Error if an error occurs during the restore process.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   const profile = await adapty.restorePurchases();
   *   const isSubscribed = profile.accessLevels['YOUR_ACCESS_LEVEL']?.isActive;
   *
   *   if (isSubscribed) {
   *     console.log('Access restored successfully!');
   *   } else {
   *     console.log('No active subscriptions found');
   *   }
   * } catch (error) {
   *   console.error('Failed to restore purchases:', error);
   * }
   * ```
   */
  async restorePurchases(): Promise<AdaptyProfile> {
    const method = 'restore_purchases';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({}));

    const argsWithUndefined: Req['RestorePurchases.Request'] = {
      method,
    };

    const args = filterUndefined(argsWithUndefined);

    return await this.handleMethodCall(method, JSON.stringify(args), ctx, log, 'AdaptyProfile');
  }

  /**
   * Sets the fallback paywalls.
   *
   * @remarks
   * Fallback file will be used if the SDK fails
   * to fetch the paywalls from the dashboard.
   * It is not designed to be used for the offline flow,
   * as products are not cached in Adapty.
   *
   * @param options - The options object
   * @param options.fileLocation - The location of the fallback file for each platform.
   * @returns A promise that resolves when fallback placements are saved.
   * @throws Error if an error occurs while setting the fallback.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   await adapty.setFallback({
   *     fileLocation: {
   *       ios: { fileName: 'fallback_paywalls.json' },
   *       android: { relativeAssetPath: 'fallback_paywalls.json' }
   *     }
   *   });
   * } catch (error) {
   *   console.error('Failed to set fallback:', error);
   * }
   * ```
   */
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

  /**
   * Sets an integration identifier for the current user.
   *
   * @remarks
   * Integration identifiers can be used to link Adapty profiles to external systems
   * and track users across different platforms.
   *
   * @param options - The options object
   * @param options.key - The key of the integration identifier.
   * @param options.value - The value of the integration identifier.
   * @returns A promise that resolves when the integration identifier is set.
   * @throws Error if an error occurs while setting the identifier.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   await adapty.setIntegrationIdentifier({
   *     key: 'firebase_app_instance_id',
   *     value: 'YOUR_FIREBASE_ID'
   *   });
   * } catch (error) {
   *   console.error('Failed to set integration identifier:', error);
   * }
   * ```
   */
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

  /**
   * Sets the preferred log level and/or custom logger configuration.
   *
   * @remarks
   * By default, the log level is set to `error`.
   *
   * There are four levels available:
   * - `error`: only errors will be logged
   * - `warn`: messages from the SDK that do not cause critical errors, but are worth paying attention to
   * - `info`: various information messages, such as those that log the lifecycle of various modules
   * - `verbose`: any additional information that may be useful during debugging, such as function calls, API queries, etc.
   *
   * @param options - The options object
   * @param options.logLevel - Optional. The new preferred log level.
   * @param options.logger - Optional. Custom logger configuration.
   * @returns A promise that resolves when the log level is set.
   * @throws Error if the log level is invalid.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * // Set log level
   * await adapty.setLogLevel({ logLevel: 'verbose' });
   *
   * // Or set custom logger
   * await adapty.setLogLevel({
   *   logger: {
   *     handler: (level, scope, message, data) => {
   *       sendLogToYourServer(`[${level}] ${message}`, data);
   *     }
   *   }
   * });
   * ```
   */
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

  /**
   * Updates attribution data from an external attribution provider
   * for the current user.
   *
   * @remarks
   * Attribution data can be used to track marketing campaigns and user acquisition sources.
   * Renamed from `updateAttribution` in 4.1.0 to match the native SDKs;
   * the second field is now the provider name.
   *
   * @param options - The options object
   * @param options.attribution - An object containing attribution data.
   * @param options.provider - The attribution provider the data came from (e.g., 'adjust', 'appsflyer').
   * @returns A promise that resolves when the attribution data is updated.
   * @throws Error if parameters are invalid or not provided.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   const attribution = {
   *     'Adjust Adid': 'adjust_adid',
   *     'Adjust Network': 'adjust_network',
   *     'Adjust Campaign': 'adjust_campaign',
   *     'Adjust Adgroup': 'adjust_adgroup',
   *   };
   *
   *   await adapty.updateExternalAttribution({ attribution, provider: 'adjust' });
   * } catch (error) {
   *   console.error('Failed to update attribution:', error);
   * }
   * ```
   */
  async updateExternalAttribution(options: { attribution: Record<string, any>; provider: string }): Promise<void> {
    const method = 'update_external_attribution_data';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const argsWithUndefined: Req['UpdateExternalAttributionData.Request'] = {
      method,
      attribution: JSON.stringify(options.attribution),
      provider: options.provider,
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  /**
   * Updates the user's consent for collecting refund data.
   *
   * @remarks
   * iOS only. This method has no effect on Android.
   * Use this method to update whether the SDK should collect refund data for the user.
   *
   * @param options - The options object
   * @param options.consent - Whether to collect refund data.
   * @returns A promise that resolves when the consent is updated (or immediately on Android).
   * @throws Error if an error occurs on iOS.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   await adapty.updateCollectingRefundDataConsent({ consent: true });
   * } catch (error) {
   *   console.error('Failed to update consent:', error);
   * }
   * ```
   */
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

  /**
   * Updates the user's refund preference.
   *
   * @remarks
   * iOS only. This method has no effect on Android.
   * Use this method to set the user's preference for handling refunds.
   *
   * @param options - The options object
   * @param options.refundPreference - The refund preference setting.
   * @returns A promise that resolves when the preference is updated (or immediately on Android).
   * @throws Error if an error occurs on iOS.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   await adapty.updateRefundPreference({ refundPreference: 'ask_to_cancel' });
   * } catch (error) {
   *   console.error('Failed to update refund preference:', error);
   * }
   * ```
   */
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

  /**
   * Updates a profile for the current user.
   *
   * @remarks
   * You can set optional attributes such as email, phone number, etc. to the user of your app.
   * You can then use attributes to create user segments or just view them in CRM.
   *
   * The attributes that you've previously set won't be reset.
   * Custom attributes can be removed by passing `null` as their values.
   *
   * @param options - An object of parameters to update. Partial {@link AdaptyProfileParameters}.
   * @returns A promise that resolves when the profile is updated.
   * @throws Error if parameters are invalid or there is a network error.
   *
   * @example
   * Basic profile update
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * try {
   *   await adapty.updateProfile({
   *     email: 'email@email.com',
   *     phoneNumber: '+18888888888',
   *     firstName: 'John',
   *     lastName: 'Appleseed',
   *     gender: 'other',
   *     birthday: new Date().toISOString(),
   *   });
   *   console.log('Profile updated successfully');
   * } catch (error) {
   *   console.error('Failed to update profile:', error);
   * }
   * ```
   *
   * @example
   * Custom attributes
   * ```typescript
   * await adapty.updateProfile({
   *   codableCustomAttributes: {
   *     key_1: 'value_1',
   *     key_2: 2,
   *   },
   * });
   *
   * // To remove keys, pass null as their values
   * await adapty.updateProfile({
   *   codableCustomAttributes: {
   *     key_1: null,
   *   },
   * });
   * ```
   */
  async updateProfile(options: Partial<AdaptyProfileParameters>): Promise<void> {
    const method = 'update_profile';

    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    log.start(() => ({ options }));

    const profileParametersCoder = coderFactory.createProfileParametersCoder();

    const argsWithUndefined: Req['UpdateProfile.Request'] = {
      method,
      params: this.encodeWithLogging(profileParametersCoder, options, 'AdaptyProfileParameters', ctx),
    };

    const args = filterUndefined(argsWithUndefined);

    await this.handleMethodCall(method, JSON.stringify(args), ctx, log);
  }

  /**
   * Adds an event listener for SDK events.
   *
   * Supported events:
   * - onLatestProfileLoad → { profile: AdaptyProfile }
   * - onPromotedPurchaseReceived → { product: AdaptyPromotedProduct }
   * - onInstallationDetailsSuccess → { details: AdaptyInstallationDetails }
   * - onInstallationDetailsFail → { error: AdaptyError }
   *
   * @remarks
   * Registering a listener for `'onPromotedPurchaseReceived'` replaces the
   * SDK's default behaviour, which is to complete the purchase automatically.
   * While a listener is registered you are responsible for completing the
   * purchase — call {@link Adapty.makePromotedPurchase} with the product
   * you receive, or the purchase never happens. Removing the returned handle
   * restores the default.
   *
   * @param eventName - The name of the event to listen to.
   * @param listenerFunc - The function to call when the event occurs.
   * @returns A listener handle that can be used to remove the listener.
   *
   * @example
   * Listen to profile updates
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * const listener = adapty.addListener('onLatestProfileLoad', (profile) => {
   *   console.log('Profile updated:', profile);
   *   const isSubscribed = profile.accessLevels['YOUR_ACCESS_LEVEL']?.isActive;
   *   if (isSubscribed) {
   *     console.log('User has premium access');
   *   }
   * });
   *
   * // Later, remove the listener
   * listener.remove();
   * ```
   */
  public addListener: AddListenerFn = <T extends keyof EventPayloadMap>(
    eventName: T,
    listenerFunc: (data: EventPayloadMap[T]) => void,
  ) => {
    const wrappedListener = withErrorContext(listenerFunc, eventName, 'Adapty');
    return this.emitter.addListener(eventName, wrappedListener);
  };

  /**
   * Removes all attached event listeners.
   *
   * @remarks
   * This method removes all event listeners that were added via {@link addListener}.
   * It's recommended to call this method when cleaning up resources,
   * such as when unmounting a component.
   *
   * The SDK's own subscriptions are not app-owned and are re-created right
   * after the teardown, so App Store promoted purchases keep being completed
   * automatically. Your own `'onPromotedPurchaseReceived'` listener, however,
   * is dropped with the rest, and that SDK default resumes in its place —
   * re-register the listener if the app still owns completion.
   *
   * @returns A promise that resolves when all listeners are removed.
   *
   * @example
   * ```typescript
   * import { adapty } from '@adapty/capacitor';
   *
   * // Remove all listeners
   * await adapty.removeAllListeners();
   * ```
   */
  async removeAllListeners(): Promise<void> {
    await this.emitter.removeAllListeners();
  }
}
