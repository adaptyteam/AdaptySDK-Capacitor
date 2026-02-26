/**
 * Activation-related bridge samples for Capacitor SDK integration tests.
 *
 * These samples represent the exact JSON format sent to and received from
 * the native bridge for activation methods.
 *
 * Uses api.d.ts types for compile-time validation against cross_platform.yaml.
 */

import type { components } from 'types/api';

/**
 * Minimal activate request — only required api_key.
 * SDK adds default fields (observer_mode, server_cluster, media_cache, etc.)
 * so tests use toMatchObject for partial matching.
 */
export const ACTIVATE_REQUEST_MINIMAL: components['requests']['Activate.Request'] = {
  method: 'activate',
  configuration: {
    api_key: 'test_api_key_12345',
  },
};

/**
 * Activate request with log_level option
 */
export const ACTIVATE_REQUEST_WITH_LOG_LEVEL: components['requests']['Activate.Request'] = {
  method: 'activate',
  configuration: {
    api_key: 'test_api_key_12345',
    log_level: 'error',
  },
};

/**
 * Activate request with customer_user_id
 */
export const ACTIVATE_REQUEST_WITH_CUSTOMER_USER_ID: components['requests']['Activate.Request'] = {
  method: 'activate',
  configuration: {
    api_key: 'test_api_key_12345',
    customer_user_id: 'user_123',
    log_level: 'error',
  },
};

/**
 * Full activate request with all common fields filled in.
 */
export const ACTIVATE_REQUEST_FULL: components['requests']['Activate.Request'] = {
  method: 'activate',
  configuration: {
    api_key: 'test_api_key_12345',
    customer_user_id: 'user_123',
    observer_mode: false,
    server_cluster: 'default',
    log_level: 'verbose',
    ip_address_collection_disabled: false,
  },
};

/**
 * Activate request with iOS-specific parameters.
 * Includes idfaCollectionDisabled, clearDataOnBackup, and appAccountToken.
 *
 * Note: appAccountToken is encoded into customer_identity_parameters only on ios platform.
 * idfaCollectionDisabled and clearDataOnBackup are encoded regardless of platform.
 */
export const ACTIVATE_REQUEST_WITH_IOS_PARAMS: components['requests']['Activate.Request'] = {
  method: 'activate',
  configuration: {
    api_key: 'test_api_key_12345',
    apple_idfa_collection_disabled: true,
    clear_data_on_backup: true,
    customer_identity_parameters: {
      app_account_token: 'ios-app-account-token-uuid',
    },
  },
};

/**
 * Activate request with Android-specific parameters.
 * Includes adIdCollectionDisabled, pendingPrepaidPlansEnabled,
 * localAccessLevelAllowed, and obfuscatedAccountId.
 *
 * Note: obfuscatedAccountId is encoded into customer_identity_parameters
 * only on android platform.
 */
export const ACTIVATE_REQUEST_WITH_ANDROID_PARAMS: components['requests']['Activate.Request'] = {
  method: 'activate',
  configuration: {
    api_key: 'test_api_key_12345',
    google_adid_collection_disabled: true,
    google_enable_pending_prepaid_plans: true,
    google_local_access_level_allowed: true,
    customer_identity_parameters: {
      obfuscated_account_id: 'obfuscated-account-id-123',
    },
  },
};

/**
 * Activate request with backend proxy configuration.
 */
export const ACTIVATE_REQUEST_WITH_BACKEND_PROXY: components['requests']['Activate.Request'] = {
  method: 'activate',
  configuration: {
    api_key: 'test_api_key_12345',
    backend_proxy_host: 'https://proxy.example.com',
    backend_proxy_port: 8080,
  },
};

/**
 * Activate request with custom media_cache configuration.
 */
export const ACTIVATE_REQUEST_WITH_MEDIA_CACHE: components['requests']['Activate.Request'] = {
  method: 'activate',
  configuration: {
    api_key: 'test_api_key_12345',
    media_cache: {
      memory_storage_total_cost_limit: 50 * 1024 * 1024,
      memory_storage_count_limit: 100,
      disk_storage_size_limit: 200 * 1024 * 1024,
    },
  },
};

/**
 * Activate request with EU server cluster.
 */
export const ACTIVATE_REQUEST_WITH_EU_CLUSTER: components['requests']['Activate.Request'] = {
  method: 'activate',
  configuration: {
    api_key: 'test_api_key_12345',
    server_cluster: 'eu',
  },
};

/**
 * Activate request with activate_ui disabled.
 */
export const ACTIVATE_REQUEST_WITH_UI_DISABLED: components['requests']['Activate.Request'] = {
  method: 'activate',
  configuration: {
    api_key: 'test_api_key_12345',
    activate_ui: false,
  },
};

/**
 * Successful activation response
 */
export const ACTIVATE_RESPONSE_SUCCESS: components['requests']['Activate.Response'] = {
  success: true,
};

/**
 * Activation error response — invalid API key
 */
export const ACTIVATE_RESPONSE_ERROR: components['requests']['Activate.Response'] = {
  error: {
    adapty_code: 2002,
    message: 'Invalid API key',
    detail: 'The provided API key is not valid',
  },
};

/**
 * IsActivated request (no parameters)
 */
export const IS_ACTIVATED_REQUEST: components['requests']['IsActivated.Request'] = {
  method: 'is_activated',
};

/**
 * IsActivated response — true (activated)
 */
export const IS_ACTIVATED_RESPONSE_TRUE: components['requests']['IsActivated.Response'] = {
  success: true,
};

/**
 * IsActivated response — false (not activated)
 */
export const IS_ACTIVATED_RESPONSE_FALSE: components['requests']['IsActivated.Response'] = {
  success: false,
};
