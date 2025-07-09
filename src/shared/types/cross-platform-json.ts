import type { components } from './api';

/**
 * Type-safe wrapper for cross-platform JSON responses from native side
 */
export interface CrossPlatformResponse<T = unknown> {
  success?: T;
  error?: components['defs']['AdaptyError'];
}

/**
 * Extract all method names from request types
 */
export type MethodName = 
  | 'activate'
  | 'adapty_ui_create_paywall_view'
  | 'adapty_ui_dismiss_paywall_view' 
  | 'adapty_ui_present_paywall_view'
  | 'adapty_ui_show_dialog'
  | 'adapty_ui_create_onboarding_view'
  | 'adapty_ui_dismiss_onboarding_view'
  | 'adapty_ui_present_onboarding_view'
  | 'get_paywall'
  | 'get_paywall_for_default_audience'
  | 'get_paywall_products'
  | 'get_onboarding'
  | 'get_onboarding_for_default_audience'
  | 'get_profile'
  | 'identify'
  | 'is_activated'
  | 'get_log_level'
  | 'set_log_level'
  | 'logout'
  | 'log_show_onboarding'
  | 'log_show_paywall'
  | 'make_purchase'
  | 'open_web_paywall'
  | 'create_web_paywall_url'
  | 'present_code_redemption_sheet'
  | 'report_transaction'
  | 'restore_purchases'
  | 'get_sdk_version'
  | 'set_fallback'
  | 'set_integration_identifiers'
  | 'update_attribution_data'
  | 'update_collecting_refund_data_consent'
  | 'update_profile'
  | 'update_refund_preference';

/**
 * Get request type by method name
 */
export type RequestByMethod<M extends MethodName> = M extends 'activate'
  ? components['requests']['Activate.Request']
  : M extends 'get_paywall'
  ? components['requests']['GetPaywall.Request']
  : M extends 'get_paywall_for_default_audience'
  ? components['requests']['GetPaywallForDefaultAudience.Request']
  : M extends 'get_paywall_products'
  ? components['requests']['GetPaywallProducts.Request']
  : M extends 'get_onboarding'
  ? components['requests']['GetOnboarding.Request']
  : M extends 'get_onboarding_for_default_audience'
  ? components['requests']['GetOnboardingForDefaultAudience.Request']
  : M extends 'get_profile'
  ? components['requests']['GetProfile.Request']
  : M extends 'identify'
  ? components['requests']['Identify.Request']
  : M extends 'is_activated'
  ? components['requests']['IsActivated.Request']
  : M extends 'get_log_level'
  ? components['requests']['GetLogLevel.Request']
  : M extends 'set_log_level'
  ? components['requests']['SetLogLevel.Request']
  : M extends 'logout'
  ? components['requests']['Logout.Request']
  : M extends 'log_show_onboarding'
  ? components['requests']['LogShowOnboarding.Request']
  : M extends 'log_show_paywall'
  ? components['requests']['LogShowPaywall.Request']
  : M extends 'make_purchase'
  ? components['requests']['MakePurchase.Request']
  : M extends 'open_web_paywall'
  ? components['requests']['OpenWebPaywall.Request']
  : M extends 'create_web_paywall_url'
  ? components['requests']['CreateWebPaywallUrl.Request']
  : M extends 'present_code_redemption_sheet'
  ? components['requests']['PresentCodeRedemptionSheet.Request']
  : M extends 'report_transaction'
  ? components['requests']['ReportTransaction.Request']
  : M extends 'restore_purchases'
  ? components['requests']['RestorePurchases.Request']
  : M extends 'get_sdk_version'
  ? components['requests']['GetSDKVersion.Request']
  : M extends 'set_fallback'
  ? components['requests']['SetFallback.Request']
  : M extends 'set_integration_identifiers'
  ? components['requests']['SetIntegrationIdentifier.Request']
  : M extends 'update_attribution_data'
  ? components['requests']['UpdateAttributionData.Request']
  : M extends 'update_collecting_refund_data_consent'
  ? components['requests']['UpdateCollectingRefundDataConsent.Request']
  : M extends 'update_profile'
  ? components['requests']['UpdateProfile.Request']
  : M extends 'update_refund_preference'
  ? components['requests']['UpdateRefundPreference.Request']
  : never;

/**
 * Get response type by method name
 */
