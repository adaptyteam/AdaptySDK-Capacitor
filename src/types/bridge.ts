import type { AdaptyProfile, AdaptyInstallationDetails, UserEventName } from '@adapty/core';

import type { AdaptyError } from './adapty-error';

// Re-export bridge types from @adapty/core
export { MethodNames } from '@adapty/core';
export type { MethodName, Serializable, AdaptyNativeError, AdaptyBridgeError, UserEventName } from '@adapty/core';

// Capacitor-specific: event listener types
// (Capacitor uses its own EmitterSubscription, not React Native's)
interface EmitterSubscription {
  remove(): void;
}

export type AddListenerGeneric<E extends UserEventName, Data> = (
  event: E,
  callback: (data: Data) => void | Promise<void>,
) => EmitterSubscription;

export type AddListenerFn =
  | AddListenerGeneric<'onLatestProfileLoad', AdaptyProfile>
  | AddListenerGeneric<'onInstallationDetailsSuccess', AdaptyInstallationDetails>
  | AddListenerGeneric<'onInstallationDetailsFail', AdaptyError>;
