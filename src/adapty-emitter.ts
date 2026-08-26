import type { AdaptyError } from '@adapty/core';
import type { PluginListenerHandle } from '@capacitor/core';

import { AdaptyCapacitorPlugin } from './bridge/plugin';
import { parseCommonEvent } from './coders/parse';
import { LogContext } from './logger';
import type { LogScope } from './logger';
import type { AdaptyProfile, AdaptyPromotedProduct, AdaptyInstallationDetails } from './types';
import type { AddListenerFn, EventPayloadMap } from './types/adapty-plugin';

type EventConfig<K extends keyof EventPayloadMap> = {
  native:
    | 'did_load_latest_profile'
    | 'did_receive_promoted_purchase'
    | 'on_installation_details_success'
    | 'on_installation_details_fail';
  parse: (raw: string, eventCtx: LogContext) => EventPayloadMap[K] | null;
};

type AnyEventPayload = EventPayloadMap[keyof EventPayloadMap];
type EventListener = (data: AnyEventPayload) => void | Promise<unknown>;

/** A listener the SDK registered on its own behalf: one per event, never removed. */
type InternalHandler = {
  handlerName: keyof EventPayloadMap;
  listener: EventListener;
  config: EventConfig<keyof EventPayloadMap>;
};

// Type-safe parser functions for each event
function parseProfileEvent(raw: string, eventCtx: LogContext): EventPayloadMap['onLatestProfileLoad'] | null {
  const profile = parseCommonEvent('did_load_latest_profile', raw, eventCtx);
  return profile ? { profile: profile as AdaptyProfile } : null;
}