export type ResponseByMethod<M extends MethodName> = M extends 'activate'
  ? components['requests']['Activate.Response']
  : M extends 'get_paywall'
  ? components['requests']['GetPaywall.Response']
  : M extends 'get_paywall_for_default_audience'
  ? components['requests']['GetPaywallForDefaultAudience.Response']
  : M extends 'get_paywall_products'
  ? components['requests']['GetPaywallProducts.Response']
  : M extends 'get_onboarding'
  ? components['requests']['GetOnboarding.Response']
  : M extends 'get_onboarding_for_default_audience'
  ? components['requests']['GetOnboardingForDefaultAudience.Response']
  : M extends 'get_profile'
  ? components['requests']['GetProfile.Response']
  : M extends 'identify'
  ? components['requests']['Identify.Response']
  : M extends 'is_activated'
  ? components['requests']['IsActivated.Response']
  : M extends 'get_log_level'
  ? components['requests']['GetLogLevel.Response']
  : M extends 'set_log_level'
  ? components['requests']['SetLogLevel.Response']
  : M extends 'logout'
  ? components['requests']['Logout.Response']
  : M extends 'log_show_onboarding'
  ? components['requests']['LogShowOnboarding.Response']
  : M extends 'log_show_paywall'
  ? components['requests']['LogShowPaywall.Response']
  : M extends 'make_purchase'
  ? components['requests']['MakePurchase.Response']
  : M extends 'open_web_paywall'
  ? components['requests']['OpenWebPaywall.Response']
  : M extends 'create_web_paywall_url'
  ? components['requests']['CreateWebPaywallUrl.Response']
  : M extends 'present_code_redemption_sheet'
  ? components['requests']['PresentCodeRedemptionSheet.Response']
  : M extends 'report_transaction'
  ? components['requests']['ReportTransaction.Response']
  : M extends 'restore_purchases'
  ? components['requests']['RestorePurchases.Response']
  : M extends 'get_sdk_version'
  ? components['requests']['GetSDKVersion.Response']
  : M extends 'set_fallback'
  ? components['requests']['SetFallback.Response']
  : M extends 'set_integration_identifiers'
  ? components['requests']['SetIntegrationIdentifier.Response']
  : M extends 'update_attribution_data'
  ? components['requests']['UpdateAttributionData.Response']
  : M extends 'update_collecting_refund_data_consent'
  ? components['requests']['UpdateCollectingRefundDataConsent.Response']
  : M extends 'update_profile'
  ? components['requests']['UpdateProfile.Response']
  : M extends 'update_refund_preference'
  ? components['requests']['UpdateRefundPreference.Response']
  : never;

/**
 * Request type mapping for cross-platform method calls
 */
export type CrossPlatformRequest<K extends keyof components['requests']> = 
  components['requests'][K];

/**
 * Response type mapping for cross-platform method calls
 */
export type CrossPlatformResponseType<K extends keyof components['requests']> = 
  K extends `${string}.Request` 
    ? K extends `${infer Method}.Request`
      ? `${Method}.Response` extends keyof components['requests']
        ? components['requests'][`${Method}.Response`]
        : never
      : never
    : never;

/**
 * Extract success type from response
 */
export type ExtractSuccessType<T> = 
  T extends { success: infer S } 
    ? S 
    : T extends { success?: infer S } 
      ? S 
      : T extends { success: infer S }[]
        ? S
        : never;

/**
 * Type-safe parser for cross-platform JSON responses
 */
export function parseCrossPlatformJson<K extends keyof components['requests']>(
  json: string,
  _expectedType?: K
): CrossPlatformResponseType<K> {
  try {
    const parsed = JSON.parse(json);
    // Runtime validation could be added here using the coders
    return parsed as CrossPlatformResponseType<K>;
  } catch (error) {
    throw new Error(`Failed to parse cross-platform JSON: ${error}`);
  }
}

/**
 * Type guard to check if response contains error
 */
export function isErrorResponse(
  response: CrossPlatformResponse
): response is { error: components['defs']['AdaptyError'] } {
  return 'error' in response && response.error !== undefined;
}

/**
 * Type guard to check if response contains success data
 */
export function isSuccessResponse<T>(
  response: CrossPlatformResponse<T>
): response is { success: T } {
  return 'success' in response && response.success !== undefined;
}

/**
 * Extract success data from response or throw error
 */
export function extractSuccessOrThrow<T>(
  response: CrossPlatformResponse<T>
): T {
  if (isErrorResponse(response)) {
    throw new Error(`Native error: ${response.error.message} (${response.error.adapty_code})`);
  }
  
  if (isSuccessResponse(response)) {
    return response.success;
  }
  
  throw new Error('Invalid response format: missing success or error field');
} 
