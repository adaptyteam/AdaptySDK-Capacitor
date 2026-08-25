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

/**
 * How many times `removeAllListeners()` re-checks for subscribe requests that
 * started while it was draining the previous ones. Bounded so a teardown always
 * terminates, even if something keeps subscribing in a loop.
 */
const MAX_SUBSCRIPTION_DRAIN_ROUNDS = 10;

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
   * `ensureNativeSubscription` operations that have been started but have not
   * yet finished, keyed by native event id.
   *
   * `nativeEventListeners` alone cannot make `ensureNativeSubscription`
   * idempotent: it is only populated once `AdaptyCapacitorPlugin.addListener`
   * resolves, so two callers racing across that await would both see an empty
   * map and both subscribe. Two live subscriptions dispatch every event twice —
   * for the promoted-purchase fallback that is a double purchase. Callers that
   * arrive while a request is in flight await this promise instead of issuing a
   * second one.
   *
   * What is cached is the whole operation rather than the raw native promise:
   * an operation only settles once its handle has been recorded in
   * `nativeEventListeners`, which is what lets `removeAllListeners()` drain the
   * in-flight requests and then tear every subscription down from that one map.
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

    // Published before `subscribeNatively` reaches its first await, so there is
    // no window in which a concurrent caller sees neither a handle nor an
    // in-flight request.
    const operation = this.subscribeNatively(eventConfig);
    this.pendingSubscriptions.set(eventConfig.native, operation);

    try {
      await operation;
    } finally {
      // Only retract our own entry: a teardown may already have cleared the map
      // and a later call may have put its own request there. Clearing it on
      // failure as well as success is what lets a failed attempt be retried
      // instead of poisoning the cache forever.
      if (this.pendingSubscriptions.get(eventConfig.native) === operation) {
        this.pendingSubscriptions.delete(eventConfig.native);
      }
    }
  }

  /**
   * Issues the native subscription and records the handle it returns.
   *
   * Kept as a single awaitable unit: whoever waits on it — a concurrent caller,
   * or `removeAllListeners()` draining before a teardown — knows that once it
   * settles the handle is either in `nativeEventListeners` or already removed.
   * Awaiting the raw `AdaptyCapacitorPlugin.addListener` promise instead would
   * hand back control one step too early, while the subscription is live but
   * still invisible to a teardown.
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

    const existing = this.nativeEventListeners.get(eventConfig.native);
    if (existing && existing !== subscription) {
      // Something re-subscribed while this request was in flight. Overwriting
      // the map entry would orphan a live native subscription that nothing
      // could ever remove, so drop ours instead. `removeAllListeners()` no
      // longer produces this race — it drains first — but a caller that
      // bypasses the in-flight cache still could, and an orphan here is a
      // duplicate dispatch.
      await subscription.remove().catch(() => undefined);
      return;
    }

    this.nativeEventListeners.set(eventConfig.native, subscription);
  }

  /**
   * Waits for the in-flight `ensureNativeSubscription` operations to finish and
   * leaves `pendingSubscriptions` empty.
   *
   * Every settled operation has recorded its handle in `nativeEventListeners`,
   * so the caller can tear all of them down from that one map. A request that
   * starts while we are waiting is drained as well, for a bounded number of
   * rounds: a teardown has to terminate even against a caller that keeps
   * subscribing.
   */
  private async drainPendingSubscriptions(): Promise<void> {
    for (let round = 0; round < MAX_SUBSCRIPTION_DRAIN_ROUNDS && this.pendingSubscriptions.size > 0; round += 1) {
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
      // Awaited, not dropped. A dropped in-flight subscribe is neither torn down
      // here nor waited for: it registers its native subscription after this
      // teardown, alongside the one the re-subscribe below creates, and two live
      // subscriptions dispatch the same event twice — for the promoted-purchase
      // fallback, a product bought twice. Draining first makes the late handle
      // land in `nativeEventListeners` before it is read, so it goes down with
      // the rest and the re-subscribe below is the only subscription left.
      await this.drainPendingSubscriptions();

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
        try {
          await this.startObserving(eventName);
        } catch (error) {
          // Same reasoning as activate(), which wraps this very call the same
          // way: losing the SDK-side default is not a reason to reject a public
          // teardown method that apps routinely call unawaited from an effect
          // cleanup, where the rejection would surface as an unhandled one.
          log.failed(() => ({ message: `Failed to re-subscribe to ${eventName}`, error, eventName }));
        }
      }

      log.success(() => ({ message: 'All listeners removed successfully' }));
    } catch (error) {
      log.failed(() => ({ error }));
      throw error;
    }
  }
}
