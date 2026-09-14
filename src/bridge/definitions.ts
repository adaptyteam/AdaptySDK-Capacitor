import type { FlowEventIdType, OnboardingEventIdType, GlobalEventIdType } from '@adapty/core';
import type { PluginListenerHandle } from '@capacitor/core';

/**
 * Every native event id the plugin can be subscribed to: the SDK's global
 * events plus the per-view flow and onboarding events.
 *
 * `addListener` previously took a bare `string`, which accepted any value - a
 * mistyped or renamed wire id compiled clean and the event simply never
 * arrived, because subscribing to an id native never emits raises nothing at
 * runtime. All three unions come from `@adapty/core`, which derives them from
 * `cross_platform.yaml`.
 */
export type NativeEventId = GlobalEventIdType | FlowEventIdType | OnboardingEventIdType;

export interface AdaptyCapacitorPlugin {
  /**
   * Handles crossplatform method calls
   */
  handleMethodCall(options: { methodName: string; args: string }): Promise<any>;

  /**
   * Adds event listener
   */
  addListener(eventName: NativeEventId, listenerFunc: (data: { data: string }) => void): Promise<PluginListenerHandle>;
}
