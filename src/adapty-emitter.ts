import type { PluginListenerHandle } from '@capacitor/core';

import { AdaptyCapacitorPlugin } from './bridge/plugin';
import type { AdaptyError } from './shared/adapty-error';
import { parseCommonEvent } from './shared/coders/parse';
import { LogContext } from './shared/logger';
import type { AdaptyProfile, AdaptyInstallationDetails } from './shared/types';
import type { AddListenerFn, EventPayloadMap } from './types/adapty-plugin';

type EventConfig<K extends keyof EventPayloadMap> = {
  native: 'did_load_latest_profile' | 'on_installation_details_success' | 'on_installation_details_fail';
  parse: (raw: string, eventCtx: LogContext) => EventPayloadMap[K] | null;
};

// Type-safe parser functions for each event
function parseProfileEvent(raw: string, eventCtx: LogContext): EventPayloadMap['onLatestProfileLoad'] | null {
  const profile = parseCommonEvent('did_load_latest_profile', raw, eventCtx);
  return profile ? { profile: profile as AdaptyProfile } : null;
}

function parseInstallationDetailsSuccessEvent(
  raw: string,
  eventCtx: LogContext,
): EventPayloadMap['onInstallationDetailsSuccess'] | null {
  const details = parseCommonEvent('on_installation_details_success', raw, eventCtx);
  return details ? { details: details as AdaptyInstallationDetails } : null;
}

function parseInstallationDetailsFailEvent(
  raw: string,
  eventCtx: LogContext,
): EventPayloadMap['onInstallationDetailsFail'] | null {
  const error = parseCommonEvent('on_installation_details_fail', raw, eventCtx);
  return error ? { error: error as AdaptyError } : null;
}

const EVENT_MAP: { [K in keyof EventPayloadMap]: EventConfig<K> } = {
  onLatestProfileLoad: {
    native: 'did_load_latest_profile',
    parse: parseProfileEvent,
  },
  onInstallationDetailsSuccess: {
    native: 'on_installation_details_success',
    parse: parseInstallationDetailsSuccessEvent,
  },
  onInstallationDetailsFail: {
    native: 'on_installation_details_fail',
    parse: parseInstallationDetailsFailEvent,
  },
};

export class AdaptyEmitter {
  private nativeEventListeners: Map<string, PluginListenerHandle> = new Map();
  private externalHandlers: Map<
    string,
    {
      id: string;
      handlerName: keyof EventPayloadMap;
      listener: (data: EventPayloadMap[keyof EventPayloadMap]) => void;
      config: EventConfig<keyof EventPayloadMap>;
    }[]
  > = new Map();

  public addListener: AddListenerFn = async <T extends keyof EventPayloadMap>(
    eventName: T,
    listener: (data: EventPayloadMap[T]) => void,
  ): Promise<PluginListenerHandle> => {
    const ctx = new LogContext();
    const log = ctx.call({ methodName: 'addListener' });
    log.start(() => ({ eventName }));

    const eventConfig = EVENT_MAP[eventName];
    if (!eventConfig) {
      throw new Error(`[Adapty] Unsupported event: ${eventName}`);
    }

    const handlerId = `${eventName}_${Math.random().toString(36)}`;
    const handlersForEvent = this.externalHandlers.get(eventConfig.native) ?? [];
    handlersForEvent.push({
      id: handlerId,
      handlerName: eventName,
      listener: listener as (data: EventPayloadMap[keyof EventPayloadMap]) => void,
      config: eventConfig as EventConfig<keyof EventPayloadMap>,
    });
    this.externalHandlers.set(eventConfig.native, handlersForEvent);

    if (!this.nativeEventListeners.has(eventConfig.native)) {
      const handlers = this.externalHandlers;
      const subscription = await AdaptyCapacitorPlugin.addListener(eventConfig.native, (arg: { data: string }) => {
        const eventCtx = new LogContext();
        const eventLog = eventCtx.event({ methodName: eventConfig.native });
        eventLog.start(() => ({ raw: arg }));

        const rawEventData = arg?.data;
        if (typeof rawEventData !== 'string') {
          eventLog.failed(() => ({ error: new Error('[Adapty] Expected event data to be JSON string') }));
          return;
        }

        const eventHandlers = handlers.get(eventConfig.native) ?? [];
        for (const { handlerName, listener, config } of eventHandlers) {
          let payload: EventPayloadMap[keyof EventPayloadMap] | null = null;
          try {
            payload = config.parse(rawEventData, eventCtx);
          } catch (err) {
            eventLog.failed(() => ({ error: err }));
            continue;
          }

          if (!payload) {
            eventLog.failed(() => ({ error: new Error('[Adapty] Parsed payload is null') }));
            continue;
          }

          try {
            listener(payload);
            eventLog.success(() => ({ message: 'Event handled successfully', handlerName }));
          } catch (handlerError) {
            eventLog.failed(() => ({ handlerName, handlerError }));
          }
        }
      });
      this.nativeEventListeners.set(eventConfig.native, subscription);
    }

    // Return wrapper handle that can remove this specific handler
    const wrappedHandle: PluginListenerHandle = {
      remove: async () => {
        await this.removeHandler(eventConfig.native, handlerId);
      },
    } as PluginListenerHandle;

    return wrappedHandle;
  };

