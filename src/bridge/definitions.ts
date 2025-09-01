import type { PluginListenerHandle } from '@capacitor/core';

export interface AdaptyCapacitorPlugin {
  /**
   * Handles crossplatform method calls
   */
  handleMethodCall(options: { methodName: string; args: string }): Promise<any>;

  /**
   * Adds event listener
   */
  addListener(eventName: string, listenerFunc: (data: { data: string }) => void): Promise<PluginListenerHandle>;
}
