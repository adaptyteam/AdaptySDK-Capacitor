import type { PluginListenerHandle } from '@capacitor/core';

import { AdaptyCapacitorPlugin } from '../bridge/plugin';
import { parseOnboardingEvent } from '../shared/coders/parse';
import { LogContext } from '../shared/logger';

import type { OnboardingEventHandlers } from './types';

type EventName = keyof OnboardingEventHandlers;

interface CapacitorEventArg {
  data: string; // JSON string from native
}

/**
 * OnboardingViewEmitter manages event handlers for onboarding view events.
 * Each event type can have only one handler - new handlers replace existing ones.
 */
export class OnboardingViewEmitter {
  private viewId: string;
  private eventListeners: Map<string, PluginListenerHandle> = new Map();
  private handlers: Map<
    EventName,
    {
      handler: OnboardingEventHandlers[EventName];
      config: (typeof HANDLER_TO_EVENT_CONFIG)[EventName];
      onRequestClose: () => Promise<void>;
    }
  > = new Map();

  constructor(viewId: string) {
    this.viewId = viewId;
  }

  public async addListener(
    event: EventName,
    callback: OnboardingEventHandlers[EventName],
    onRequestClose: () => Promise<void>,
  ): Promise<PluginListenerHandle> {
    const viewId = this.viewId;
    const config = HANDLER_TO_EVENT_CONFIG[event];

    if (!config) {
      throw new Error(`No event config found for handler: ${event}`);
    }

    // Replace existing handler for this event type
    this.handlers.set(event, {
      handler: callback,
      config,
      onRequestClose,
    });

    if (!this.eventListeners.has(config.nativeEvent)) {
      const handlers = this.handlers;
      const subscription = await AdaptyCapacitorPlugin.addListener(
        config.nativeEvent,
        function (arg: CapacitorEventArg) {
          const ctx = new LogContext();
          const log = ctx.event({ methodName: config.nativeEvent });
          log.start(() => ({ raw: arg }));

          if (!arg || typeof arg !== 'object' || !arg.data) {
            const error = new Error(
              `[OnboardingViewEmitter] Invalid event format received. Expected {data: "json_string"}, got: ${JSON.stringify(
                arg,
              )}`,
            );
            log.failed(() => ({ error }));
            throw error;
          }

          const rawEventData: string = arg.data;
          let eventData: Record<string, any>;
          if (typeof rawEventData === 'string') {
            try {
              eventData = parseOnboardingEvent(rawEventData, ctx) as Record<string, any>;
            } catch (error) {
              log.failed(() => ({ error }));
              throw error;
            }
          } else {
            const err = new Error(
              `[OnboardingViewEmitter] Expected event data to be JSON string, got ${typeof rawEventData}: ${rawEventData}`,
            );
            log.failed(() => ({ error: err }));
            throw err;
          }

          const eventViewId = (eventData as any)?.view?.id ?? null;
          if (viewId !== eventViewId) {
            return;
          }

          // Get all possible handler names for this native event
          const possibleHandlers = NATIVE_EVENT_TO_HANDLERS[config.nativeEvent] || [];

          for (const handlerName of possibleHandlers) {
            const handlerData = handlers.get(handlerName);
            if (!handlerData) {
              continue; // Handler not registered for this view
            }

            const { handler, onRequestClose } = handlerData;
            const callbackArgs = extractCallbackArgs(handlerName, eventData);

            const cb = handler as (...args: typeof callbackArgs) => boolean;
            try {
              const shouldClose = cb(...callbackArgs);
              if (shouldClose) {
                onRequestClose().catch((error) => {
                  log.failed(() => ({ error }));
                });
              }
            } catch (error) {
              log.failed(() => ({ error }));
            }
          }
        },
      );
      this.eventListeners.set(config.nativeEvent, subscription);
    }

    const ensured = this.eventListeners.get(config.nativeEvent);
    if (!ensured) {
      throw new Error(`Failed to register listener for ${config.nativeEvent}`);
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
  }
}

type UiEventMapping = {
  [nativeEventId: string]: {
    handlerName: keyof OnboardingEventHandlers;
  }[];
};

const ONBOARDING_EVENT_MAPPINGS: UiEventMapping = {
  onboarding_did_fail_with_error: [{ handlerName: 'onError' }],
  onboarding_on_analytics_action: [{ handlerName: 'onAnalytics' }],
  onboarding_did_finish_loading: [{ handlerName: 'onFinishedLoading' }],
  onboarding_on_close_action: [{ handlerName: 'onClose' }],
  onboarding_on_custom_action: [{ handlerName: 'onCustom' }],
  onboarding_on_paywall_action: [{ handlerName: 'onPaywall' }],
  onboarding_on_state_updated_action: [{ handlerName: 'onStateUpdated' }],
};

const HANDLER_TO_EVENT_CONFIG: Record<
  keyof OnboardingEventHandlers,
  {
    nativeEvent: string;
    handlerName: keyof OnboardingEventHandlers;
  }
> = Object.entries(ONBOARDING_EVENT_MAPPINGS).reduce(
  (acc, [nativeEvent, mappings]) => {
    mappings.forEach(({ handlerName }) => {
      acc[handlerName] = {
        nativeEvent,
        handlerName,
      };
    });
    return acc;
  },
  {} as Record<
    keyof OnboardingEventHandlers,
    {
      nativeEvent: string;
      handlerName: keyof OnboardingEventHandlers;
    }
  >,
);

// Reverse mapping: nativeEvent -> EventName[]
const NATIVE_EVENT_TO_HANDLERS: Record<string, EventName[]> = Object.entries(HANDLER_TO_EVENT_CONFIG).reduce(
  (acc, [handlerName, config]) => {
    if (!acc[config.nativeEvent]) {
      acc[config.nativeEvent] = [];
    }
    acc[config.nativeEvent].push(handlerName as EventName);
    return acc;
  },
  {} as Record<string, EventName[]>,
);

function extractCallbackArgs(handlerName: keyof OnboardingEventHandlers, eventArg: Record<string, any>): any[] {
  const actionId = eventArg['id'] || '';
  const meta = eventArg['meta'];
  const event = eventArg['event'];
  const action = eventArg['action'];

  switch (handlerName) {
    case 'onClose':
    case 'onCustom':
    case 'onPaywall':
      return [actionId, meta];
    case 'onStateUpdated':
      return [action, meta];
    case 'onFinishedLoading':
      return [meta];
    case 'onAnalytics':
      return [event, meta];
    case 'onError':
      return [eventArg['error']];
    default:
      return [];
  }
}
