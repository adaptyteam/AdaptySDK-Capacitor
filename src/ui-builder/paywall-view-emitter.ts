import { parsePaywallEvent } from '../shared/coders/parse';
import type { LogContext } from '../shared/logger';

import { BaseViewEmitter, type BaseEventConfig } from './base-view-emitter';
import type { EventHandlers } from './types';

type EventName = keyof EventHandlers;

interface ParsedEventData {
  view?: {
    id: string;
    placement_id?: string;
    variation_id?: string;
  };
  action?: {
    type: string;
    value?: any;
  };
  product?: any;
  product_id?: string;
  purchased_result?: any;
  error?: any;
  profile?: any;
  id: string;
}

/**
 * PaywallViewEmitter manages event handlers for paywall view events.
 * Each event type can have only one handler - new handlers replace existing ones.
 */
export class PaywallViewEmitter extends BaseViewEmitter<EventHandlers, ParsedEventData> {
  protected getEventConfig(event: keyof EventHandlers): BaseEventConfig | undefined {
    return HANDLER_TO_EVENT_CONFIG[event as EventName];
  }

  protected parseEventData(rawEventData: string, ctx: LogContext): ParsedEventData {
    return parsePaywallEvent(rawEventData, ctx) as ParsedEventData;
  }

  protected getPossibleHandlers(nativeEvent: string): (keyof EventHandlers)[] {
    return NATIVE_EVENT_TO_HANDLERS[nativeEvent] || [];
  }

  protected extractCallbackArgs(handlerName: keyof EventHandlers, eventData: ParsedEventData): any[] {
    return extractCallbackArgs(handlerName as EventName, eventData);
  }

  protected getEventViewId(eventData: ParsedEventData): string | null {
    return eventData?.view?.id ?? null;
  }

  protected shouldCallHandler(
    _handlerName: keyof EventHandlers,
    config: BaseEventConfig,
    eventData: ParsedEventData,
  ): boolean {
    if (config.propertyMap && eventData?.action?.type !== config.propertyMap['action']) {
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
  paywall_view_did_perform_action: [
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
  paywall_view_did_select_product: [{ handlerName: 'onProductSelected' as keyof EventHandlers }],

  // Purchase flow events
  paywall_view_did_start_purchase: [{ handlerName: 'onPurchaseStarted' as keyof EventHandlers }],
  paywall_view_did_finish_purchase: [{ handlerName: 'onPurchaseCompleted' as keyof EventHandlers }],
  paywall_view_did_fail_purchase: [{ handlerName: 'onPurchaseFailed' as keyof EventHandlers }],

  // Restore flow events
  paywall_view_did_start_restore: [{ handlerName: 'onRestoreStarted' as keyof EventHandlers }],
  paywall_view_did_finish_restore: [{ handlerName: 'onRestoreCompleted' as keyof EventHandlers }],
  paywall_view_did_fail_restore: [{ handlerName: 'onRestoreFailed' as keyof EventHandlers }],

  // Paywall lifecycle events
  paywall_view_did_appear: [{ handlerName: 'onPaywallShown' as keyof EventHandlers }],
  paywall_view_did_disappear: [{ handlerName: 'onPaywallClosed' as keyof EventHandlers }],

  // Error events
  paywall_view_did_fail_rendering: [{ handlerName: 'onRenderingFailed' as keyof EventHandlers }],
  paywall_view_did_fail_loading_products: [{ handlerName: 'onLoadingProductsFailed' as keyof EventHandlers }],

  // Web payment events
  paywall_view_did_finish_web_payment_navigation: [
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

function extractCallbackArgs(handlerName: EventName, eventArg: ParsedEventData) {
  switch (handlerName) {
    case 'onProductSelected':
      return [eventArg.product_id];
    case 'onPurchaseStarted':
      return [eventArg.product];
    case 'onPurchaseCompleted':
      return [eventArg.purchased_result, eventArg.product];
    case 'onPurchaseFailed':
      return [eventArg.error, eventArg.product];
    case 'onRestoreCompleted':
      return [eventArg.profile];
    case 'onRestoreFailed':
    case 'onRenderingFailed':
    case 'onLoadingProductsFailed':
      return [eventArg.error];
    case 'onCustomAction':
    case 'onUrlPress':
      return [eventArg.action?.value];
    case 'onWebPaymentNavigationFinished':
      return [eventArg.product, eventArg.error];
    case 'onCloseButtonPress':
    case 'onAndroidSystemBack':
    case 'onPaywallShown':
    case 'onPaywallClosed':
    case 'onRestoreStarted':
    default:
      return [];
  }
}
