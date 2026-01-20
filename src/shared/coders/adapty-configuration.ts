import * as Input from '../types/inputs';
import type { Def } from '../types/schema';
import { AdaptyUiMediaCacheCoder } from './adapty-ui-media-cache';
import { getPlatform } from '../utils/platform';
import version from '../../version';

type Model = Input.ActivateParamsInput;
type Serializable = Def['AdaptyConfiguration'];

export class AdaptyConfigurationCoder {
  encode(apiKey: string, params: Model): Serializable {
    const config: Serializable = {
      api_key: apiKey,
      cross_platform_sdk_name: 'capacitor',
      cross_platform_sdk_version: version,
    };

    if (params.customerUserId) {
      config['customer_user_id'] = params.customerUserId;
    }

    config['observer_mode'] = params.observerMode ?? false;
    config['ip_address_collection_disabled'] =
      params.ipAddressCollectionDisabled ?? false;

    if (params.logLevel) {
      config['log_level'] = params.logLevel;
    }

    config['server_cluster'] = params.serverCluster ?? 'default';

    if (params.backendProxyHost) {
      config['backend_proxy_host'] = params.backendProxyHost;
    }

    if (params.backendProxyPort) {
      config['backend_proxy_port'] = params.backendProxyPort;
    }

    config['activate_ui'] = params.activateUi ?? true;

    const mediaCacheCoder = new AdaptyUiMediaCacheCoder();
    config['media_cache'] = mediaCacheCoder.encode(
      params.mediaCache ?? {
        memoryStorageTotalCostLimit: 100 * 1024 * 1024,
        memoryStorageCountLimit: 2147483647,
        diskStorageSizeLimit: 100 * 1024 * 1024,
      },
    );

    // For Capacitor, we need to handle platform-specific settings differently
    // These will be handled at runtime by the native layer
    const platform = getPlatform();

    if (params.ios?.idfaCollectionDisabled !== undefined) {
      config['apple_idfa_collection_disabled'] = params.ios.idfaCollectionDisabled;
    }

    if (params.ios?.clearDataOnBackup !== undefined) {
      config['clear_data_on_backup'] = params.ios.clearDataOnBackup;
    }

    if (platform === 'ios' && params.ios?.appAccountToken) {
      (config as any)['customer_identity_parameters'] = {
        app_account_token: params.ios.appAccountToken,
      };
    }

    if (params.android?.adIdCollectionDisabled !== undefined) {
      config['google_adid_collection_disabled'] = params.android.adIdCollectionDisabled;
    }

    if (params.android?.pendingPrepaidPlansEnabled !== undefined) {
      (config as any)['google_enable_pending_prepaid_plans'] =
        params.android.pendingPrepaidPlansEnabled;
    }

    if (params.android?.localAccessLevelAllowed !== undefined) {
      (config as any)['google_local_access_level_allowed'] =
        params.android.localAccessLevelAllowed;
    }

    if (platform === 'android' && params.android?.obfuscatedAccountId) {
      (config as any)['customer_identity_parameters'] = {
        obfuscated_account_id: params.android.obfuscatedAccountId,
      };
    }

    return config;
  }
}
