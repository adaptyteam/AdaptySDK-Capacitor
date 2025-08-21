import type { PluginListenerHandle } from '@capacitor/core';

import type { AdaptyProfile, AdaptyInstallationDetails } from '../shared/types';

export interface AdaptyCapacitorPlugin {
  /**
   * Handles crossplatform method calls
   */
  handleMethodCall(options: { methodName: string; args: string }): Promise<any>;

  /**
   * Adds event listener
   */
  addListener(
    eventName: 'onLatestProfileLoad',
    listenerFunc: (data: { profile: AdaptyProfile }) => void,
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'onInstallationDetailsSuccess',
    listenerFunc: (data: { details: AdaptyInstallationDetails }) => void,
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'onInstallationDetailsFail',
    listenerFunc: (data: { error: any }) => void,
  ): Promise<PluginListenerHandle>;
}