function parsePromotedPurchaseEvent(
  raw: string,
  eventCtx: LogContext,
): EventPayloadMap['onPromotedPurchaseReceived'] | null {
  const product = parseCommonEvent('did_receive_promoted_purchase', raw, eventCtx);
  return product ? { product: product as AdaptyPromotedProduct } : null;
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
  onPromotedPurchaseReceived: {
    native: 'did_receive_promoted_purchase',
    parse: parsePromotedPurchaseEvent,
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

/** Bounds the wait in `removeAllListeners()`, so a teardown always terminates. */
const MAX_PENDING_SUBSCRIPTION_ROUNDS = 10;

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

  /** SDK-owned handlers, keyed by native event id. At most one per event. */
  private internalHandlers: Map<string, InternalHandler> = new Map();

  /**
   * In-flight `ensureNativeSubscription` operations, keyed by native event id.
   *
   * `nativeEventListeners` fills in only after the native `addListener`
   * resolves, so racing callers would both subscribe — and two live
   * subscriptions dispatch every event twice (a double promoted purchase).
   * The whole operation is cached, not the native promise: it settles only once
   * its handle is in `nativeEventListeners`, which is what lets a teardown
   * wait them out first and then remove everything from that one map.
   */
  private pendingSubscriptions: Map<string, Promise<void>> = new Map();

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

    await this.ensureNativeSubscription(eventConfig as EventConfig<keyof EventPayloadMap>);

    // Return wrapper handle that can remove this specific handler
    const wrappedHandle: PluginListenerHandle = {
      remove: async () => {
        await this.removeHandler(eventConfig.native, handlerId);
      },
    } as PluginListenerHandle;

    return wrappedHandle;
  };

  private async ensureNativeSubscription(eventConfig: EventConfig<keyof EventPayloadMap>): Promise<void> {
    if (this.nativeEventListeners.has(eventConfig.native)) {
      return;
    }

    const inFlight = this.pendingSubscriptions.get(eventConfig.native);
    if (inFlight) {
      await inFlight;
      return;
    }

    // Published before the first await, so a concurrent caller always sees
    // either a handle or an in-flight request.
    const operation = this.subscribeNatively(eventConfig);
    this.pendingSubscriptions.set(eventConfig.native, operation);

    try {
      await operation;
    } finally {
      // Only retract our own entry — a teardown may have cleared the map and a
      // later call put its own request there. Clearing on failure too keeps a
      // failed attempt retriable.
      if (this.pendingSubscriptions.get(eventConfig.native) === operation) {
        this.pendingSubscriptions.delete(eventConfig.native);
      }
    }
  }

  /**
   * Subscribes natively and records the handle, as one awaitable unit: once it
   * settles the handle is either in `nativeEventListeners` or already removed,
   * never live but invisible to a teardown.
   */
  private async subscribeNatively(eventConfig: EventConfig<keyof EventPayloadMap>): Promise<void> {
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

      // Snapshot before dispatch: a handler that registers or removes another
      // handler mid-emit must not change who receives THIS payload.
      const eventHandlers = Array.from(handlers.get(eventConfig.native) ?? []);

      if (eventHandlers.length === 0) {
        const internal = this.internalHandlers.get(eventConfig.native);
        if (!internal) {
          return;
        }

        const payload = this.parsePayload(eventConfig, rawEventData, eventCtx, eventLog);
        if (!payload) {
          return;
        }

        this.invoke(internal.listener, payload, 'Internal', eventLog);
        return;
      }

      for (const { handlerName, listener, config } of eventHandlers) {
        const payload = this.parsePayload(config, rawEventData, eventCtx, eventLog);
        if (!payload) {
          continue;
        }

        this.invoke(listener, payload, 'Handler', eventLog);
        eventLog.success(() => ({ message: 'Event handled successfully', handlerName }));
      }
    });

    const existing = this.nativeEventListeners.get(eventConfig.native);
    if (existing && existing !== subscription) {
      // Something re-subscribed while we were in flight. Overwriting the entry
      // would orphan a live subscription nothing could remove, so drop ours.
      await subscription.remove().catch(() => undefined);
      return;
    }

    this.nativeEventListeners.set(eventConfig.native, subscription);
  }

  /**
   * Awaits the in-flight subscribe operations, so every handle is in
   * `nativeEventListeners` and the caller can tear them all down from that map.
   * Requests started meanwhile are awaited too, for a bounded number of rounds.
   */
  private async awaitPendingSubscriptions(): Promise<void> {
    for (let round = 0; round < MAX_PENDING_SUBSCRIPTION_ROUNDS && this.pendingSubscriptions.size > 0; round += 1) {
      const inFlight = Array.from(this.pendingSubscriptions.entries());
      await Promise.allSettled(inFlight.map(([, operation]) => operation));

      // Retract exactly what was awaited, so a request that started meanwhile
      // is kept for the next round instead of being dropped.
      for (const [native, operation] of inFlight) {
        if (this.pendingSubscriptions.get(native) === operation) {
          this.pendingSubscriptions.delete(native);
        }
      }
    }

    this.pendingSubscriptions.clear();
  }

  private parsePayload(
    config: EventConfig<keyof EventPayloadMap>,
    rawEventData: string,
    eventCtx: LogContext,
    eventLog: LogScope,
  ): AnyEventPayload | null {
    let payload: AnyEventPayload | null = null;
    try {
      payload = config.parse(rawEventData, eventCtx);
    } catch (err) {
      eventLog.failed(() => ({ error: err }));
      return null;
    }

    if (!payload) {
      eventLog.failed(() => ({ error: new Error('[Adapty] Parsed payload is null') }));
      return null;
    }

    return payload;
  }

  /**
   * Catches both failure shapes — `.catch()` a rejecting async callee, the
   * try/catch a sync throw from `callee(payload)`, which escapes before
   * `.catch()` is attached. Either would abort dispatch to the handlers after.
   */
  private invoke(
    callee: EventListener,
    payload: AnyEventPayload,
    kind: 'Handler' | 'Internal',
    eventLog: LogScope,
  ): void {
    try {
      void Promise.resolve(callee(payload)).catch((error) => eventLog.failed(() => ({ kind, error })));
    } catch (error) {
      eventLog.failed(() => ({ kind, error }));
    }
  }

  public async addInternalListener<K extends keyof EventPayloadMap>(
    eventName: K,
    listener: (data: EventPayloadMap[K]) => void | Promise<unknown>,
  ): Promise<void> {
    const eventConfig = EVENT_MAP[eventName];
    if (!eventConfig) {
      throw new Error(`[Adapty] Unsupported event: ${eventName}`);
    }

    // Recorded before the await: another caller's subscription may already be
    // live, and an event arriving on it needs a listener to reach.
    this.internalHandlers.set(eventConfig.native, {
      handlerName: eventName,
      listener: listener as EventListener,
      config: eventConfig as EventConfig<keyof EventPayloadMap>,
    });

    await this.ensureNativeSubscription(eventConfig as EventConfig<keyof EventPayloadMap>);
  }

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

    // Last handler gone: remove the subscription — unless the SDK is observing
    // this event itself, in which case it is not the app's to end.
    if (filteredHandlers.length === 0) {
      this.externalHandlers.delete(nativeEvent);

      if (this.internalHandlers.has(nativeEvent)) {
        log.success(() => ({
          message: 'Handler removed, native subscription kept for SDK-owned event',
          nativeEvent,
          handlerId,
        }));
        return;
      }

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
      // Awaited, not dropped: a dropped in-flight subscribe would register its
      // handle after this teardown, alongside the re-subscribe below, and two
      // live subscriptions dispatch every event twice.
      await this.awaitPendingSubscriptions();

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

      const internal = Array.from(this.internalHandlers.values());

      for (const { handlerName, config } of internal) {
        try {
          // The listener is still registered — only the native subscription
          // went down — so this re-subscribes without touching the map.
          await this.ensureNativeSubscription(config);
        } catch (error) {
          log.failed(() => ({ message: `Failed to re-subscribe to ${handlerName}`, error, eventName: handlerName }));
        }
      }

      log.success(() => ({ message: 'All listeners removed successfully' }));
    } catch (error) {
      log.failed(() => ({ error }));
      throw error;
    }
  }
}
