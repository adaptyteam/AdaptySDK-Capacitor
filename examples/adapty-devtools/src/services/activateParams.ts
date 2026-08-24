import type { ActivateParamsInput } from '@adapty/capacitor';

export interface DevtoolsActivateOptions {
  /** Activates the SDK in observer mode — purchases are made by the app. */
  observerMode?: boolean;
  /**
   * Enables the Adapty Attribution service (added in 4.1.0, defaults to
   * `false` in the SDK). Only takes effect at activation, which is why the
   * devtools UI has to set it before the Activate button is tapped.
   */
  adaptyAttributionEnabled?: boolean;
  /** Keeps the SDK activated across Vite HMR in dev builds. */
  ignoreActivationOnFastRefresh?: boolean;
  /** Sent only when non-empty. */
  customerUserId?: string;
}

export function buildActivateParams({
  observerMode = false,
  adaptyAttributionEnabled = false,
  ignoreActivationOnFastRefresh = false,
  customerUserId = '',
}: DevtoolsActivateOptions = {}): ActivateParamsInput {
  return {
    // serverCluster: 'cn',
    // backendBaseUrl: 'http://localhost:8080',
    ...(customerUserId ? { customerUserId } : {}),
    logLevel: 'verbose',
    observerMode,
    adaptyAttributionEnabled,
    __ignoreActivationOnFastRefresh: ignoreActivationOnFastRefresh,
    // Extra options worth toggling by hand while debugging — uncomment a line
    // here and rebuild. They live inside the returned object literal on purpose,
    // so that uncommenting stays valid TypeScript.
    // __debugDeferActivation: true,
    // android: {
    //   adIdCollectionDisabled: true,
    //   pendingPrepaidPlansEnabled: false,
    //   localAccessLevelAllowed: false,
    //   obfuscatedAccountId: 'testObfAccId',
    // },
    // ios: {
    //   idfaCollectionDisabled: true,
    //   appAccountToken: '550e8400-e29b-41d4-a716-446655440000',
    //   clearDataOnBackup: true,
    // },
  };
}
