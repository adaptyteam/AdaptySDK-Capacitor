import type { 
  AdaptyPaywall, 
  AdaptyPaywallProduct, 
  AdaptyOnboarding, 
  AdaptyProfile, 
  AdaptyPurchaseResult 
} from './';

/**
 * All available method names in the SDK
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
 * AdaptyUI View types for UI methods
 */
export interface AdaptyUIPaywallView {
  id: string;
  placementId: string;
  variationId: string;
}

export interface AdaptyUIOnboardingView {
  id: string;
  placementId: string; 
  variationId: string;
}

export type AdaptyUIDialogActionType = 'primary' | 'secondary';

export type LogLevel = 'error' | 'warn' | 'info' | 'verbose' | 'debug';

/**
 * Simple error type for cross-platform responses
 */
export interface AdaptyError {
  adaptyCode: number;
  message: string;
  detail?: string;
}

/**
 * Map method names to their success response types (camelCase TypeScript types)
 */
export type MethodResponseMap = {
  'activate': true;
  'adapty_ui_create_paywall_view': AdaptyUIPaywallView;
  'adapty_ui_dismiss_paywall_view': true;
  'adapty_ui_present_paywall_view': true;
  'adapty_ui_show_dialog': AdaptyUIDialogActionType;
  'adapty_ui_create_onboarding_view': AdaptyUIOnboardingView;
  'adapty_ui_dismiss_onboarding_view': true;
  'adapty_ui_present_onboarding_view': true;
  'get_paywall': AdaptyPaywall;
  'get_paywall_for_default_audience': AdaptyPaywall;
  'get_paywall_products': AdaptyPaywallProduct[];
  'get_onboarding': AdaptyOnboarding;
  'get_onboarding_for_default_audience': AdaptyOnboarding;
  'get_profile': AdaptyProfile;
  'identify': true;
  'is_activated': boolean;
  'get_log_level': LogLevel;
  'set_log_level': true;
  'logout': true;

  'log_show_paywall': true;
  'make_purchase': AdaptyPurchaseResult;
  'open_web_paywall': true;
  'create_web_paywall_url': string;
  'present_code_redemption_sheet': true;
  'report_transaction': AdaptyProfile;
  'restore_purchases': AdaptyProfile;
  'get_sdk_version': string;
  'set_fallback': true;
  'set_integration_identifiers': true;
  'update_attribution_data': true;
  'update_collecting_refund_data_consent': true;
  'update_profile': true;
  'update_refund_preference': true;
};

/**
 * Response type mapping for cross-platform method calls
 */
export type CrossPlatformResponse<T = unknown> = {
  success?: T;
  error?: AdaptyError;
};

/**
 * Type guard to check if response contains error
 */
export function isErrorResponse(
  response: CrossPlatformResponse
): response is { error: AdaptyError } {
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