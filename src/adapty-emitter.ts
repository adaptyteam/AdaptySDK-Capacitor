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
type EventFallback = (data: AnyEventPayload) => void | Promise<unknown>;

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

  /**
   * Events the SDK subscribes to on its own behalf, keyed by public name.
   *
   * Their native subscription outlives every app handler: it is created at
   * activation and survives both `removeHandler` reaching zero handlers and a
   * `removeAllListeners()` teardown. Without that, an event whose only consumer
   * is an SDK-side default would never arrive.
   */
  private observedEvents: Set<keyof EventPayloadMap> = new Set();

  /**
   * Runs when an observed event fires and the app registered no handler for it.
   * Keyed by native event id, mirroring `externalHandlers`, and typed with the
   * same widened payload those handlers already use.
   */
  private fallbacks: Map<string, EventFallback> = new Map();

  /**
   * Native subscriptions that have been requested but not yet resolved, keyed by
   * native event id.
   *
   * `nativeEventListeners` alone cannot make `ensureNativeSubscription`
   * idempotent: it is only populated once `AdaptyCapacitorPlugin.addListener`
   * resolves, so two callers racing across that await would both see an empty
   * map and both subscribe. Two live subscriptions dispatch every event twice —
   * for the promoted-purchase fallback that is a double purchase. Callers that
   * arrive while a request is in flight await this promise instead of issuing a
   * second one.
   */
  private pendingSubscriptions: Map<string, Promise<PluginListenerHandle>> = new Map();

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

    const handlers = this.externalHandlers;
    const subscriptionPromise = AdaptyCapacitorPlugin.addListener(eventConfig.native, (arg: { data: string }) => {
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
        const fallback = this.fallbacks.get(eventConfig.native);
        if (!fallback) {
          return;
        }

        const payload = this.parsePayload(eventConfig, rawEventData, eventCtx, eventLog);
        if (!payload) {
          return;
        }

        this.invoke(fallback, payload, 'Fallback', eventLog);
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

    this.pendingSubscriptions.set(eventConfig.native, subscriptionPromise);

    let subscription: PluginListenerHandle;
    try {
      subscription = await subscriptionPromise;
    } finally {
      // Only retract our own entry: a teardown may already have cleared the map
      // and a later call may have put its own request there. Clearing it on
      // failure as well as success is what lets a failed attempt be retried
      // instead of poisoning the cache forever.
      if (this.pendingSubscriptions.get(eventConfig.native) === subscriptionPromise) {
        this.pendingSubscriptions.delete(eventConfig.native);
      }
    }

    const existing = this.nativeEventListeners.get(eventConfig.native);
    if (existing && existing !== subscription) {
      // `removeAllListeners()` tore down and re-subscribed while this request was
      // in flight. Overwriting the map entry would orphan a live native
      // subscription that nothing could ever remove, so drop ours instead.
      await subscription.remove().catch(() => undefined);
      return;
    }

    this.nativeEventListeners.set(eventConfig.native, subscription);
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
   * Both failure shapes have to be caught and neither catches the other:
   * `Promise.resolve().catch()` handles a rejecting async callee, while the
   * try/catch handles a plain one that throws synchronously — `callee(payload)`
   * is evaluated as an argument, so a sync throw escapes before `.catch()` is
   * ever attached. Either one escaping would abort dispatch to the handlers
   * after it.
   */
  private invoke(
    callee: EventFallback,
    payload: AnyEventPayload,
    kind: 'Handler' | 'Fallback',
    eventLog: LogScope,
  ): void {
    try {
      void Promise.resolve(callee(payload)).catch((error) => eventLog.failed(() => ({ kind, error })));
    } catch (error) {
      eventLog.failed(() => ({ kind, error }));
    }
  }

  /**
   * Registers the handler that runs when an event fires and the app registered
   * none of its own. Do the failure logging inside the fallback — the catch in
   * `invoke` is a generic backstop, and only the caller knows what failing means.
   */
  public setFallback<K extends keyof EventPayloadMap>(
    eventName: K,
    fallback: (data: EventPayloadMap[K]) => void | Promise<unknown>,
  ): void {
    const eventConfig = EVENT_MAP[eventName];
    this.fallbacks.set(eventConfig.native, fallback as EventFallback);
  }

  /**
   * Subscribes the SDK itself to a native event, once.
   *
   * Idempotent for sequential AND concurrent callers: unawaited overlapping
   * calls — two `activate()`s racing, say — all await the same in-flight
   * request, so only one native subscription is ever created. Two would
   * dispatch every event twice, which for the promoted-purchase fallback means
   * buying the product twice.
   */
  public async startObserving<K extends keyof EventPayloadMap>(eventName: K): Promise<void> {
    const eventConfig = EVENT_MAP[eventName];
    if (!eventConfig) {
      throw new Error(`[Adapty] Unsupported event: ${eventName}`);
    }

    this.observedEvents.add(eventName);
    await this.ensureNativeSubscription(eventConfig as EventConfig<keyof EventPayloadMap>);
  }

  private isObservedNativeEvent(nativeEvent: string): boolean {
    for (const eventName of this.observedEvents) {
      if (EVENT_MAP[eventName].native === nativeEvent) {
        return true;
      }
    }

    return false;
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

    // If no more handlers for this native event, remove the subscription —
    // unless the SDK is observing this event on its own behalf, in which case
    // the subscription is not the app's to end.
    if (filteredHandlers.length === 0) {
      this.externalHandlers.delete(nativeEvent);

      if (this.isObservedNativeEvent(nativeEvent)) {
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

    // Captured before the teardown clears the maps. The SDK's own subscriptions
    // went down with the app's, and nothing else would put them back:
    // activate() runs once per process.
    const observed = Array.from(this.observedEvents);

    try {
      // Dropped along with the handles: a stale in-flight entry would make the
      // re-subscribe below a no-op and leave the SDK permanently unsubscribed.
      this.pendingSubscriptions.clear();

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

      for (const eventName of observed) {
        await this.startObserving(eventName);
      }

      log.success(() => ({ message: 'All listeners removed successfully' }));
    } catch (error) {
      log.failed(() => ({ error }));
      throw error;
    }
  }
}
