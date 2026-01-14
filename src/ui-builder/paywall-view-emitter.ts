import { parsePaywallEvent } from '../shared/coders/parse-paywall';
import type { LogContext } from '../shared/logger';
import { PaywallEventId } from '../shared/types/paywall-events';
import type { ParsedPaywallEvent } from '../shared/types/paywall-events';

import { BaseViewEmitter, type BaseEventConfig } from './base-view-emitter';
import type { EventHandlers } from './types';

type EventName = keyof EventHandlers;

/**
 * PaywallViewEmitter manages event handlers for paywall view events.
 * Each event type can have only one handler - new handlers replace existing ones.
 */
export class PaywallViewEmitter extends BaseViewEmitter<EventHandlers, ParsedPaywallEvent> {
  protected getEventConfig(event: keyof EventHandlers): BaseEventConfig | undefined {
    return HANDLER_TO_EVENT_CONFIG[event as EventName];
  }

  protected parseEventData(rawEventData: string, ctx: LogContext): ParsedPaywallEvent {
    const result = parsePaywallEvent(rawEventData, ctx);
    if (!result) {
      throw new Error('Failed to parse paywall event');
    }
    return result;
  }

  protected getPossibleHandlers(nativeEvent: string): (keyof EventHandlers)[] {
    return NATIVE_EVENT_TO_HANDLERS[nativeEvent] || [];
  }

  protected extractCallbackArgs(handlerName: keyof EventHandlers, eventData: ParsedPaywallEvent): unknown[] {
    return extractCallbackArgs(handlerName as EventName, eventData);
  }

  protected getEventViewId(eventData: ParsedPaywallEvent): string | null {
    return eventData?.view?.id ?? null;
  }

  protected shouldCallHandler(
    _handlerName: keyof EventHandlers,
    config: BaseEventConfig,
    eventData: ParsedPaywallEvent,
  ): boolean {
    if (
      config.propertyMap &&
      eventData.id === PaywallEventId.DidPerformAction &&
      eventData.action.type !== config.propertyMap['action']
    ) {
      return false;
    }
    return true;
  }

  protected getEmitterName(): string {
    return 'PaywallViewEmitter';
  }
}

type UiEventMapping = {
  [nativeEventId: string]: {
    handlerName: keyof EventHandlers;
    propertyMap?: {
      [key: string]: string;
    };
  }[];
};

/**
 * Mapping of native events to event handlers
 * Each native event can trigger multiple handlers based on action type or other properties
 *
 * Event Flow:
 * 1. Native code sends event (e.g., "paywall_view_did_perform_action")
 * 2. ViewEmitter receives event and checks view ID match
 * 3. For events with propertyMap, filters by action type (e.g., action.type === "close")
 * 4. Calls appropriate handler function
 * 5. If handler returns true, requests paywall close
 */
const UI_EVENT_MAPPINGS: UiEventMapping = {
  // User actions like close button, back button, URL taps, custom actions
  [PaywallEventId.DidPerformAction]: [
    {
      handlerName: 'onCloseButtonPress' as keyof EventHandlers,
      propertyMap: {
        action: 'close',
      },
    },
    {
      handlerName: 'onAndroidSystemBack' as keyof EventHandlers,
      propertyMap: {
        action: 'system_back',
      },
    },
    {
      handlerName: 'onUrlPress' as keyof EventHandlers,
      propertyMap: {
        action: 'open_url',
      },
    },
    {
      handlerName: 'onCustomAction' as keyof EventHandlers,
      propertyMap: {
        action: 'custom',
      },
    },
  ],

  // Product selection events
  [PaywallEventId.DidSelectProduct]: [{ handlerName: 'onProductSelected' as keyof EventHandlers }],

  // Purchase flow events
  [PaywallEventId.DidStartPurchase]: [{ handlerName: 'onPurchaseStarted' as keyof EventHandlers }],
  [PaywallEventId.DidFinishPurchase]: [{ handlerName: 'onPurchaseCompleted' as keyof EventHandlers }],
  [PaywallEventId.DidFailPurchase]: [{ handlerName: 'onPurchaseFailed' as keyof EventHandlers }],

  // Restore flow events
  [PaywallEventId.DidStartRestore]: [{ handlerName: 'onRestoreStarted' as keyof EventHandlers }],
  [PaywallEventId.DidFinishRestore]: [{ handlerName: 'onRestoreCompleted' as keyof EventHandlers }],
  [PaywallEventId.DidFailRestore]: [{ handlerName: 'onRestoreFailed' as keyof EventHandlers }],

  // Paywall lifecycle events
  [PaywallEventId.DidAppear]: [{ handlerName: 'onPaywallShown' as keyof EventHandlers }],
  [PaywallEventId.DidDisappear]: [{ handlerName: 'onPaywallClosed' as keyof EventHandlers }],

  // Error events
  [PaywallEventId.DidFailRendering]: [{ handlerName: 'onRenderingFailed' as keyof EventHandlers }],
  [PaywallEventId.DidFailLoadingProducts]: [{ handlerName: 'onLoadingProductsFailed' as keyof EventHandlers }],

  // Web payment events
  [PaywallEventId.DidFinishWebPaymentNavigation]: [
    { handlerName: 'onWebPaymentNavigationFinished' as keyof EventHandlers },
  ],
};

const HANDLER_TO_EVENT_CONFIG: Record<
  EventName,
  {
    nativeEvent: string;
    propertyMap?: { [key: string]: string };
    handlerName: EventName;
  }
> = Object.entries(UI_EVENT_MAPPINGS).reduce(
  (acc, [nativeEvent, mappings]) => {
    mappings.forEach(({ handlerName, propertyMap }) => {
      acc[handlerName] = {
        nativeEvent,
        propertyMap,
        handlerName,
      };
    });
    return acc;
  },
  {} as Record<
    EventName,
    {
      nativeEvent: string;
      propertyMap?: { [key: string]: string };
      handlerName: EventName;
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

type ExtractedArgs<T extends keyof EventHandlers> = Parameters<EventHandlers[T]>;

function extractCallbackArgs<T extends keyof EventHandlers>(
  handlerName: T,
  event: ParsedPaywallEvent,
): ExtractedArgs<T> {
  switch (event.id) {
    case PaywallEventId.DidSelectProduct:
      return [event.productId] as ExtractedArgs<T>;

    case PaywallEventId.DidStartPurchase:
      return [event.product] as ExtractedArgs<T>;

    case PaywallEventId.DidFinishPurchase:
      return [event.purchaseResult, event.product] as ExtractedArgs<T>;

    case PaywallEventId.DidFailPurchase:
      return [event.error, event.product] as ExtractedArgs<T>;

    case PaywallEventId.DidFinishRestore:
      return [event.profile] as ExtractedArgs<T>;

    case PaywallEventId.DidFailRestore:
    case PaywallEventId.DidFailRendering:
    case PaywallEventId.DidFailLoadingProducts:
      return [event.error] as ExtractedArgs<T>;

    case PaywallEventId.DidPerformAction:
      if (handlerName === 'onUrlPress' || handlerName === 'onCustomAction') {
        return [event.action.value ?? ''] as ExtractedArgs<T>;
      }
      return [] as ExtractedArgs<T>;

    case PaywallEventId.DidFinishWebPaymentNavigation:
      return [event.product, event.error] as unknown as ExtractedArgs<T>;

    case PaywallEventId.DidAppear:
    case PaywallEventId.DidDisappear:
    case PaywallEventId.DidStartRestore:
      return [] as ExtractedArgs<T>;
  }
}
