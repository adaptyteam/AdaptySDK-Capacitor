import type { PluginListenerHandle } from '@capacitor/core';

import { AdaptyCapacitorPlugin } from '../bridge/plugin';
import { LogContext } from '../shared/logger';

export interface CapacitorEventArg {
  data: string; // JSON string from native
}

export interface BaseEventConfig {
  nativeEvent: string;
  handlerName: string;
  propertyMap?: { [key: string]: string };
}

export interface HandlerData<THandler> {
  handler: THandler;
  config: BaseEventConfig;
  onRequestClose: () => Promise<void>;
}

/**
 * Base class for view event emitters that manages common event handling logic.
 * Each event type can have only one handler - new handlers replace existing ones.
 */
export abstract class BaseViewEmitter<TEventHandlers extends Record<string, any>, TEventData> {
  protected viewId: string;
  protected eventListeners: Map<string, PluginListenerHandle> = new Map();
  protected handlers: Map<keyof TEventHandlers, HandlerData<TEventHandlers[keyof TEventHandlers]>> = new Map();
  protected internalHandlers: Map<
    keyof TEventHandlers,
    { handler: (event: TEventData) => void; config: BaseEventConfig }
  > = new Map();

  constructor(viewId: string) {
    this.viewId = viewId;
  }

  /**
   * Abstract method to get event configuration for a handler
   */
  protected abstract getEventConfig(event: keyof TEventHandlers): BaseEventConfig | undefined;

  /**
   * Abstract method to parse event data from JSON string
   */
  protected abstract parseEventData(rawEventData: string, ctx: LogContext): TEventData;

  /**
   * Abstract method to get possible handlers for a native event
   */
  protected abstract getPossibleHandlers(nativeEvent: string): (keyof TEventHandlers)[];

  /**
   * Abstract method to extract callback arguments for a specific handler
   */
  protected abstract extractCallbackArgs(handlerName: keyof TEventHandlers, eventData: TEventData): unknown[];

  /**
   * Abstract method to get view ID from parsed event data
   */
  protected abstract getEventViewId(eventData: TEventData): string | null;

  /**
   * Abstract method to check if handler should be called based on event data
   */
  protected abstract shouldCallHandler(
    handlerName: keyof TEventHandlers,
    config: BaseEventConfig,
    eventData: TEventData,
  ): boolean;

  /**
   * Abstract method to get emitter name for error messages
   */
  protected abstract getEmitterName(): string;

  public async addListener(
    event: keyof TEventHandlers,
    callback: TEventHandlers[keyof TEventHandlers],
    onRequestClose: () => Promise<void>,
  ): Promise<PluginListenerHandle> {
    const config = this.getEventConfig(event);

    if (!config) {
      throw new Error(`No event config found for handler: ${String(event)}`);
    }

    // Replace existing handler for this event type
    this.handlers.set(event, {
      handler: callback,
      config,
      onRequestClose,
    });

    await this.ensureNativeListener(config);

    const ensured = this.eventListeners.get(config.nativeEvent);
    if (!ensured) {
      throw new Error(`Failed to register listener for ${config.nativeEvent}`);
    }
    return ensured;
  }

  public async addInternalListener(
    event: keyof TEventHandlers,
    callback: (event: TEventData) => void,
  ): Promise<PluginListenerHandle> {
    const config = this.getEventConfig(event);

    if (!config) {
      throw new Error(`No event config found for handler: ${String(event)}`);
    }

    this.internalHandlers.set(event, { handler: callback, config });

    await this.ensureNativeListener(config);

    const ensured = this.eventListeners.get(config.nativeEvent);
    if (!ensured) {
      throw new Error(`Failed to register internal listener for ${config.nativeEvent}`);
    }
    return ensured;
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

  private async ensureNativeListener(config: BaseEventConfig): Promise<void> {
    if (this.eventListeners.has(config.nativeEvent)) {
      return;
    }

    const handlers = this.handlers;
    const internalHandlers = this.internalHandlers;
    const emitterName = this.getEmitterName();
    const viewId = this.viewId;

    const subscription = await AdaptyCapacitorPlugin.addListener(config.nativeEvent, (arg: CapacitorEventArg) => {
      const ctx = new LogContext();
      const log = ctx.event({ methodName: config.nativeEvent });
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

      // Get all possible handler names for this native event
      const possibleHandlers = this.getPossibleHandlers(config.nativeEvent);

      // 1. Client handlers
      for (const handlerName of possibleHandlers) {
        const handlerData = handlers.get(handlerName);
        if (!handlerData) {
          continue; // Handler not registered for this view
        }

        const { handler, config: handlerConfig, onRequestClose } = handlerData;

        if (!this.shouldCallHandler(handlerName, handlerConfig, eventData)) {
          continue;
        }

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

        break; // Only one client handler can match per event
      }

      // 2. Internal handlers (do not short-circuit)
      for (const handlerName of possibleHandlers) {
        const internalHandlerData = internalHandlers.get(handlerName);
        if (!internalHandlerData) {
          continue;
        }

        const { handler, config: handlerConfig } = internalHandlerData;

        if (!this.shouldCallHandler(handlerName, handlerConfig, eventData)) {
          continue;
        }

        try {
          handler(eventData);
        } catch (error) {
          log.failed(() => ({ error, handlerName: `internal:${String(handlerName)}` }));
        }
      }
    });

    this.eventListeners.set(config.nativeEvent, subscription);
  }
}