  private async removeHandler(nativeEvent: string, handlerId: string): Promise<void> {
    const ctx = new LogContext();
    const log = ctx.call({ methodName: 'removeHandler' });
    log.start(() => ({ nativeEvent, handlerId }));

    const handlersForEvent = this.externalHandlers.get(nativeEvent);
    if (!handlersForEvent) {
      log.success(() => ({ message: 'No handlers found for native event', nativeEvent }));
      return;
    }

    const initialHandlersCount = handlersForEvent.length;
    // Remove the specific handler
    const filteredHandlers = handlersForEvent.filter((h) => h.id !== handlerId);
    this.externalHandlers.set(nativeEvent, filteredHandlers);

    const handlerRemoved = filteredHandlers.length < initialHandlersCount;
    if (!handlerRemoved) {
      log.success(() => ({
        message: 'Handler not found in handlers list',
        nativeEvent,
        handlerId,
        remainingHandlers: filteredHandlers.length,
      }));
      return;
    }

    // If no more handlers for this native event, remove the subscription
    if (filteredHandlers.length === 0) {
      this.externalHandlers.delete(nativeEvent);
      const subscription = this.nativeEventListeners.get(nativeEvent);
      if (subscription) {
        try {
          await subscription.remove();
          this.nativeEventListeners.delete(nativeEvent);
          log.success(() => ({
            message: 'Handler and native subscription removed successfully',
            nativeEvent,
            handlerId,
          }));
        } catch (error) {
          log.failed(() => ({
            message: `Failed to remove subscription for ${nativeEvent}`,
            error,
            nativeEvent,
            handlerId,
          }));
        }
      } else {
        log.success(() => ({
          message: 'Handler removed, no native subscription found',
          nativeEvent,
          handlerId,
        }));
      }
    } else {
      log.success(() => ({
        message: 'Handler removed successfully',
        nativeEvent,
        handlerId,
        remainingHandlers: filteredHandlers.length,
      }));
    }
  }

  async removeAllListeners(): Promise<void> {
    const ctx = new LogContext();
    const log = ctx.call({ methodName: 'removeAllListeners' });
    log.start(() => ({ listenersCount: this.nativeEventListeners.size }));

    try {
      const removePromises = Array.from(this.nativeEventListeners.values()).map((handle, index) =>
        handle.remove().catch((error) => {
          log.failed(() => ({
            message: `Failed to remove event listener ${index}`,
            error,
            index,
          }));
        }),
      );

      this.nativeEventListeners.clear();
      this.externalHandlers.clear();
      await Promise.all(removePromises);
      log.success(() => ({ message: 'All listeners removed successfully' }));
    } catch (error) {
      log.failed(() => ({ error }));
      throw error;
    }
  }
}
