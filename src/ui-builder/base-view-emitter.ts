import type { PluginListenerHandle } from '@capacitor/core';

import { AdaptyCapacitorPlugin } from '../bridge/plugin';
import { LogContext } from '../shared/logger';

export interface CapacitorEventArg {
  data: string; // JSON string from native
}

export interface HandlerData<THandler> {
  handler: THandler;
  onRequestClose: () => Promise<void>;
}

/**
 * Base class for view event emitters that manages common event handling logic.
 * Each event type can have only one handler - new handlers replace existing ones.
 */
export abstract class BaseViewEmitter<
  TEventHandlers extends Record<string, any>,
  TEventData,
  TNativeEvent extends string = string,
> {
  protected viewId: string;
  protected eventListeners: Map<TNativeEvent, PluginListenerHandle> = new Map();
  protected handlers: Map<keyof TEventHandlers, HandlerData<TEventHandlers[keyof TEventHandlers]>> = new Map();
  protected internalHandlers: Map<keyof TEventHandlers, { handler: (event: TEventData) => void }> = new Map();

  constructor(viewId: string) {
    this.viewId = viewId;
  }

  /**
   * Abstract method to parse event data from JSON string
   */
  protected abstract parseEventData(rawEventData: string, ctx: LogContext): TEventData;

  /**
   * Abstract method to get native event name for handler
   */
  protected abstract getNativeEventForHandler(event: keyof TEventHandlers): TNativeEvent | null;

  /**
   * Resolves handler name for incoming native event based on parsed data
   */
  protected abstract getHandlerForNativeEvent(
    nativeEvent: TNativeEvent,
    eventData: TEventData,
  ): keyof TEventHandlers | null;

  /**
   * Abstract method to extract callback arguments for a specific handler
   */
  protected abstract extractCallbackArgs(handlerName: keyof TEventHandlers, eventData: TEventData): unknown[];

  /**
   * Abstract method to get view ID from parsed event data
   */
  protected abstract getEventViewId(eventData: TEventData): string | null;

  /**
   * Abstract method to get emitter name for error messages
   */
  protected abstract getEmitterName(): string;

  public async addListener(
    event: keyof TEventHandlers,
    callback: TEventHandlers[keyof TEventHandlers],
    onRequestClose: () => Promise<void>,
  ): Promise<PluginListenerHandle> {
    const nativeEvent = this.getNativeEventForHandler(event);
    if (!nativeEvent) {
      throw new Error(`No native event mapping found for handler: ${String(event)}`);
    }

    // Replace existing handler for this event type
    this.handlers.set(event, {
      handler: callback,
      onRequestClose,
    });

    return await this.getOrCreateNativeListener(nativeEvent);
  }

  public async addInternalListener(
    event: keyof TEventHandlers,
    callback: (event: TEventData) => void,
  ): Promise<PluginListenerHandle> {
    const nativeEvent = this.getNativeEventForHandler(event);
    if (!nativeEvent) {
      throw new Error(`No native event mapping found for handler: ${String(event)}`);
    }

    this.internalHandlers.set(event, { handler: callback });

    return await this.getOrCreateNativeListener(nativeEvent);
  }

  public removeAllListeners(): void {
    this.eventListeners.forEach((subscription) => {
      subscription.remove().catch(() => {
        // intentionally ignore errors during cleanup
      });
    });
    this.eventListeners.clear();
    this.handlers.clear();
    this.internalHandlers.clear();
  }

  private async createNativeListener(nativeEvent: TNativeEvent): Promise<PluginListenerHandle> {
    const emitterName = this.getEmitterName();
    const viewId = this.viewId;

    const subscription = await AdaptyCapacitorPlugin.addListener(nativeEvent, (arg: CapacitorEventArg) => {
      const ctx = new LogContext();
      const log = ctx.event({ methodName: nativeEvent });
      log.start(() => ({ raw: arg }));

      // Strict validation: events must come in {data: "json_string"} format
      if (!arg || typeof arg !== 'object' || !arg.data) {
        const error = new Error(
          `[${emitterName}] Invalid event format received. Expected {data: "json_string"}, got: ${JSON.stringify(arg)}`,
        );
        log.failed(() => ({ error }));
        throw error;
      }

      const rawEventData: string = arg.data;

      // Parse JSON string using specific parser with decode logging
      let eventData: TEventData;
      if (typeof rawEventData === 'string') {
        try {
          eventData = this.parseEventData(rawEventData, ctx);
        } catch (error) {
          log.failed(() => ({ error }));
          throw error;
        }
      } else {
        const err = new Error(
          `[${emitterName}] Expected event data to be JSON string, got ${typeof rawEventData}: ${rawEventData}`,
        );
        log.failed(() => ({ error: err }));
        throw err;
      }

      const eventViewId = this.getEventViewId(eventData);
      if (viewId !== eventViewId) {
        return;
      }

      const handlerName = this.getHandlerForNativeEvent(nativeEvent, eventData);
      if (!handlerName) {
        return;
      }

      // 1. Client handler (single)
      const handlerData = this.handlers.get(handlerName);
      if (handlerData) {
        const { handler, onRequestClose } = handlerData;
        const callbackArgs = this.extractCallbackArgs(handlerName, eventData);

        const cb = handler as (...args: typeof callbackArgs) => boolean;
        try {
          const shouldClose = cb(...callbackArgs);
          if (shouldClose) {
            onRequestClose().catch((error) => {
              log.failed(() => ({ error, handlerName }));
            });
          }
          log.success(() => ({ message: 'Event handled successfully', handlerName }));
        } catch (error) {
          log.failed(() => ({ error, handlerName }));
        }
      }

      // 2. Internal handler
      const internalHandlerData = this.internalHandlers.get(handlerName);
      if (internalHandlerData) {
        try {
          internalHandlerData.handler(eventData);
        } catch (error: unknown) {
          log.failed(() => ({ error, handlerName: `internal:${String(handlerName)}` }));
        }
      }
    });

    this.eventListeners.set(nativeEvent, subscription);
    return subscription;
  }

  private async getOrCreateNativeListener(nativeEvent: TNativeEvent): Promise<PluginListenerHandle> {
    const existing = this.eventListeners.get(nativeEvent);
    if (existing) {
      return existing;
    }

    const created = await this.createNativeListener(nativeEvent);
    if (!created) {
      throw new Error(`Failed to register listener for ${nativeEvent}`);
    }
    return created;
  }
}
