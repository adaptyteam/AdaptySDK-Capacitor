import { AdaptyConfigurationCoder } from './adapty-configuration';
import { LogLevel } from '../types/inputs';
import version from '../../version';
import * as platformModule from '../utils/platform';

jest.mock('../utils/platform');

const mockGetPlatform = platformModule.getPlatform as jest.MockedFunction<typeof platformModule.getPlatform>;

describe('AdaptyConfigurationCoder', () => {
  const coder = new AdaptyConfigurationCoder();
  const apiKey = 'test-api-key';

  beforeEach(() => {
    mockGetPlatform.mockReturnValue('ios');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should encode minimal configuration', () => {
    const params = {};
    const result = coder.encode(apiKey, params);

    expect(result).toMatchObject({
      api_key: apiKey,
      cross_platform_sdk_name: 'capacitor',
      cross_platform_sdk_version: version,
      observer_mode: false,
      ip_address_collection_disabled: false,
      server_cluster: 'default',
      activate_ui: true,
      media_cache: {
        memory_storage_total_cost_limit: 100 * 1024 * 1024,
        memory_storage_count_limit: 2147483647,
        disk_storage_size_limit: 100 * 1024 * 1024,
      },
    });
  });

  it('should encode full configuration with all parameters', () => {
    const params = {
      customerUserId: 'user123',
      observerMode: true,
      ipAddressCollectionDisabled: true,
      logLevel: LogLevel.VERBOSE,
      serverCluster: 'eu' as const,
      backendProxyHost: 'proxy.example.com',
      backendProxyPort: 8080,
      activateUi: false,
      mediaCache: {
        memoryStorageTotalCostLimit: 50 * 1024 * 1024,
        memoryStorageCountLimit: 1000,
        diskStorageSizeLimit: 200 * 1024 * 1024,
      },
      ios: {
        idfaCollectionDisabled: true,
      },
      android: {
        adIdCollectionDisabled: true,
        localAccessLevelAllowed: true,
      },
    };

    const result = coder.encode(apiKey, params);

    expect(result).toMatchObject({
      api_key: apiKey,
      cross_platform_sdk_name: 'capacitor',
      cross_platform_sdk_version: version,
      customer_user_id: 'user123',
      observer_mode: true,
      ip_address_collection_disabled: true,
      log_level: 'verbose',
      server_cluster: 'eu',
      backend_proxy_host: 'proxy.example.com',
      backend_proxy_port: 8080,
      activate_ui: false,
      media_cache: {
        memory_storage_total_cost_limit: 50 * 1024 * 1024,
        memory_storage_count_limit: 1000,
        disk_storage_size_limit: 200 * 1024 * 1024,
      },
      google_local_access_level_allowed: true,
    });
  });

  it('should handle partial parameters', () => {
    const params = {
      customerUserId: 'user456',
      logLevel: LogLevel.WARN,
      serverCluster: 'cn' as const,
      ios: {
        idfaCollectionDisabled: false,
      },
    };

    const result = coder.encode(apiKey, params);

    expect(result).toMatchObject({
      api_key: apiKey,
      cross_platform_sdk_name: 'capacitor',
      cross_platform_sdk_version: version,
      customer_user_id: 'user456',
      observer_mode: false,
      ip_address_collection_disabled: false,
      log_level: 'warn',
      server_cluster: 'cn',
      activate_ui: true,
      media_cache: {
        memory_storage_total_cost_limit: 100 * 1024 * 1024,
        memory_storage_count_limit: 2147483647,
        disk_storage_size_limit: 100 * 1024 * 1024,
      },
    });
  });

  it('should handle undefined logLevel', () => {
    const params = {};
    const result = coder.encode(apiKey, params);

    expect(result.media_cache).toEqual({
      memory_storage_total_cost_limit: 100 * 1024 * 1024,
      memory_storage_count_limit: 2147483647,
      disk_storage_size_limit: 100 * 1024 * 1024,
    });
    expect(result.log_level).toBeUndefined();
  });

  it('should prefer params media cache over default', () => {
    const params = {
      mediaCache: {
        memoryStorageTotalCostLimit: 25 * 1024 * 1024,
        memoryStorageCountLimit: 500,
        diskStorageSizeLimit: 75 * 1024 * 1024,
      },
    };

    const result = coder.encode(apiKey, params);

    expect(result.media_cache).toEqual({
      memory_storage_total_cost_limit: 25 * 1024 * 1024,
      memory_storage_count_limit: 500,
      disk_storage_size_limit: 75 * 1024 * 1024,
    });
  });

  it('should encode customer_identity_parameters with app_account_token on iOS', () => {
    mockGetPlatform.mockReturnValue('ios');

    const params = {
      ios: {
        appAccountToken: 'ios-token-123',
      },
    };

    const result = coder.encode(apiKey, params);

    expect(result.customer_identity_parameters).toEqual({
      app_account_token: 'ios-token-123',
    });
  });

  it('should encode customer_identity_parameters with obfuscated_account_id on Android', () => {
    mockGetPlatform.mockReturnValue('android');

    const params = {
      android: {
        obfuscatedAccountId: 'android-id-456',
      },
    };

    const result = coder.encode(apiKey, params);

    expect(result.customer_identity_parameters).toEqual({
      obfuscated_account_id: 'android-id-456',
    });
  });

  it('should encode google_enable_pending_prepaid_plans on Android', () => {
    mockGetPlatform.mockReturnValue('android');

    const params = {
      android: {
        pendingPrepaidPlansEnabled: true,
      },
    };

    const result = coder.encode(apiKey, params);

    expect(result.google_enable_pending_prepaid_plans).toBe(true);
  });

  it('should encode google_local_access_level_allowed on Android', () => {
    mockGetPlatform.mockReturnValue('android');

    const params = {
      android: {
        localAccessLevelAllowed: true,
      },
    };

    const result = coder.encode(apiKey, params);

    expect(result.google_local_access_level_allowed).toBe(true);
  });

  it('should not encode identity params for different platform', () => {
    mockGetPlatform.mockReturnValue('android');

    const params = {
      ios: {
        appAccountToken: 'ios-token-123',
      },
    };

    const result = coder.encode(apiKey, params);

    expect(result.customer_identity_parameters).toBeUndefined();
  });

  it('should handle clearDataOnBackup parameter conditionally', () => {
    const paramsWithout = {};
    const resultWithout = coder.encode(apiKey, paramsWithout);
    expect(resultWithout.clear_data_on_backup).toBeUndefined();

    const paramsWithFalse = { ios: { clearDataOnBackup: false } };
    const resultWithFalse = coder.encode(apiKey, paramsWithFalse);
    expect(resultWithFalse.clear_data_on_backup).toBe(false);

    const paramsWithTrue = { ios: { clearDataOnBackup: true } };
    const resultWithTrue = coder.encode(apiKey, paramsWithTrue);
    expect(resultWithTrue.clear_data_on_backup).toBe(true);
  });
});
