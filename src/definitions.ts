import type { PluginListenerHandle } from '@capacitor/core';

import type { AdaptyProfile } from './shared/types';

export interface AdaptyCapacitorPlugin {
  /**
   * Handles crossplatform method calls
   * @internal
   */
  handleMethodCall(options: { methodName: string; args: string }): Promise<any>;

  /**
   * Adds event listener
   */
  addListener(
    eventName: 'onLatestProfileLoad',
    listenerFunc: (data: { profile: AdaptyProfile }) => void,
  ): Promise<PluginListenerHandle> & PluginListenerHandle;

  /**
   * Removes all event listeners
   */
  removeAllListeners(): Promise<void>;
}
